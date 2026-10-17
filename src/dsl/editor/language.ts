/**
 * Syntax highlighting of the script language for CodeMirror: a line-based
 * stream tokenizer that knows each statement's shape, so it can tell a state
 * being defined from one being read, a process from a function, a unit from
 * a variable.
 */
import {
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
  type StringStream,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { PROCESSES, STATEMENT_KEYWORDS } from "../vocabulary";
import { UNIT_NAMES } from "../units";

type LineState = {
  /** The statement keyword of the current line. */
  stmt: string | null;
  /** Words seen on the line after the keyword. */
  words: number;
  /** The previous non-space token, for context. */
  prev: string | null;
  /** Inside [ ] of a state's fluid. */
  bracket: boolean;
  afterNumber: boolean;
};

const PROCESS_NAMES = new Set(PROCESSES.map((p) => p.name));
const KEYWORDS = new Set(STATEMENT_KEYWORDS);
const NUMBER = /^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/;

function unitAt(stream: StringStream): string | undefined {
  const rest = stream.string.slice(stream.pos);
  return UNIT_NAMES.find(
    (u) => rest.startsWith(u) && !/[A-Za-z0-9_]/.test(rest[u.length] ?? ""),
  );
}

function token(stream: StringStream, state: LineState): string | null {
  if (stream.sol()) {
    state.stmt = null;
    state.words = 0;
    state.prev = null;
    state.bracket = false;
    state.afterNumber = false;
  }
  if (stream.eatSpace()) return null;
  const afterNumber = state.afterNumber;
  state.afterNumber = false;

  if (stream.peek() === "#") {
    stream.skipToEnd();
    return "comment";
  }
  if (stream.peek() === '"') {
    stream.next();
    if (stream.skipTo('"')) stream.next();
    else stream.skipToEnd();
    state.prev = "string";
    return state.stmt === "fluid" || state.bracket ? "fluid" : "string";
  }
  if (afterNumber) {
    const unit = unitAt(stream);
    if (unit) {
      stream.pos += unit.length;
      state.prev = "unit";
      return "unit";
    }
  }

  const num = stream.match(NUMBER, false) as RegExpMatchArray | null;
  const glued =
    num && /[A-Za-z0-9_]/.test(stream.string[stream.pos + num[0].length] ?? "");
  const isNumber =
    num &&
    (!glued ||
      UNIT_NAMES.some((u) =>
        stream.string.slice(stream.pos + num[0].length).startsWith(u),
      ));
  const word = isNumber
    ? null
    : (stream.match(/^[A-Za-z0-9_]+/, false) as RegExpMatchArray | null);

  if (word) {
    const text = word[0];
    stream.pos += text.length;
    const prev = state.prev;
    state.prev = "word";
    const next = stream.string.slice(stream.pos).trimStart();
    if (state.stmt === null) {
      if (KEYWORDS.has(text)) {
        state.stmt = text;
        return "keyword";
      }
      return "invalid";
    }
    state.words++;
    if (prev === ".") return "property";
    if (state.stmt === "fluid" || state.bracket) return "fluid";
    if (state.stmt === "units") return "atom";
    if (state.stmt === "cycle") return "stateRef";
    if (state.stmt === "state" && state.words === 1) return "stateDef";
    if (state.stmt === "let" && state.words === 1) return "varDef";
    if (next.startsWith(".")) return "stateRef";
    if (next.startsWith("("))
      return PROCESS_NAMES.has(text) && prev === "->" ? "process" : "function";
    if (/^=(?!=)/.test(next) && (prev === ":" || prev === "," || prev === "("))
      return "property";
    // The starting state of a process: state 2 = 1 -> ...
    if (state.stmt === "state" && prev === "=" && next.startsWith("->"))
      return "stateRef";
    return /^\d/.test(text) ? "stateRef" : "variable";
  }

  if (isNumber && num) {
    stream.pos += num[0].length;
    const prev = state.prev;
    state.prev = "number";
    const next = stream.string.slice(stream.pos).trimStart();
    // "1.h" reads state 1; "state 1:" defines it; "cycle 1 -> 2" names them.
    if (
      stream.peek() === "." &&
      /[A-Za-z_]/.test(stream.string[stream.pos + 1] ?? "")
    ) {
      return "stateRef";
    }
    if (state.stmt === "state" && state.words === 0) {
      state.words++;
      return "stateDef";
    }
    if (state.stmt === "cycle") return "stateRef";
    if (state.stmt === "state" && prev === "=" && next.startsWith("->")) {
      return "stateRef";
    }
    state.afterNumber = true;
    return "number";
  }

  if (stream.match("->") || stream.match("→")) {
    state.prev = "->";
    return "arrow";
  }
  const c = stream.next()!;
  state.prev = c === "−" ? "-" : c === "×" ? "*" : c;
  if (c === "[") state.bracket = true;
  if (c === "]") state.bracket = false;
  if ("()[]".includes(c)) return "bracket";
  if (c === "." || c === "," || c === ":") return "punctuation";
  if ("=+-*/^−×".includes(c)) return "operator";
  return "invalid";
}

export const scriptLanguage = StreamLanguage.define<LineState>({
  name: "thermo-script",
  startState: () => ({
    stmt: null,
    words: 0,
    prev: null,
    bracket: false,
    afterNumber: false,
  }),
  token,
  languageData: {
    commentTokens: { line: "#" },
    closeBrackets: { brackets: ["(", "[", '"'] },
  },
  tokenTable: {
    keyword: t.keyword,
    stateDef: t.definition(t.typeName),
    stateRef: t.typeName,
    varDef: t.definition(t.variableName),
    variable: t.variableName,
    property: t.propertyName,
    process: t.function(t.keyword),
    function: t.function(t.variableName),
    fluid: t.atom,
    atom: t.atom,
    number: t.number,
    unit: t.unit,
    arrow: t.controlOperator,
    operator: t.operator,
    bracket: t.bracket,
    punctuation: t.punctuation,
    comment: t.lineComment,
    string: t.string,
    invalid: t.invalid,
  },
});

/** Colors with at least 4.5:1 contrast on the editor's background. */
export const scriptHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.keyword, color: "#1d4ed8", fontWeight: "600" },
    { tag: t.function(t.keyword), color: "#7c3aed", fontWeight: "600" },
    { tag: t.definition(t.typeName), color: "#0f766e", fontWeight: "700" },
    { tag: t.typeName, color: "#0f766e" },
    { tag: t.definition(t.variableName), color: "#9a3412", fontWeight: "600" },
    { tag: t.variableName, color: "#9a3412" },
    { tag: t.propertyName, color: "#be185d" },
    { tag: t.function(t.variableName), color: "#6d28d9" },
    { tag: t.atom, color: "#0e7490", fontWeight: "600" },
    { tag: t.number, color: "#b45309" },
    { tag: t.unit, color: "#15803d" },
    { tag: t.controlOperator, color: "#7c3aed", fontWeight: "600" },
    { tag: [t.operator, t.punctuation, t.bracket], color: "#475569" },
    { tag: t.lineComment, color: "#64748b", fontStyle: "italic" },
    { tag: t.string, color: "#0e7490" },
    { tag: t.invalid, color: "#b91c1c", textDecoration: "underline wavy" },
  ]),
);
