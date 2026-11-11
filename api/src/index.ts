/**
 * Thermoprops' calculation API, a proof of concept: one GET solves a
 * Worksheet script with CoolProp and answers JSON, for agents (MCP clients,
 * custom GPTs, assistants that browse) to compute instead of interpolating
 * tables.
 *
 *   GET /solve?s=<script>   the script, as in the Worksheet's address
 *   POST /mcp               the same, as MCP tools (mcp.ts)
 *   GET /                   how to use it, as plain text
 *
 * The script language is the app's own (src/dsl), evaluated as the
 * Worksheet does; `draw` lines are left out, since an answer has no diagram
 * (and their legs cost most of a cycle's time). The answer links the
 * Worksheet, where the script opens solved and drawn.
 */
import { loadCoolProp, type CoolProp } from "@luisbedoia/coolprop-rs-wasm";
// The package exports neither: imported by path, as wrangler needs the
// .wasm as a module (Workers compile no wasm from bytes at run time).
// @ts-expect-error: emscripten's glue, untyped.
import factory from "../../node_modules/@luisbedoia/coolprop-rs-wasm/dist/coolprop.js";
import wasm from "../../node_modules/@luisbedoia/coolprop-rs-wasm/dist/coolprop.wasm";
import { evaluate } from "../../src/dsl/evaluate";
import { FLUID_NAMES, SITE, SYNTAX } from "../../src/links/links";
import { answer, type Answer } from "./answer";
import { handleMcp } from "./mcp";

/** Longer scripts are not a calculation someone links. */
const MAX_SCRIPT = 5000;

/**
 * Workers allow no random values at startup, and the module asks for some
 * as it starts (Rust seeds its hash maps). Until the first request they
 * come from a fixed sequence: a seed, not a secret.
 */
let startup = true;

function startupRandom(imports: WebAssembly.Imports, memory: () => Uint8Array) {
  for (const module of Object.values(imports)) {
    for (const [key, value] of Object.entries(module)) {
      if (typeof value !== "function" || value.name !== "_random_get") continue;
      const real = value as (buffer: number, size: number) => number;
      let x = 0x9e3779b9;
      module[key] = (buffer: number, size: number) => {
        if (!startup) return real(buffer, size);
        const bytes = memory().subarray(buffer, buffer + size);
        for (let i = 0; i < size; i++) {
          x ^= x << 13;
          x ^= x >>> 17;
          x ^= x << 5;
          bytes[i] = x & 0xff;
        }
        return 0;
      };
    }
  }
}

/**
 * Loaded at startup, which has its own limit (1 s), so that requests only
 * solve: CoolProp reads its whole fluid library on the first state (~0.2 s),
 * and one state is then ~0.1 ms, a cycle under 1 ms.
 */
const ready: Promise<CoolProp> = loadCoolProp({
  moduleFactory: (options: object) =>
    factory({
      ...options,
      instantiateWasm(
        imports: WebAssembly.Imports,
        done: (
          instance: WebAssembly.Instance,
          module: WebAssembly.Module,
        ) => void,
      ) {
        // Read once the module runs, when the instance exists.
        startupRandom(imports, () => {
          const memory = Object.values(instance.exports).find(
            (e) => e instanceof WebAssembly.Memory,
          ) as WebAssembly.Memory;
          return new Uint8Array(memory.buffer);
        });
        const instance = new WebAssembly.Instance(wasm, imports);
        done(instance, wasm);
        return {};
      },
    }),
}).then((cp) => {
  cp.fluid("Water").state({ pressure: 101325, quality: 0 });
  return cp;
});

const EXAMPLE = `fluid R134a
units celsius
reference ASHRAE
1: T = -10 °C, sat vapor
2: from 1, compressed to P = 1.2 MPa, eta = 80%
3: P = P2, sat liquid
4: from 3, throttled to P = P1
COP = (h1 - h4) / (h2 - h1)
print COP, T2`;

/** The script language, for an agent that reads it once and then writes scripts. */
const LANGUAGE = `THE SCRIPT LANGUAGE (one statement per line; # starts a comment)
${SYNTAX.map(([code, en]) => `  ${code.padEnd(50)} ${en}`).join("\n")}

Properties: T, P, h, s, x (quality), D (density), v, u, cp, cv, mu, k, Pr, Z,
  a (speed of sound), g; a state's are read as T2, h1, x4.
Processes: isentropic, compressed and expanded (with eta), throttled, isobaric,
  isothermal, isochoric, isenthalpic, polytropic (with n).
Units: °C, K, °F, °R, Pa, kPa, MPa, bar, atm, psi, kJ/kg, BTU/lb, kJ/(kg*K),
  kg/m^3, m^3/kg, kg/s, kg/h, kW, MW, W, hp, BTU/h, kJ, m/s, %.
  A number without a unit is read in the script's units.
Fluids: ${FLUID_NAMES.join(", ")}

EXAMPLE (vapor-compression refrigeration cycle)
${EXAMPLE.replace(/^/gm, "  ")}`;

