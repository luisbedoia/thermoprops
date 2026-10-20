/**
 * Completions by where the caret is: statements at the start of a line,
 * a state's clauses (properties that fix it with those already given,
 * "from", processes, "sat vapor"), properties after "1.", fluids after
 * `fluid` or "[" (by name, alias or display name), units after a number or
 * "in" (those of the quantity, the script's unit system's first), states,
 * values ("h1") and functions in expressions.
 * Values from the last evaluation show next to states and variables.
 */
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import {
  CompletionContext,
  snippetCompletion,
  startCompletion,
  type Completion,
  type CompletionResult,
  type CompletionSource,
} from "@codemirror/autocomplete";
import type { FluidData, InputName } from "@luisbedoia/coolprop-rs-wasm";
import {
  PROPERTY_ALIASES,
  textbookProperty,
  type ScriptResult,
} from "../evaluate";
import { formatQuantity } from "../format";
import {
  COMMON_UNITS,
  FUNCTIONS,
  KEYWORDS,
  PROCESSES,
  PROPERTIES,
  REFERENCE_STATES,
  STATEMENT_KEYWORDS,
  UNIT_SYSTEMS,
} from "../vocabulary";
import { PROCESSES as PROCESS_NAMES, parse, type Expr } from "../parser";
import {
  NONE,
  PROPERTY_DIM,
  UNITS,
  dimEq,
  dimMul,
  dimPow,
  displayKind,
  type Dim,
} from "../units";
import {
  DEFAULT_UNIT_SYSTEM,
  isUnitSystem,
  systemUnit,
  type UnitSystem,
} from "../../lib/units";
import { propertyValue, stateSummary } from "./describe";
import { tr } from "../../i18n";

export type CompletionData = {
  result?: ScriptResult;
  fluids: readonly FluidData[];
  /** Pairs of inputs that fix a state; without them, any two do. */
  pairs?: readonly (readonly [InputName, InputName])[];
};

/** "state", "value", a statement keyword, or null for a line not yet clear. */
export function lineKind(line: string): string | null {
  const keyword = /^\s*(\w+)\b/.exec(line)?.[1];
  if (keyword && STATEMENT_KEYWORDS.includes(keyword)) return keyword;
  if (/^\s*\w+\s*(\[[^\]]*\]?\s*)?:/.test(line)) return "state";
  if (/^\s*\w+\s*\[/.test(line)) return "state";
  if (/^\s*[A-Za-z_]\w*\s*=/.test(line)) return "value";
  return null;
}

/** States and values the document defines, valid or not yet solved. */
function definedNames(doc: string): {
  states: string[];
  vars: string[];
} {
  const states = new Set<string>();
  const vars = new Set<string>();
  for (const line of doc.split("\n")) {
    const kind = lineKind(line);
    const name = /^\s*(\w+)/.exec(line)?.[1];
    if (!name) continue;
    if (kind === "state") states.add(name);
    if (kind === "value" && /^[A-Za-z_]/.test(name)) vars.add(name);
  }
  return { states: [...states], vars: [...vars] };
}

function stateOptions(data: CompletionData, names: string[]): Completion[] {
  return names.map((name) => {
    const st = data.result?.states.find((s) => s.name === name);
    return {
      label: name,
      type: "class",
      detail: st?.state
        ? stateSummary(st, data.result!.unitSystem)
        : tr("state", "estado"),
      boost: 2,
    };
  });
}

function varOptions(data: CompletionData, names: string[]): Completion[] {
  return names.map((name) => {
    const v = data.result?.values.find((x) => x.name === name);
    return {
      label: name,
      type: "variable",
      detail: v?.value
        ? `= ${formatQuantity(v.value, data.result!.unitSystem)}`
        : tr("variable", "variable"),
      boost: 1,
    };
  });
}

const option = (
  label: string,
  apply: Completion["apply"],
  detail: string,
  type = "keyword",
  info?: string,
): Completion => ({ label, apply, detail, type, info });

/**
 * Writes `text`, then offers what comes after it ("in " → units, "from " →
 * states): CodeMirror does not suggest again after a completion by itself.
 * Not with the page's keypad (no system keyboard, `inputmode="none"`), whose
 * suggestions follow the caret anyway.
 */
const thenSuggest =
  (text: string) =>
  (view: EditorView, _: Completion, from: number, to: number) => {
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
      userEvent: "input.complete",
    });
    if (view.contentDOM.getAttribute("inputmode") !== "none")
      startCompletion(view);
  };

