/**
 * The API as an MCP server (Streamable HTTP, stateless): JSON-RPC posted to
 * /mcp, answered as JSON, no session and no stream. Two tools, both a
 * Worksheet script solved: `solve_worksheet` takes one whole, `fluid_state`
 * writes the one-state script for a quick question.
 *
 * Clients add it by its address (Claude's connectors, Cursor, VS Code,
 * ChatGPT's developer mode); there is nothing to authenticate.
 */

type Solve = (
  script: string,
  agent: string | null,
) => Promise<{ ok: boolean } | { error: string }>;

type Message = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

/** Newest first; a client asking for another gets the newest. */
const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];

const UNIT_SYSTEMS = ["celsius", "kelvin", "imperial"];
const REFERENCES = ["DEF", "ASHRAE", "IIR", "NBP"];

function tools(language: string) {
  const readOnly = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };
  return [
    {
      name: "solve_worksheet",
      title: "Solve a thermodynamics script",
      description: `Solves a Thermoprops Worksheet script with CoolProp (exact equations of state, not interpolated tables): states, processes and whole cycles, with values computed from them.

Returns JSON: each state with its phase and properties in the script's units, the computed values, the print lines ("COP = 2.72"), errors by line (fix the line and call again), and "worksheet": a link that opens the script solved with p-h and T-s diagrams. Give that link to the person you answer.

${language}`,
      inputSchema: {
        type: "object",
        properties: {
          script: {
            type: "string",
            description: "The script, one statement per line.",
          },
        },
        required: ["script"],
        additionalProperties: false,
      },
      annotations: { title: "Solve a thermodynamics script", ...readOnly },
    },
    {
      name: "fluid_state",
      title: "Properties of a fluid's state",
      description:
        'One state of a fluid from two properties, computed with CoolProp: temperature, pressure, density, specific volume, enthalpy, entropy, internal energy, quality, cp, cv, speed of sound, viscosity, conductivity, Prandtl number and compressibility. "state" is written as in the Worksheet: "T = 25 °C, P = 1 bar", "P = 1 MPa, sat vapor", "T = -10 °C, x = 0.3", "P = 8 MPa, h = 3300 kJ/kg". For a cycle or a process, use solve_worksheet.',
      inputSchema: {
        type: "object",
        properties: {
          fluid: {
            type: "string",
            description:
              "CoolProp's name: Water, R134a, Ammonia, CarbonDioxide, Air, R410A, R32, Nitrogen…",
          },
          state: {
            type: "string",
            description:
              'Two properties with units, e.g. "T = 25 °C, P = 1 bar".',
          },
          units: {
            type: "string",
            enum: UNIT_SYSTEMS,
            description:
              "How results are given: celsius (°C, kPa, kJ/kg), kelvin, or imperial (°F, psi, BTU/lb). Default celsius.",
          },
          reference: {
            type: "string",
            enum: REFERENCES,
            description:
              "Where h and s are measured from. ASHRAE (h = s = 0 for the saturated liquid at -40 °C) matches the refrigerant tables of most textbooks; IIR (h = 200 kJ/kg, s = 1 kJ/(kg·K) at 0 °C) European ones; NBP (0 at the normal boiling point); DEF, CoolProp's default and the steam tables' for water. Default DEF.",
          },
        },
        required: ["fluid", "state"],
        additionalProperties: false,
      },
      annotations: { title: "Properties of a fluid's state", ...readOnly },
    },
  ];
}

const INSTRUCTIONS =
  "Thermoprops computes thermodynamic properties with CoolProp. Use it instead of interpolating property tables: fluid_state for one state, solve_worksheet for processes and cycles. Each answer carries a Worksheet link that opens the calculation solved, with diagrams; share it with the user.";

const result = (id: Message["id"], value: unknown) => ({
  jsonrpc: "2.0",
  id,
  result: value,
});

const failure = (id: Message["id"], code: number, message: string) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});

/** One line of a script: no line breaks smuggled into a fluid's name. */
const oneLine = (s: unknown) =>
  typeof s === "string" && !/[\r\n]/.test(s) && s.trim() ? s.trim() : null;

async function call(
  name: unknown,
  args: Record<string, unknown>,
  solve: Solve,
  agent: string | null,
) {
  let script: string;
  if (name === "solve_worksheet") {
    if (typeof args.script !== "string")
      return { error: "solve_worksheet takes a script." };
    script = args.script;
  } else if (name === "fluid_state") {
    const fluid = oneLine(args.fluid);
    const state = oneLine(args.state);
    const units = args.units ?? "celsius";
    if (!fluid || !state)
      return { error: "fluid_state takes a fluid and a state." };
    if (typeof units !== "string" || !UNIT_SYSTEMS.includes(units))
      return { error: `units is one of ${UNIT_SYSTEMS.join(", ")}.` };
    const reference = args.reference ?? "DEF";
    if (typeof reference !== "string" || !REFERENCES.includes(reference))
      return { error: `reference is one of ${REFERENCES.join(", ")}.` };
    script = `fluid ${fluid}\nunits ${units}\nreference ${reference}\n1: ${state}`;
  } else return null;
  return solve(script, agent);
}

async function reply(
  m: Message,
  solve: Solve,
  language: string,
  agent: string | null,
) {
  switch (m.method) {
    case "initialize": {
      const asked = m.params?.protocolVersion;
      return result(m.id, {
        protocolVersion:
          typeof asked === "string" && VERSIONS.includes(asked)
            ? asked
            : VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: {
          name: "thermoprops",
          title: "Thermoprops",
          version: "0.1.0",
          websiteUrl: "https://luisbedoia.github.io/thermoprops/",
        },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return result(m.id, {});
    case "tools/list":
      return result(m.id, { tools: tools(language) });
    case "tools/call": {
      const params = m.params ?? {};
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      const answer = await call(params.name, args, solve, agent);
      if (answer === null)
        return failure(m.id, -32602, `Unknown tool: ${String(params.name)}`);
      // A script that does not solve is the tool's answer, marked as an
      // error so the model reads it and fixes the script.
      const isError = !("ok" in answer) || !answer.ok;
      return result(m.id, {
        content: [{ type: "text", text: JSON.stringify(answer, null, 2) }],
        structuredContent: answer,
        isError,
      });
    }
    default:
      return failure(m.id, -32601, `Method not found: ${m.method}`);
  }
}

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

export async function handleMcp(
  request: Request,
  solve: Solve,
  language: string,
): Promise<Response> {
  // No server-sent stream to open, and no session to end.
  if (request.method !== "POST")
    return new Response(null, { status: 405, headers: { allow: "POST" } });

  let m: Message;
  try {
    m = await request.json();
  } catch {
    return Response.json(failure(null, -32700, "Parse error"), {
      status: 400,
    });
  }
  if (!m || typeof m !== "object" || Array.isArray(m) || m.jsonrpc !== "2.0")
    return Response.json(failure(null, -32600, "Invalid request"), {
      status: 400,
    });
  // A notification (initialized, cancelled…) or a response: nothing to say.
  if (m.id === undefined || !m.method)
    return new Response(null, { status: 202 });

  const body = await reply(
    m,
    solve,
    language,
    request.headers.get("user-agent"),
  );
  return new Response(JSON.stringify(body), { headers: JSON_HEADERS });
}