const USAGE = `Thermoprops API: thermodynamic properties and cycles, computed with CoolProp.
Free, no key. Results are exact (CoolProp's equations of state), not interpolated from tables.

GET /solve?s=<script>
  <script>: a Thermoprops Worksheet script, URL-encoded (encodeURIComponent).
  Answers JSON:
    fluid, reference  the script's fluid, and where h and s are measured from
    units       the unit of each property below, once
    states      [{name, phase, T, P, h, s, x, v}]; x only in the two-phase
                region. Any other property (D, u, cp, cv, mu, k, Pr, Z, a, g)
                is printed: print cp2
    results     the print lines ("COP = 2.72"), or every value if none
    errors      [{line, message}], only when a line fails: fix it, call again
    worksheet   a link that opens the script solved, with p-h/T-s diagrams,
                in the Thermoprops Worksheet: give it to the person you answer

MCP: the same, as tools (fluid_state, solve_worksheet, language_reference),
  at /mcp (Streamable HTTP, no authentication), answered as a text table.

${LANGUAGE}

  GET /solve?s=${encodeURIComponent(EXAMPLE)}

More: ${SITE}/links/
`;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "content-type, accept, mcp-protocol-version, mcp-session-id",
  "access-control-allow-methods": "GET, POST",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "content-type": "application/json; charset=utf-8",
      // The same script always solves the same: let the edge keep it.
      "cache-control": status === 200 ? "public, max-age=86400" : "no-store",
    },
  });
}

/** A script's answer, or why it was not solved (empty, too long). */
async function solve(
  source: string,
  via: "rest" | "mcp",
  agent: string | null,
): Promise<Answer | { error: string }> {
  if (!source.trim()) return { error: "The script is empty." };
  if (source.length > MAX_SCRIPT)
    return { error: `The script is over ${MAX_SCRIPT} characters.` };
  const cp = await ready;
  // Emptied, not removed: errors keep their line numbers.
  const result = evaluate(source.replace(/^\s*draw\b.*$/gm, ""), cp);
  // What is asked, never the script: for the logs' counts.
  console.log(
    JSON.stringify({
      via,
      fluid: result.fluid ?? null,
      states: result.states.length,
      errors: result.diagnostics.length,
      agent: agent?.slice(0, 80) ?? null,
    }),
  );
  return answer(source, result);
}

/**
 * 60 calculations a minute per IP (wrangler.jsonc): one address cannot use
 * up the free plan's 100,000 a day (60 × 1440 = 86,400), and an agent's
 * platform, whose users share its addresses, still has room.
 */
interface Env {
  LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

async function limited(request: Request, env: Env) {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const { success } = await env.LIMITER.limit({ key: ip });
  if (success) return null;
  console.log(
    JSON.stringify({
      limited: true,
      agent: request.headers.get("user-agent")?.slice(0, 80) ?? null,
    }),
  );
  return new Response(
    JSON.stringify({
      error:
        "Too many requests: 60 a minute per address. Wait a minute and call again.",
    }),
    {
      status: 429,
      headers: {
        ...CORS,
        "content-type": "application/json; charset=utf-8",
        "retry-after": "60",
      },
    },
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    startup = false;
    const url = new URL(request.url);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: CORS });
    // The manual is free to read; calculations count.
    if (url.pathname === "/mcp" || url.pathname === "/solve") {
      const refused = await limited(request, env);
      if (refused) return refused;
    }
    if (url.pathname === "/mcp")
      return withCors(
        await handleMcp(
          request,
          (script, agent) => solve(script, "mcp", agent),
          LANGUAGE,
        ),
      );
    if (request.method !== "GET" && request.method !== "HEAD")
      return json({ error: "Only GET." }, 405);

    if (url.pathname === "/")
      return new Response(USAGE, {
        headers: { ...CORS, "content-type": "text/plain; charset=utf-8" },
      });
    if (url.pathname !== "/solve") return json({ error: "Not found." }, 404);

    const source = url.searchParams.get("s");
    if (!source?.trim())
      return json({ error: "No script: pass it as ?s=<script>." }, 400);
    const result = await solve(
      source,
      "rest",
      request.headers.get("user-agent"),
    );
    return "states" in result ? json(result) : json(result, 413);
  },
};

function withCors(response: Response) {
  for (const [k, v] of Object.entries(CORS)) response.headers.set(k, v);
  return response;
}