const processOptions = () =>
  PROCESSES.map((p) =>
    snippetCompletion(p.snippet, {
      label: p.name,
      detail: p.detail,
      info: p.info,
      type: "function",
    }),
  );

const inputOptions = (prefix = ""): Completion[] =>
  PROPERTIES.filter((p) => p.input).map((p) => ({
    label: `${prefix}${p.name}`,
    apply: `${prefix}${p.name} = `,
    type: "property",
    detail: p.detail,
    info: p.info,
  }));

const SATURATED = [
  option("sat vapor", "sat vapor", "x = 1"),
  option("sat liquid", "sat liquid", "x = 0"),
];

/** The input a state property fixes, as coolprop-rs names it (v as D). */
function inputOf(name: string): InputName | null {
  const field = PROPERTY_ALIASES[name];
  if (field === "specific_volume") return "density";
  return INPUT_FIELDS.has(field) ? (field as InputName) : null;
}

const INPUT_FIELDS = new Set<string>(
  PROPERTIES.filter((p) => p.input && p.field !== "specific_volume").map(
    (p) => p.field,
  ),
);

/** The unit system a script is written in: its `units` line, else the default. */
function scriptUnits(doc: string): UnitSystem {
  const name = /^\s*units\s+(\w+)/m.exec(doc)?.[1];
  return isUnitSystem(name) ? name : DEFAULT_UNIT_SYSTEM;
}

/** Spellings of a unit that only repeat another ("degC" of "°C"). */
const UNIT_ALIASES = new Set([
  "degC",
  "degF",
  "kg/m3",
  "m3/kg",
  "kJ/kgK",
  "m2",
  "m3",
  "psia",
]);

/**
 * Units after a number or "in": those of `dim` when it is known, the unit
 * system's own (`own`) first, then the common ones; any common one when it
 * is not. `glued`: right after the digits, so each comes with its space.
 */
function unitOptions(
  dim: Dim | null,
  own: string | null,
  glued: boolean,
): Completion[] {
  const common = (name: string) =>
    COMMON_UNITS.findIndex((u) => u.name === name);
  const names = dim
    ? Object.keys(UNITS)
        .filter((u) => !UNIT_ALIASES.has(u) && dimEq(UNITS[u].dim, dim))
        .sort((a, b) => {
          const rank = (u: string) =>
            u === own ? -1 : common(u) < 0 ? COMMON_UNITS.length : common(u);
          return rank(a) - rank(b);
        })
    : COMMON_UNITS.map((u) => u.name);
  return names.map((name, i) => ({
    label: name,
    apply: glued && name !== "%" ? ` ${name}` : name,
    type: "unit",
    detail:
      name === own
        ? tr("the unit system's", "la del sistema de unidades")
        : (COMMON_UNITS.find((u) => u.name === name)?.detail ?? ""),
    boost: -i / 100,
  }));
}

/**
 * What a printed expression measures: as the last evaluation printed it, or
 * worked out from its parts ("w_1 - w_2", "m * (h1 - h2)") without solving
 * anything. Null when a part is unknown.
 */
function printedDim(
  expr: string,
  data: CompletionData,
  doc: string,
): Dim | null {
  const printed = data.result?.prints.find((p) => p.text === expr)?.value;
  if (printed) return printed.dim;
  const parsed = parse(`print ${expr}`).statements[0];
  if (parsed?.kind !== "print" || parsed.items.length !== 1) return null;
  // The script's values, by their definitions: for those not evaluated yet.
  const defined = new Map<string, Expr>();
  for (const st of parse(doc).statements)
    if (st.kind === "value") defined.set(st.name, st.expr);
  return exprDim(parsed.items[0].expr, data, defined, new Set());
}

/** The dimension of a property read from a state ("h", "T"), if any. */
function propertyDim(prop: string): Dim | null {
  const field = PROPERTY_ALIASES[prop];
  return field ? (PROPERTY_DIM[field] ?? null) : null;
}

