/**
 * The API as an MCP server (Streamable HTTP, stateless): JSON-RPC posted to
 * /mcp, answered as JSON, no session and no stream. Two tools solve a
 * Worksheet script, `solve_worksheet` one whole and `fluid_state` the
 * one-state script it writes for a quick question; `language_reference`
 * gives the script language's whole manual.
 *
 * Every token of the tools' descriptions is read in every conversation, and
 * of an answer in every call: the descriptions carry a cheat sheet (the
 * manual is a tool away) and answers are a text table (answer.ts).
 *
 * Clients add it by its address (Claude's connectors, Cursor, VS Code,
 * ChatGPT's developer mode); there is nothing to authenticate.
 */
import { FLUID_NAMES } from "../../src/links/links";
import { asText, type Answer } from "./answer";

type Solve = (
  script: string,
  agent: string | null,
) => Promise<Answer | { error: string }>;

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
/** A state's properties besides those every answer shows (T, P, h, s, x, v). */
const EXTRA = ["D", "u", "cp", "cv", "mu", "k", "Pr", "Z", "a", "g"];

const CHEAT_SHEET = `One statement per line, # comments:
fluid R134a
units celsius             # or kelvin, imperial
reference ASHRAE          # zero of h, s: DEF, ASHRAE (textbook refrigerant tables), IIR, NBP
1: T = -10 °C, sat vapor  # two properties; sat liquid is x = 0
2: from 1, compressed to P = 1.2 MPa, eta = 80%
3: P = P2, sat liquid
4: from 3, throttled to P = P1
COP = (h1 - h4) / (h2 - h1)
print COP, T2 in °F, cp2
Processes: isentropic, compressed/expanded (eta), throttled, isobaric, isothermal, isochoric, isenthalpic, polytropic (n).
Properties: T P h s x D v u cp cv mu k Pr Z a g; states show T P h s x v, print others.
Fluids: ${FLUID_NAMES.join(", ")}.`;

function tools() {
  const readOnly = { readOnlyHint: true, openWorldHint: false };
  return [
    {
      name: "fluid_state",
      title: "Properties of a fluid's state",
      description:
        'A fluid\'s state from two properties, with CoolProp: T, P, h, s, x, v, and "properties" (D density, u, cp, cv, mu viscosity, k conductivity, Pr, Z, a speed of sound, g). state: "T = 25 °C, P = 1 bar", "P = 1 MPa, sat vapor". Processes and cycles: solve_worksheet.',
      inputSchema: {
        type: "object",
        properties: {
          fluid: { type: "string", description: "Water, R134a, Ammonia…" },
          state: { type: "string" },
          units: {
            type: "string",
            enum: UNIT_SYSTEMS,
            description: "Default celsius.",
          },
          reference: {
            type: "string",
            enum: REFERENCES,
            description:
              "Zero of h, s; default DEF. ASHRAE: textbook refrigerant tables.",
          },
          properties: { type: "array", items: { type: "string", enum: EXTRA } },
        },
        required: ["fluid", "state"],
        additionalProperties: false,
      },
      annotations: readOnly,
    },
    {
      name: "solve_worksheet",
      title: "Solve a thermodynamics script",
      description: `Solves processes and whole cycles with CoolProp, written as a Thermoprops Worksheet script. Answers a table of the states, the printed results, errors by line, and a link that opens it solved with diagrams: give it to the user.

${CHEAT_SHEET}
More syntax: language_reference.`,
      inputSchema: {
        type: "object",
        properties: { script: { type: "string" } },
        required: ["script"],
        additionalProperties: false,
      },
      annotations: readOnly,
    },
    {
      name: "language_reference",
      title: "The Worksheet script language",
      description:
        "The script language's whole manual, for what solve_worksheet's cheat sheet leaves out.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: readOnly,
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

const text = (t: string, isError = false) => ({
  content: [{ type: "text", text: t }],
  isError,
});

/** One line of a script: no line breaks smuggled into a fluid's name. */
const oneLine = (s: unknown) =>
  typeof s === "string" && !/[\r\n]/.test(s) && s.trim() ? s.trim() : null;

/** The script a tool's arguments stand for, or why they are wrong. */
function script(
  name: unknown,
  args: Record<string, unknown>,
): { script: string } | { error: string } | null {
  if (name === "solve_worksheet")
    return typeof args.script === "string"
      ? { script: args.script }
      : { error: "solve_worksheet takes a script." };
  if (name !== "fluid_state") return null;
  const fluid = oneLine(args.fluid);
  const state = oneLine(args.state);
  if (!fluid || !state)
    return { error: "fluid_state takes a fluid and a state." };
  const units = args.units ?? "celsius";
  if (typeof units !== "string" || !UNIT_SYSTEMS.includes(units))
    return { error: `units is one of ${UNIT_SYSTEMS.join(", ")}.` };
  const reference = args.reference ?? "DEF";
  if (typeof reference !== "string" || !REFERENCES.includes(reference))
    return { error: `reference is one of ${REFERENCES.join(", ")}.` };
  const extra = args.properties ?? [];
  if (
    !Array.isArray(extra) ||
    !extra.every((p) => typeof p === "string" && EXTRA.includes(p))
  )
    return { error: `properties are among ${EXTRA.join(", ")}.` };
  const print = extra.length
    ? `\nprint ${extra.map((p) => `${p}1`).join(", ")}`
    : "";
  return {
    script: `fluid ${fluid}\nunits ${units}\nreference ${reference}\n1: ${state}${print}`,
  };
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
          version: "0.2.0",
          websiteUrl: "https://luisbedoia.github.io/thermoprops/",
        },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return result(m.id, {});
    case "tools/list":
      return result(m.id, { tools: tools() });
    case "tools/call": {
      const params = m.params ?? {};
      if (params.name === "language_reference")
        return result(m.id, text(language));
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      const asked = script(params.name, args);
      if (asked === null)
        return failure(m.id, -32602, `Unknown tool: ${String(params.name)}`);
      if ("error" in asked) return result(m.id, text(asked.error, true));
      const answer = await solve(asked.script, agent);
      if ("error" in answer) return result(m.id, text(answer.error, true));
      // A script that does not solve is the tool's answer, marked as an
      // error so the model reads it and fixes the script.
      return result(m.id, text(asText(answer), !!answer.errors));
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
