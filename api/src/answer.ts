/**
 * A solved script, as short as it can be read: an agent pays for every
 * token. Each state carries the properties a cycle is worked with (T, P, h,
 * s, x, v), their units said once; anything else is printed (`print cp2`).
 * REST answers it as JSON (`answer`), MCP as text (`asText`), a table a
 * model reads at a glance.
 */
import type { ScriptResult } from "../../src/dsl/evaluate";
import { formatQuantity } from "../../src/dsl/format";
import { fromSI, getDisplayUnit } from "../../src/lib/units";
import { SITE } from "../../src/links/links";

/** By their names in the script, with the coolprop-rs ones they convert by. */
const COLUMNS = [
  ["T", "temperature"],
  ["P", "pressure"],
  ["h", "enthalpy"],
  ["s", "entropy"],
  ["x", "quality"],
  ["v", "specific_volume"],
] as const;

type Column = (typeof COLUMNS)[number][0];

export type AnswerState = {
  name: string;
  /** Only when it is not the script's fluid. */
  fluid?: string;
  phase?: string;
  error?: string;
} & Partial<Record<Column, number>>;

export type Answer = {
  fluid: string | null;
  reference: string;
  units: Partial<Record<Column, string>>;
  states: AnswerState[];
  /** The print lines, or every value when the script prints none. */
  results: string[];
  errors?: { line: number; message: string }[];
  /** Opens the script solved, with its diagrams. */
  worksheet: string;
};

/** Five significant digits, as the tables of a textbook. */
const round = (x: number) => Number(x.toPrecision(5));

const unitLabel = (unit: string) =>
  unit.replace(/\*/g, "·").replace(/\^3/g, "³").replace(/\^2/g, "²");

/**
 * The Worksheet's address with the script: spaces as "+", not "%20", for a
 * shorter link (the Worksheet reads both). Tagged, so the site's analytics
 * count the visits answers bring.
 */
export const worksheetLink = (source: string) =>
  `${SITE}/worksheet/?${new URLSearchParams({
    s: source,
    utm_source: "thermoprops-api",
    utm_medium: "api",
  })}`;

export function answer(source: string, r: ScriptResult): Answer {
  const system = r.unitSystem;
  const units: Answer["units"] = {};
  for (const [column, name] of COLUMNS) {
    const unit = getDisplayUnit(name, system);
    if (unit) units[column] = unitLabel(unit);
  }
  const states = r.states.map((s) => {
    const out: AnswerState = { name: s.name };
    if (s.fluid && s.fluid !== r.fluid) out.fluid = s.fluid;
    if (s.state) {
      if (s.state.phase) out.phase = s.state.phase;
      for (const [column, name] of COLUMNS) {
        const si =
          name === "specific_volume" ? 1 / s.state.density : s.state[name];
        if (si !== null && Number.isFinite(si))
          out[column] = round(fromSI(name, si, system));
      }
    }
    if (s.error) out.error = s.error;
    return out;
  });
  const results = r.prints.length
    ? r.prints.map((p) =>
        p.value
          ? `${p.text} = ${formatQuantity(p.value, system, p.unit)}`
          : `${p.text}: ${p.error}`,
      )
    : r.values.flatMap((v) =>
        v.value
          ? [`${v.name} = ${formatQuantity(v.value, system, v.unit)}`]
          : [],
      );
  return {
    fluid: r.fluid ?? null,
    reference: r.reference,
    units,
    states,
    results,
    ...(r.diagnostics.length && {
      errors: r.diagnostics.map((d) => ({ line: d.line, message: d.message })),
    }),
    worksheet: worksheetLink(source),
  };
}

/** The answer as a model reads it best: a table, its results, its link. */
export function asText(a: Answer): string {
  const lines = [`${a.fluid ?? "No fluid"}, reference ${a.reference}`];
  const solved = a.states.filter((s) => s.T !== undefined);
  if (solved.length) {
    const mixed = solved.some((s) => s.fluid);
    const head = COLUMNS.map(([c]) => (a.units[c] ? `${c} ${a.units[c]}` : c));
    lines.push(
      ["state", ...(mixed ? ["fluid"] : []), "phase", ...head].join(" | "),
    );
    for (const s of solved)
      lines.push(
        [
          s.name,
          ...(mixed ? [s.fluid ?? a.fluid] : []),
          s.phase ?? "",
          ...COLUMNS.map(([c]) => s[c] ?? ""),
        ].join(" | "),
      );
  }
  lines.push(...a.results);
  if (a.errors) {
    lines.push("Errors (fix the line and call again):");
    for (const e of a.errors) lines.push(`line ${e.line}: ${e.message}`);
  }
  lines.push(`Open it solved, with p-h and T-s diagrams: ${a.worksheet}`);
  return lines.join("\n");
}