/** `e`'s dimension, as the evaluator would find it (evaluate.ts). */
function exprDim(
  e: Expr,
  data: CompletionData,
  defined: Map<string, Expr>,
  seen: Set<string>,
): Dim | null {
  const dim = (x: Expr) => exprDim(x, data, defined, seen);
  switch (e.kind) {
    case "num":
      return e.unit ? (UNITS[e.unit]?.dim ?? null) : NONE;
    case "prop":
      return propertyDim(e.prop);
    case "neg":
      return dim(e.arg);
    case "var": {
      const value = data.result?.values.find((v) => v.name === e.name)?.value;
      if (value) return value.dim;
      const definition = defined.get(e.name);
      if (definition && !seen.has(e.name)) {
        seen.add(e.name);
        return dim(definition);
      }
      // "h1": state 1's h.
      const tb = textbookProperty(e.name);
      return tb ? propertyDim(tb.prop) : null;
    }
    case "bin": {
      const a = dim(e.left);
      if (e.op === "^") {
        if (e.right.kind !== "num" || e.right.unit) return a && NONE;
        return a && dimPow(a, e.right.value);
      }
      const b = dim(e.right);
      // A sum is of its terms' dimension: the one known will do.
      if (e.op === "+" || e.op === "-") return a ?? b;
      return a && b && dimMul(a, b, e.op === "*" ? 1 : -1);
    }
    case "call": {
      const a = e.args[0] ? dim(e.args[0]) : null;
      if (e.fn === "ln" || e.fn === "exp") return NONE;
      if (e.fn === "sqrt") return a && dimPow(a, 0.5);
      return a;
    }
  }
}

/**
 * The unit `dim` is shown in by default in `system`: a state property's
 * (°C, kPa, BTU/lbm), or the one of a derived quantity (kW, kJ).
 */
function ownUnit(dim: Dim | null, system: UnitSystem): string | null {
  const kind = dim && displayKind(dim);
  if (!kind) return null;
  if ("property" in kind) return systemUnit(kind.property, system);
  return kind.unit in UNITS ? kind.unit : null;
}

/** Letters and digits only, without accents or case: "R-410A" as "r410a". */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/**
 * The fluids `typed` may name, by canonical name, alias ("CO2") or display
 * name ("agua"), best first: names that start with it, then aliases, then
 * display names, then any that contain it. Each inserts its canonical name.
 */
