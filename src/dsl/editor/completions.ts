/**
 * Completions by where the caret is: statements at the start of a line,
 * properties after "1.", processes after "->", fluids after `fluid` or "[",
 * units after a number, states, variables and functions in expressions.
 * Values from the last evaluation show next to states and variables.
 */
import {
  snippetCompletion,
  type Completion,
  type CompletionContext,
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
  UNIT_SYSTEMS,
} from "../vocabulary";
import { propertyValue, stateSummary } from "./describe";

export type CompletionData = {
  result?: ScriptResult;
  fluids: readonly FluidData[];
};

/** States and variables the document defines, valid or not yet solved. */
export function definedNames(doc: string): {
  states: string[];
  vars: string[];
} {
  const states = new Set<string>();
  const vars = new Set<string>();
  for (const line of doc.split("\n")) {
    const s = /^\s*state\s+(\w+)/.exec(line);
    if (s) states.add(s[1]);
    const v = /^\s*let\s+([A-Za-z_]\w*)/.exec(line);
    if (v) vars.add(v[1]);
  }
  return { states: [...states], vars: [...vars] };
}

function stateOptions(data: CompletionData, names: string[]): Completion[] {
  return names.map((name) => {
    const st = data.result?.states.find((s) => s.name === name);
    return {
      label: name,
      type: "class",
      detail: st?.state ? stateSummary(st, data.result!.unitSystem) : "state",
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
        : "variable",
      boost: 1,
    };
  });
}

export function scriptCompletions(get: () => CompletionData): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    const data = get();
    const line = context.state.doc.lineAt(context.pos);
    const before = line.text.slice(0, context.pos - line.from);
    if (/(^|[^"])#/.test(before.replace(/"[^"]*"/g, ""))) return null;
    const keyword = /^\s*(\w+)/.exec(before)?.[1];
    const { states, vars } = definedNames(context.state.doc.toString());
    let m: RegExpExecArray | null;

    // Statement keywords at the start of a line.
    if ((m = /^\s*([A-Za-z]*)$/.exec(before))) {
      if (!m[1] && !context.explicit) return null;
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

    // Fluids: "fluid R1", "state 5 [Wa".
    if (
      (m = /^\s*fluid\s+"?([\w-]*)$/.exec(before)) ||
      (keyword === "state" && (m = /\[\s*"?([\w-]*)$/.exec(before)))
    ) {
      return {
        from: context.pos - m[1].length,
        options: data.fluids.map((f) => ({
          label: f.name,
          type: "constant",
          detail: f.formula ?? undefined,
          info: f.aliases.length ? `Also: ${f.aliases.join(", ")}` : undefined,
        })),
        validFor: /^[\w-]*$/,
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

    // A process, after "state 2 = 1 ->".
    if (keyword === "state" && (m = /->\s*([A-Za-z]*)$/.exec(before))) {
      return {
        from: context.pos - m[1].length,
        options: PROCESSES.map((p) =>
          snippetCompletion(p.snippet, {
            label: p.name,
            detail: p.detail,
            info: p.info,
            type: "function",
          }),
        ),
      };
    }

    // States: "cycle 1 -> ", "state 2 = ".
    if (
      (keyword === "cycle" && (m = /(?:cycle|->)\s*(\w*)$/.exec(before))) ||
      (keyword === "state" && (m = /^\s*state\s+\w+\s*=\s*(\w*)$/.exec(before)))
    ) {
      return {
        from: context.pos - m[1].length,
        options: stateOptions(data, states),
      };
    }

    // A unit after a number: "25 °", "1.2 M".
    if (
      (m =
        /(?:^|[^\w.])\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\s*([°%A-Za-z][\w/^*()]*|)$/.exec(
          before,
        ))
    ) {
      if (m[1] || (context.explicit && /\s$/.test(before))) {
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
      return null;
    }

    // Property names on the left of "=" in a state's pair or process.
    if (keyword === "state" && (m = /[:(,]\s*([A-Za-z]*)$/.exec(before))) {
      const inProcess = before.includes("(") && !before.includes(")");
      const options: Completion[] = PROPERTIES.filter((p) => p.input).map(
        (p) => ({
          label: p.name,
          apply: `${p.name} = `,
          type: "property",
          detail: p.detail,
          info: p.info,
        }),
      );
      if (inProcess) {
        options.push(
          {
            label: "eta",
            apply: "eta = ",
            type: "property",
            detail: "efficiency",
            info: "Isentropic efficiency, for compress and expand.",
          },
          {
            label: "n",
            apply: "n = ",
            type: "property",
            detail: "exponent",
            info: "Polytropic exponent, for polytropic.",
          },
        );
      }
      return { from: context.pos - m[1].length, options };
    }

    // Values in expressions.
    if (
      (m = /(?:^|[\s=+\-*/^(,])([A-Za-z_]\w*)$/.exec(before)) ||
      context.explicit
    ) {
      const word = m?.[1] ?? "";
      if (!word && !context.explicit) return null;
      return {
        from: context.pos - word.length,
        options: [
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
