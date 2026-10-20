/**
 * Completions by where the caret is: statements at the start of a line,
 * a state's clauses (properties, "from", processes, "sat vapor"), properties
 * after "1.", fluids after `fluid` or "[", units after a number or "in",
 * states, values ("h1") and functions in expressions.
 * Values from the last evaluation show next to states and variables.
 */
import type { EditorState } from "@codemirror/state";
import {
  CompletionContext,
  snippetCompletion,
  type Completion,
  type CompletionResult,
  type CompletionSource,
} from "@codemirror/autocomplete";
import type { FluidData } from "@luisbedoia/coolprop-rs-wasm";
import type { ScriptResult } from "../evaluate";
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
import { PROCESSES as PROCESS_NAMES } from "../parser";
import { propertyValue, stateSummary } from "./describe";
import { tr } from "../../i18n";

export type CompletionData = {
  result?: ScriptResult;
  fluids: readonly FluidData[];
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
export function definedNames(doc: string): {
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
  apply: string,
  detail: string,
  type = "keyword",
  info?: string,
): Completion => ({ label, apply, detail, type, info });

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
    // ("print |" goes on to what there is to print, as after its commas.)
    if ((m = /^\s*(\w+)(\s*)$/.exec(before)) && !/^\s*print\s+$/.test(before)) {
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

    // Fluids: "fluid R1", "5 [Wa".
    if (
      (m = /^\s*fluid\s+"?([\w-]*)$/.exec(before)) ||
      (m = /^\s*(?:state\s+)?\w+\s*\[\s*"?([\w-]*)$/.exec(before))
    ) {
      return {
        from: context.pos - m[1].length,
        options: data.fluids.map((f) => ({
          label: f.name,
          type: "constant",
          detail: plainFormula(f.formula),
          info:
            [
              f.display_name !== f.name ? f.display_name : null,
              f.aliases.length
                ? `${tr("Also", "También")}: ${f.aliases.join(", ")}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || undefined,
        })),
        validFor: /^[\w-]*$/,
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
          option(",", ", ", tr("then the process", "luego el proceso")),
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
            option("from", "from ", tr("starting state", "estado inicial")),
          );
        return { from: context.pos - m[2].length, options };
      }
      if ((m = /\bto\s+([A-Za-z]*)$/.exec(before))) {
        return { from: context.pos - m[1].length, options: inputOptions() };
      }
      // A clause: "1: |", ", |".
      if ((m = /[:,]\s*([A-Za-z]*)$/.exec(before))) {
        const options: Completion[] = [];
        if (process) {
          if (process === "compressed" || process === "expanded")
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
          if (process === "polytropic")
            options.push(
              option(
                "n",
                "n = ",
                tr("exponent", "exponente"),
                "property",
                tr("Polytropic exponent.", "Exponente politrópico."),
              ),
            );
          options.push(...inputOptions());
        } else if (hasFrom) {
          options.push(...processOptions(), ...inputOptions());
        } else {
          // The common ones first: the chips show only the first few.
          const inputs = inputOptions();
          options.push(
            option(
              "from",
              "from ",
              tr("reached by a process", "alcanzado por un proceso"),
            ),
            ...inputs.slice(0, 2),
            ...SATURATED,
            ...inputs.slice(2),
          );
        }
        return { from: context.pos - m[1].length, options };
      }
    }

    // "print T2 in |": the unit to show it in.
    if (kind === "print") {
      if ((m = /\bin\s+([°%A-Za-z][\w/^*()]*|)$/.exec(before))) {
        return {
          from: context.pos - m[1].length,
          options: COMMON_UNITS.map((u, i) => ({
            label: u.name,
            type: "unit",
            detail: u.detail,
            boost: -i / 100,
          })),
          validFor: /^[°%\w/^*()]*$/,
        };
      }
      if (
        context.explicit &&
        /[\w)]\s+$/.test(before) &&
        !/\bprint\s+$/.test(before)
      ) {
        return {
          from: context.pos,
          options: [
            option("in", "in ", tr("show in a unit", "mostrar en una unidad")),
            option(",", ", ", tr("another output", "otra salida")),
          ],
        };
      }
    }

    // A unit after a number: "25 °", "1.2 M".
    if (
      (m =
        /(?:^|[^\w.])\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\s*([°%A-Za-z][\w/^*()]*|)$/.exec(
          before,
        ))
    ) {
      if (m[1] || context.explicit) {
        // Right after the digits, a unit comes with its space: "25 °C".
        const glued = !m[1] && /\d$/.test(before);
        return {
          from: context.pos - m[1].length,
          options: COMMON_UNITS.map((u, i) => ({
            label: u.name,
            apply: glued && u.name !== "%" ? ` ${u.name}` : u.name,
            type: "unit",
            detail: u.detail,
            boost: -i / 100,
          })),
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
  const options = r.options
    .filter((o) => {
      const label = o.label.toLowerCase();
      return !typed || (label.startsWith(typed) && label !== typed);
    })
    .sort((a, b) => (b.boost ?? 0) - (a.boost ?? 0))
    .slice(0, limit);
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