function fluidOptions(fluids: readonly FluidData[], typed: string) {
  const q = fold(typed);
  const rank = (f: FluidData) => {
    if (fold(f.name).startsWith(q)) return 0;
    if (f.aliases.some((a) => fold(a).startsWith(q))) return 1;
    if (fold(f.display_name ?? "").startsWith(q)) return 2;
    const all = [f.name, ...f.aliases, f.display_name ?? ""].map(fold);
    return all.some((n) => n.includes(q)) ? 3 : -1;
  };
  return fluids
    .map((f) => ({ f, r: rank(f) }))
    .filter(({ r }) => r >= 0)
    .sort((a, b) => a.r - b.r)
    .map(({ f }): Completion => ({
      label: f.name,
      type: "constant",
      detail:
        f.display_name && f.display_name !== f.name
          ? f.display_name
          : plainFormula(f.formula),
      info:
        [
          f.display_name && f.display_name !== f.name
            ? plainFormula(f.formula)
            : null,
          f.aliases.length
            ? `${tr("Also", "También")}: ${f.aliases.join(", ")}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
    }));
}

export function scriptCompletions(get: () => CompletionData): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    const data = get();
    const line = context.state.doc.lineAt(context.pos);
    const before = line.text.slice(0, context.pos - line.from);
    if (/(^|[^"])#/.test(before.replace(/"[^"]*"/g, ""))) return null;
    const kind = lineKind(line.text);
    const { states, vars } = definedNames(context.state.doc.toString());
    let m: RegExpExecArray | null;

    // The start of a line: a statement, or what follows a name.
    if ((m = /^\s*([A-Za-z]*)$/.exec(before))) {
      if (!m[1] && !context.explicit) return null;
      const typed = m[1].toLowerCase();
      if (
        !typed ||
        KEYWORDS.some((k) => k.name.startsWith(typed) && k.name !== typed)
      ) {
        return {
          from: context.pos - m[1].length,
          options: KEYWORDS.map((k) =>
            snippetCompletion(k.snippet, {
              label: k.name,
              detail: k.detail,
              info: k.info,
              type: "keyword",
            }),
          ),
        };
      }
    }
    // After a name at the start of a line: "1", "inlet", "COP".
    // ("print |" goes on to what there is to print, as after its commas;
    // "fluid |", "units |", "reference |", "draw |" to what each takes.)
    const keywordSpace =
      (m = /^\s*(\w+)\s+$/.exec(before)) && STATEMENT_KEYWORDS.includes(m[1]);
    if (
      !keywordSpace &&
      (m = /^\s*(\w+)(\s*)$/.exec(before)) &&
      !/^\s*print\s+$/.test(before)
    ) {
      if (!context.explicit || STATEMENT_KEYWORDS.includes(m[1])) return null;
      const gap = m[2] ? "" : " ";
      const options = [option(":", ": ", tr("a state", "un estado"))];
      if (/^[A-Za-z_]/.test(m[1]))
        options.push(option("=", `${gap}= `, tr("a value", "un valor")));
      return { from: context.pos, options };
    }

    // Properties of a state: "1.", "2s.h" (but "1." of "1.5" without a state 1).
    if ((m = /(\w+)\.([A-Za-z]*)$/.exec(before)) && states.includes(m[1])) {
      const st = data.result?.states.find((s) => s.name === m![1]);
      return {
        from: context.pos - m[2].length,
        options: PROPERTIES.map((p) => {
          const value = st?.state
            ? propertyValue(st, p.field, data.result!.unitSystem)
            : undefined;
          return {
            label: p.name,
            type: "property",
            detail: value ?? p.detail,
            info: p.info,
            boost: p.input ? 1 : 0,
          };
        }),
        validFor: /^[A-Za-z]*$/,
      };
    }

    // Fluids: "fluid R1", "5 [Wa", "fluid co2" (an alias), "fluid agua".
    if (
      (m = /^\s*fluid\s+"?([\w\-()]*)$/.exec(before)) ||
      (m = /^\s*(?:state\s+)?\w+\s*\[\s*"?([\w\-()]*)$/.exec(before))
    ) {
      // Filtered here (by aliases too), and again as each letter is typed.
      return {
        from: context.pos - m[1].length,
        options: fluidOptions(data.fluids, m[1]),
        filter: false,
      };
    }

    if ((m = /^\s*reference\s+(\w*)$/.exec(before))) {
      return {
        from: context.pos - m[1].length,
        options: REFERENCE_STATES.map((r) => ({
          label: r.name,
          type: "constant",
          detail: r.detail,
          info: r.info,
        })),
      };
    }

    if ((m = /^\s*units\s+(\w*)$/.exec(before))) {
      return {
        from: context.pos - m[1].length,
        options: UNIT_SYSTEMS.map((u) => ({
          label: u.name,
          type: "constant",
          detail: u.detail,
          info: u.info,
        })),
      };
    }

    // "2: from 1|": on to the process.
    if (
      kind === "state" &&
      context.explicit &&
      (m = /\bfrom\s+(\w+)\s*$/.exec(before)) &&
      states.includes(m[1])
    ) {
      return {
        from: context.pos,
        options: [
          option(
            ",",
            thenSuggest(", "),
            tr("then the process", "luego el proceso"),
          ),
        ],
      };
    }

    // States: "draw 1 -> ", "from ".
    if (
      (kind === "draw" && (m = /(?:draw|->)\s*(\w*)$/.exec(before))) ||
      (kind === "state" && (m = /\bfrom\s+(\w*)$/.exec(before)))
    ) {
      // Not the state the line defines: it cannot start from itself.
      const own =
        kind === "state" ? /^\s*(\w+)/.exec(line.text)?.[1] : undefined;
      return {
        from: context.pos - m[1].length,
        options: stateOptions(
          data,
          states.filter((n) => n !== own),
        ),
      };
    }

    if (kind === "state") {
      const code = line.text.replace(/#.*/, "");
      const hasFrom = /\bfrom\b/.test(code);
      const process = PROCESS_NAMES.find((p) =>
        new RegExp(`\\b${p}\\b`).test(code),
      );
      if ((m = /\b(?:sat|saturated)\s+([A-Za-z]*)$/.exec(before))) {
        return {
          from: context.pos - m[1].length,
          options: [
            option("vapor", "vapor", "x = 1", "constant"),
            option("liquid", "liquid", "x = 0", "constant"),
          ],
        };
      }
      // "compressed |": where it starts, then where it goes.
      if (
        (m = /\b(\w+)\s+([A-Za-z]*)$/.exec(before)) &&
        PROCESS_NAMES.includes(m[1])
      ) {
        const options = inputOptions("to ");
        if (!hasFrom)
          options.unshift(
            option(
              "from",
              thenSuggest("from "),
              tr("starting state", "estado inicial"),
            ),
          );
        return { from: context.pos - m[2].length, options };
      }
      if ((m = /\bto\s+([A-Za-z]*)$/.exec(before))) {
        return { from: context.pos - m[1].length, options: inputOptions() };
      }
      // A clause: "1: |", ", |".
      if ((m = /[:,]\s*([A-Za-z]*)$/.exec(before))) {
        const options: Completion[] = [];
        // What the line already says, but the word being typed.
        const said = (
          code.slice(0, before.length - m[1].length) +
          code.slice(before.length).replace(/^\w*/, "")
        ).replace(/^\s*\w+\s*(\[[^\]]*\]\s*)?:/, "");
        const given = [...said.matchAll(/\b([A-Za-z_]\w*)\s*=/g)].map(
          (g) => g[1],
        );
        if (process) {
          const aimed = /\bto\s+\w+\s*=/.test(said);
          if (
            (process === "compressed" || process === "expanded") &&
            !given.includes("eta")
          )
            options.push(
              option(
                "eta",
                "eta = ",
                tr("efficiency", "eficiencia"),
                "property",
                tr(
                  "Isentropic efficiency, e.g. 80%.",
                  "Eficiencia isentrópica, p. ej. 80%.",
                ),
              ),
            );
          if (process === "polytropic" && !given.includes("n"))
            options.push(
              option(
                "n",
                "n = ",
                tr("exponent", "exponente"),
                "property",
                tr("Polytropic exponent.", "Exponente politrópico."),
              ),
            );
          // Once aimed ("to P = ..."), only its own parameters are left.
          if (!aimed) options.push(...inputOptions());
        } else if (hasFrom) {
          options.push(...processOptions(), ...inputOptions());
        } else {
          // The properties that fix the state with those already given; the
          // common ones first: the chips show only the first few.
          const fixed = given.map(inputOf).filter((i) => i !== null);
          if (/\bsat(urated)?\s+(liquid|vapou?r)\b/.test(said))
            fixed.push("quality");
          if (fixed.length >= 2) return null;
          const fits = (input: InputName | null) =>
            input !== null &&
            !fixed.includes(input) &&
            (fixed.length === 0 ||
              !data.pairs ||
              data.pairs.some(
                ([a, b]) =>
                  (a === fixed[0] && b === input) ||
                  (b === fixed[0] && a === input),
              ));
          const inputs = inputOptions().filter((o) => fits(inputOf(o.label)));
          options.push(
            ...(fixed.length === 0
              ? [
                  option(
                    "from",
                    thenSuggest("from "),
                    tr("reached by a process", "alcanzado por un proceso"),
                  ),
                ]
              : []),
            ...inputs.slice(0, 2),
            ...(fits("quality") ? SATURATED : []),
            ...inputs.slice(2),
          );
        }
        if (options.length === 0) return null;
        return { from: context.pos - m[1].length, options };
      }
    }

    // "print T2 in |": the unit to show it in.
    if (kind === "print") {
      if ((m = /\bin\s+([°%A-Za-z][\w/^*()]*|)$/.exec(before))) {
        // The units of what is printed ("print T2 in |": temperatures).
        // A dimensionless one in % ("print efficiency in %").
        // The output being written: after "print", or the last comma.
        const item = before.slice(before.lastIndexOf(",") + 1);
        const expr = /^\s*(?:print\s+)?(.+?)\s+in\s+\S*$/.exec(item)?.[1];
        const dim = expr
          ? printedDim(expr.trim(), data, context.state.doc.toString())
          : null;
        const own = ownUnit(dim, scriptUnits(context.state.doc.toString()));
        return {
          from: context.pos - m[1].length,
          options: unitOptions(dim, own, false),
          validFor: /^[°%\w/^*()]*$/,
        };
      }
      // After what is printed: "in" (as "i" is typed, or when asked), or
      // another output.
      if (
        (m = /[\w)]\s+(in?|)$/.exec(before)) &&
        !/\bprint\s+\w*$/.test(before) &&
        (m[1] || context.explicit)
      ) {
        return {
          from: context.pos - m[1].length,
          options: [
            option(
              "in",
              thenSuggest("in "),
              tr("show in a unit", "mostrar en una unidad"),
            ),
            option(",", ", ", tr("another output", "otra salida")),
          ],
        };
      }
    }

    // A unit after a number: "25 °", "1.2 M". In a state, those of its
    // property ("P = 100 |": pressures, the unit system's first).
    if (
      (m =
        /(?:^|[^\w.])\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\s*([°%A-Za-z][\w/^*()]*|)$/.exec(
          before,
        ))
    ) {
      const lhs =
        kind === "state"
          ? /\b([A-Za-z_]\w*)\s*=\s*-?\s*\d[\d.eE+-]*\s*[°%\w/^*()]*$/.exec(
              before,
            )?.[1]
          : undefined;
      const field = lhs ? PROPERTY_ALIASES[lhs] : undefined;
      const dim =
        lhs === "eta" ? NONE : field ? (PROPERTY_DIM[field] ?? null) : null;
      // After the number's space the list opens by itself, for a quantity
      // with units: Enter then writes the unit system's own, the same value.
      const spaced = dim !== null && !dimEq(dim, NONE) && /\d\s+$/.test(before);
      if (m[1] || context.explicit || spaced) {
        // Right after the digits, a unit comes with its space: "25 °C".
        const glued = !m[1] && /\d$/.test(before);
        const own = field
          ? systemUnit(field, scriptUnits(context.state.doc.toString()))
          : null;
        const options = unitOptions(dim, own, glued);
        if (options.length === 0) return null;
        return {
          from: context.pos - m[1].length,
          options,
          validFor: /^[°%\w/^*()]*$/,
        };
      }
      return null;
    }

    // Values in expressions.
    if (
      (m = /(?:^|[\s=+\-*/^(,])([A-Za-z_]\w*)$/.exec(before)) ||
      context.explicit
    ) {
      const word = m?.[1] ?? "";
      if (!word && !context.explicit) return null;
      // "P = |": the same property of each state first (P1, P2, ...).
      const lhs = /\b([A-Za-z]+)\s*=\s*$/.exec(before)?.[1];
      const same = PROPERTIES.some((p) => p.name === lhs)
        ? textbookOptions(data, states, lhs)
        : [];
      return {
        from: context.pos - word.length,
        options: [
          ...(word ? textbookOptions(data, states) : same),
          ...varOptions(data, vars),
          ...stateOptions(data, states).map((o) => ({
            ...o,
            apply: `${o.label}.`,
          })),
          ...FUNCTIONS.map((f) =>
            snippetCompletion(f.snippet, {
              label: f.name,
              detail: f.detail,
              info: f.info,
              type: "function",
            }),
          ),
        ],
        validFor: /^\w*$/,
      };
    }
    return null;
  };
}

/** "h1", "T2s": each state's properties, as the textbooks write them. */
function textbookOptions(
  data: CompletionData,
  names: string[],
  only?: string,
): Completion[] {
  const system = data.result?.unitSystem;
  return names
    .filter((n) => /^\d/.test(n))
    .flatMap((name) => {
      const st = data.result?.states.find((s) => s.name === name);
      return PROPERTIES.filter((p) =>
        only ? p.name === only : p.name !== "D",
      ).map((p) => ({
        label: `${p.name}${name}`,
        type: "property",
        detail:
          (st?.state && system && propertyValue(st, p.field, system)) ||
          tr(`${p.detail} of ${name}`, `${p.detail} de ${name}`),
        boost: p.input ? 3 : 2.5,
      }));
    });
}

/** What the keypad offers at the caret: the completions, as they stand. */
export type Suggestions = { from: number; to: number; options: Completion[] };

/** The completions at the caret, filtered by what is typed, best first. */
export function suggestionsAt(
  state: EditorState,
  source: CompletionSource,
  limit = 16,
): Suggestions | null {
  const pos = state.selection.main.head;
  if (!state.selection.main.empty) return null;
  const r = source(new CompletionContext(state, pos, true));
  if (!r || r instanceof Promise) return null;
  const typed = state.sliceDoc(r.from, pos).toLowerCase();
  // A source that filters its own options (fluids, by alias too) keeps them.
  const options = (
    r.filter === false
      ? r.options.filter((o) => o.label.toLowerCase() !== typed)
      : r.options
          .filter((o) => {
            const label = o.label.toLowerCase();
            return !typed || (label.startsWith(typed) && label !== typed);
          })
          .sort((a, b) => (b.boost ?? 0) - (a.boost ?? 0))
  ).slice(0, limit);
  return options.length ? { from: r.from, to: pos, options } : null;
}

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

/**
 * A formula as CoolProp writes it for LaTeX ("C_{2}F_{4}H_{2}") in plain
 * text, with subscript digits and no 1s: "C₂F₄H₂", "H₂O".
 */
export function plainFormula(formula: string | null | undefined) {
  if (!formula) return undefined;
  return formula
    .replace(/[$\\]/g, "")
    .replace(/_\{(\d+)\}/g, (_, n: string) =>
      n === "1" ? "" : [...n].map((d) => SUBSCRIPTS[Number(d)]).join(""),
    );
}
