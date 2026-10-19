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
import { STATEMENT_KEYWORDS } from "../vocabulary";
import { PROCESSES } from "../parser";
import { UNIT_NAMES } from "../units";

type LineState = {
  /** What the line is: a statement keyword's, or "state" / "value". */
  stmt: string | null;
  /** The previous non-space token, for context. */
  prev: string | null;
  /** Inside [ ] of a state's fluid. */
  bracket: boolean;
  afterNumber: boolean;
};

const PROCESS_NAMES = new Set(PROCESSES);
const KEYWORDS = new Set(STATEMENT_KEYWORDS);
const NUMBER = /^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/;
/** "h1", "T2s": a state's property, as the textbooks write it. */
const TEXTBOOK = /^(T|P|p|D|rho|v|h|s|u|x|cp|cv|mu|k|Pr|Z|a|g)\d\w*$/;

function unitAt(stream: StringStream): string | undefined {
  const rest = stream.string.slice(stream.pos);
  return UNIT_NAMES.find(
    (u) => rest.startsWith(u) && !/[A-Za-z0-9_]/.test(rest[u.length] ?? ""),
  );
}

/** What a line without a statement keyword defines, from its shape. */
function lineKind(line: string): "state" | "value" {
  if (/^\s*\w+\s*(\[[^\]]*\]\s*)?:/.test(line)) return "state";
  if (/^\s*[A-Za-z_]\w*\s*(=|$)/.test(line)) return "value";
  return "state";
}

function token(stream: StringStream, state: LineState): string | null {
  if (stream.sol()) {
    state.stmt = null;
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
  if (afterNumber || state.prev === "in") {
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

  // The name a line defines: "1:", "inlet [Water]:", "COP =".
  if (state.stmt === null && (word || isNumber)) {
    const text = word ? word[0] : num![0];
    if (word && KEYWORDS.has(text)) {
      stream.pos += text.length;
      state.stmt = text;
      state.prev = "keyword";
      return "keyword";
    }
    stream.pos += text.length;
    state.stmt = lineKind(stream.string);
    state.prev = "name";
    return state.stmt === "state" ? "stateDef" : "varDef";
  }

  if (word) {
    const text = word[0];
    stream.pos += text.length;
    const prev = state.prev;
    state.prev = "word";
    const next = stream.string.slice(stream.pos).trimStart();
    if (prev === ".") return "property";
    if (state.stmt === "fluid" || state.bracket) return "fluid";
    if (state.stmt === "units" || state.stmt === "reference") return "atom";
    if (state.stmt === "draw") return "stateRef";
    const assigned = /^=(?!=)/.test(next);
    if (state.stmt === "state" && !assigned) {
      if (text === "from" || text === "to") {
        state.prev = text;
        return "keyword";
      }
      if (text === "sat" || text === "saturated") {
        state.prev = "sat";
        return "keyword";
      }
      if (
        prev === "sat" &&
        (text === "liquid" || text === "vapor" || text === "vapour")
      )
        return "atom";
      if (prev === "from") return "stateRef";
      if (PROCESS_NAMES.has(text)) return "process";
    }
    if (state.stmt === "print" && text === "in") {
      state.prev = "in";
      return "keyword";
    }
    if (next.startsWith(".")) return "stateRef";
    if (next.startsWith("(")) return "function";
    if (
      assigned &&
      (prev === ":" || prev === "," || prev === "(" || prev === "to")
    )
      return "property";
    if (TEXTBOOK.test(text)) return "property";
    return /^\d/.test(text) ? "stateRef" : "variable";
  }

  if (isNumber && num) {
    stream.pos += num[0].length;
    const prev = state.prev;
    state.prev = "number";
    // "1.h" reads state 1; "draw 1 -> 2" names them.
    if (
      stream.peek() === "." &&
      /[A-Za-z_]/.test(stream.string[stream.pos + 1] ?? "")
    ) {
      return "stateRef";
    }
    if (state.stmt === "draw" || prev === "from") return "stateRef";
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

/**
 * Two families on the dark canvas (#121314), each over 4.5:1: PlayStation's
 * light link blue for the language's own words (statements, processes,
 * arrows, fluids) and white for what the script names and computes, with
 * the translucent greys for units, operators and comments (as a unit is a
 * grey suffix on a figure). Red only for what does not parse.
 */
export const scriptHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.keyword, color: "#53b1ff", fontWeight: "600" },
    { tag: t.function(t.keyword), color: "#53b1ff" },
    { tag: t.controlOperator, color: "#53b1ff" },
    { tag: t.atom, color: "#9fd0ff" },
    { tag: t.definition(t.typeName), color: "#ffffff", fontWeight: "700" },
    { tag: t.typeName, color: "#ffffff" },
    { tag: t.definition(t.variableName), color: "#ffffff", fontWeight: "600" },
    { tag: t.variableName, color: "#ffffff" },
    { tag: t.propertyName, color: "#9fd0ff" },
    { tag: t.function(t.variableName), color: "#9fd0ff" },
    { tag: t.number, color: "#ffffff" },
    { tag: t.unit, color: "rgba(229, 229, 229, 0.62)" },
    {
      tag: [t.operator, t.punctuation, t.bracket],
      color: "rgba(229, 229, 229, 0.62)",
    },
    {
      tag: t.lineComment,
      color: "rgba(229, 229, 229, 0.55)",
      fontStyle: "italic",
    },
    { tag: t.string, color: "#9fd0ff" },
    { tag: t.invalid, color: "#ff7a8f", textDecoration: "underline wavy" },
  ]),
);
