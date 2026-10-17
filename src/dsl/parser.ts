/**
 * Lexer and parser of the script language:
 *
 *   fluid R134a
 *   units celsius                       # celsius | kelvin | imperial
 *   state 1: T = -10 °C, x = 1          # a state from a pair
 *   state 2s = 1 -> isentropic(P = 1.2 MPa)
 *   state 2: P = 2s.P, h = 1.h + (2s.h - 1.h) / eta
 *   state 5 [Water]: T = 25 °C, P = 1 bar
 *   let eta = 0.8
 *   cycle 1 -> 2 -> 3 -> 4 -> 1
 *   print COP, 1.T
 *
 * One statement per line; `#` starts a comment.
 */
import { UNIT_NAMES } from "./units";

export type Span = { line: number; col: number };

export type Diagnostic = Span & { message: string };

export type Expr = { span: Span } & (
  | { kind: "num"; value: number; unit?: string }
  | { kind: "var"; name: string }
  | { kind: "prop"; state: string; prop: string }
  | { kind: "neg"; arg: Expr }
  | { kind: "bin"; op: "+" | "-" | "*" | "/" | "^"; left: Expr; right: Expr }
  | { kind: "call"; fn: string; args: Expr[] }
);

export type Assign = { span: Span; name: string; expr: Expr };

export type StateDef =
  | { kind: "pair"; a: Assign; b: Assign }
  | {
      kind: "process";
      from: string;
      fromSpan: Span;
      process: string;
      args: Assign[];
    };

export type Stmt = { span: Span; text: string } & (
  | { kind: "fluid"; name: string }
  | { kind: "units"; system: string }
  | { kind: "state"; name: string; fluid?: string; def: StateDef }
  | { kind: "let"; name: string; expr: Expr }
  | { kind: "cycle"; states: { name: string; span: Span }[] }
  | { kind: "print"; items: { expr: Expr; text: string }[] }
);

type TokenKind = "num" | "word" | "string" | "punct" | "newline" | "eof";

export type Token = Span & {
  kind: TokenKind;
  text: string;
  /** Offset in the source, to slice expression text for `print`. */
  start: number;
  end: number;
  value?: number;
  unit?: string;
};

const NUMBER = /^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/;

/** The unit starting `text`, if a whole one does ("kPa" but not "kPax"). */
function unitAt(text: string): string | undefined {
  return UNIT_NAMES.find(
    (u) => text.startsWith(u) && !/[A-Za-z0-9_]/.test(text[u.length] ?? ""),
  );
}
const WORD = /^[A-Za-z0-9_]+/;
const PUNCT = [
  "->",
  "→",
  ":",
  ",",
  "=",
  "(",
  ")",
  "[",
  "]",
  ".",
  "+",
  "-",
  "−",
  "*",
  "×",
  "/",
  "^",
];

export class ParseError extends Error {
  constructor(
    message: string,
    readonly span: Span,
  ) {
    super(message);
  }
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let lineStart = 0;
  const at = (start: number): Span => ({ line, col: start - lineStart + 1 });

  while (i < source.length) {
    const c = source[i];
    if (c === "\n") {
      tokens.push({
        kind: "newline",
        text: "\n",
        ...at(i),
        start: i,
        end: i + 1,
      });
      i++;
      line++;
      lineStart = i;
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") {
      i++;
      continue;
    }
    if (c === "#") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    const rest = source.slice(i);
    const num = NUMBER.exec(rest);
    // "2s" is a state name; "1.2MPa" a number with its unit.
    const glued = num && /[A-Za-z0-9_]/.test(rest[num[0].length] ?? "");
    if (num && (!glued || unitAt(rest.slice(num[0].length)))) {
      const start = i;
      i += num[0].length;
      // A unit after the number, e.g. "25 °C" or "1.2MPa".
      let j = i;
      while (source[j] === " " || source[j] === "\t") j++;
      const unit = unitAt(source.slice(j));
      if (unit) i = j + unit.length;
      tokens.push({
        kind: "num",
        text: source.slice(start, i),
        value: Number(num[0]),
        unit,
        ...at(start),
        start,
        end: i,
      });
      continue;
    }
    const word = WORD.exec(rest);
    if (word) {
      tokens.push({
        kind: "word",
        text: word[0],
        ...at(i),
        start: i,
        end: i + word[0].length,
      });
      i += word[0].length;
      continue;
    }
    if (c === '"') {
      const close = source.indexOf('"', i + 1);
      if (close < 0 || source.slice(i, close).includes("\n")) {
        throw new ParseError("Unterminated string", at(i));
      }
      tokens.push({
        kind: "string",
        text: source.slice(i + 1, close),
        ...at(i),
        start: i,
        end: close + 1,
      });
      i = close + 1;
      continue;
    }
    const punct = PUNCT.find((p) => rest.startsWith(p));
    if (punct) {
      // Typographic variants a phone keyboard offers.
      const text =
        punct === "→"
          ? "->"
          : punct === "−"
            ? "-"
            : punct === "×"
              ? "*"
              : punct;
      tokens.push({
        kind: "punct",
        text,
        ...at(i),
        start: i,
        end: i + punct.length,
      });
      i += punct.length;
      continue;
    }
    throw new ParseError(`Unexpected character "${c}"`, at(i));
  }
  tokens.push({ kind: "newline", text: "\n", ...at(i), start: i, end: i });
  tokens.push({ kind: "eof", text: "", ...at(i), start: i, end: i });
  return tokens;
}

class Parser {
  private pos = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly source: string,
  ) {}

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }

  private next(): Token {
    const t = this.peek();
    if (t.kind !== "eof") this.pos++;
    return t;
  }

  private is(text: string): boolean {
    const t = this.peek();
    return t.kind === "punct" && t.text === text;
  }

  private accept(text: string): boolean {
    if (!this.is(text)) return false;
    this.pos++;
    return true;
  }

  private expect(text: string, what = `"${text}"`): Token {
    const t = this.peek();
    if (t.kind === "punct" && t.text === text) return this.next();
    throw new ParseError(`Expected ${what}, found ${describe(t)}`, t);
  }

  private word(what: string): Token {
    const t = this.peek();
    if (t.kind === "word") return this.next();
    throw new ParseError(`Expected ${what}, found ${describe(t)}`, t);
  }

  /** A fluid name: bare (R134a) or quoted ("R-410A"). */
  private fluidName(): string {
    const t = this.peek();
    if (t.kind === "word" || t.kind === "string") return this.next().text;
    throw new ParseError(`Expected a fluid name, found ${describe(t)}`, t);
  }

  private endOfStatement() {
    const t = this.peek();
    if (t.kind !== "newline") {
      throw new ParseError(`Unexpected ${describe(t)}`, t);
    }
  }

  /** Skips to the next line, after an error. */
  private recover() {
    while (this.peek().kind !== "newline" && this.peek().kind !== "eof")
      this.pos++;
  }

  parse(): { statements: Stmt[]; diagnostics: Diagnostic[] } {
    const statements: Stmt[] = [];
    const diagnostics: Diagnostic[] = [];
    while (this.peek().kind !== "eof") {
      if (this.peek().kind === "newline") {
        this.pos++;
        continue;
      }
      try {
        statements.push(this.statement());
        this.endOfStatement();
      } catch (e) {
        if (!(e instanceof ParseError)) throw e;
        diagnostics.push({ ...e.span, message: e.message });
        this.recover();
      }
    }
    return { statements, diagnostics };
  }

  private statement(): Stmt {
    const first = this.peek();
    const span = { line: first.line, col: first.col };
    const lineEnd = this.source.indexOf("\n", first.start);
    const text = this.source
      .slice(first.start, lineEnd < 0 ? undefined : lineEnd)
      .replace(/\s*#.*$/, "")
      .trim();
    const keyword = this.word(
      "a statement (state, let, fluid, units, cycle, print)",
    );
    switch (keyword.text) {
      case "fluid":
        return { kind: "fluid", name: this.fluidName(), span, text };
      case "units":
        return {
          kind: "units",
          system: this.word("a unit system").text,
          span,
          text,
        };
      case "let": {
        const name = this.word("a variable name");
        if (/^\d/.test(name.text)) {
          throw new ParseError("Variable names start with a letter", name);
        }
        this.expect("=");
        return { kind: "let", name: name.text, expr: this.expr(), span, text };
      }
      case "state":
        return this.state(span, text);
      case "cycle": {
        const states = [this.stateName()];
        while (this.accept("->")) states.push(this.stateName());
        if (states.length < 2) {
          throw new ParseError(
            "A cycle links two or more states with ->",
            span,
          );
        }
        return { kind: "cycle", states, span, text };
      }
      case "print": {
        const items = [this.printItem()];
        while (this.accept(",")) items.push(this.printItem());
        return { kind: "print", items, span, text };
      }
      default:
        throw new ParseError(
          `Unknown statement "${keyword.text}" (expected state, let, fluid, units, cycle or print)`,
          keyword,
        );
    }
  }

  /** A state name: a word (2s, evap_out) or a plain number (1). */
  private stateName(): { name: string; span: Span } {
    const t = this.peek();
    if (
      t.kind === "word" ||
      (t.kind === "num" && !t.unit && /^\d+$/.test(t.text))
    ) {
      this.next();
      return { name: t.text, span: { line: t.line, col: t.col } };
    }
    throw new ParseError(`Expected a state name, found ${describe(t)}`, t);
  }

  private state(span: Span, text: string): Stmt {
    const { name } = this.stateName();
    let fluid: string | undefined;
    if (this.accept("[")) {
      fluid = this.fluidName();
      this.expect("]");
    }
    if (this.accept(":")) {
      const a = this.assign();
      this.expect(",", '"," between the two properties');
      const b = this.assign();
      return {
        kind: "state",
        name,
        fluid,
        def: { kind: "pair", a, b },
        span,
        text,
      };
    }
    if (this.accept("=")) {
      const from = this.stateName();
      this.expect("->");
      const process = this.word("a process (isentropic, isobaric, ...)").text;
      this.expect("(");
      const args: Assign[] = [];
      if (!this.is(")")) {
        args.push(this.assign());
        while (this.accept(",")) args.push(this.assign());
      }
      this.expect(")");
      return {
        kind: "state",
        name,
        fluid,
        def: {
          kind: "process",
          from: from.name,
          fromSpan: from.span,
          process,
          args,
        },
        span,
        text,
      };
    }
    throw new ParseError(
      `Expected ":" (a pair: state ${name}: T = ..., P = ...) or "=" (a process: state ${name} = 1 -> isentropic(P = ...))`,
      this.peek(),
    );
  }

  private assign(): Assign {
    const t = this.word("a property name");
    this.expect("=");
    return {
      span: { line: t.line, col: t.col },
      name: t.text,
      expr: this.expr(),
    };
  }

  private printItem(): { expr: Expr; text: string } {
    const start = this.peek().start;
    const expr = this.expr();
    const end = this.tokens[this.pos - 1].end;
    return { expr, text: this.source.slice(start, end).trim() };
  }

  // expr := term (("+" | "-") term)*
  private expr(): Expr {
    let left = this.term();
    while (this.is("+") || this.is("-")) {
      const op = this.next();
      left = {
        kind: "bin",
        op: op.text as "+" | "-",
        left,
        right: this.term(),
        span: op,
      };
    }
    return left;
  }

  // term := unary (("*" | "/") unary)*
  private term(): Expr {
    let left = this.unary();
    while (this.is("*") || this.is("/")) {
      const op = this.next();
      left = {
        kind: "bin",
        op: op.text as "*" | "/",
        left,
        right: this.unary(),
        span: op,
      };
    }
    return left;
  }

  // unary := "-" unary | power
  private unary(): Expr {
    if (this.is("-")) {
      const op = this.next();
      const arg = this.unary();
      // "-10 °C" is minus ten degrees, not minus 263.15 K.
      if (arg.kind === "num") return { ...arg, value: -arg.value, span: op };
      return { kind: "neg", arg, span: op };
    }
    return this.power();
  }

  // power := primary ("^" unary)?
  private power(): Expr {
    const base = this.primary();
    if (this.is("^")) {
      const op = this.next();
      return {
        kind: "bin",
        op: "^",
        left: base,
        right: this.unary(),
        span: op,
      };
    }
    return base;
  }

  private primary(): Expr {
    const t = this.peek();
    const span = { line: t.line, col: t.col };
    if (t.kind === "num") {
      this.next();
      // "1.h": state 1's enthalpy.
      if (!t.unit && this.is(".") && this.peek(1).kind === "word") {
        this.next();
        return { kind: "prop", state: t.text, prop: this.next().text, span };
      }
      return { kind: "num", value: t.value!, unit: t.unit, span };
    }
    if (t.kind === "word") {
      this.next();
      if (this.accept(".")) {
        return {
          kind: "prop",
          state: t.text,
          prop: this.word("a property name").text,
          span,
        };
      }
      if (this.accept("(")) {
        const args: Expr[] = [];
        if (!this.is(")")) {
          args.push(this.expr());
          while (this.accept(",")) args.push(this.expr());
        }
        this.expect(")");
        return { kind: "call", fn: t.text, args, span };
      }
      if (/^\d/.test(t.text)) {
        throw new ParseError(
          `"${t.text}" is a state: read a property, e.g. ${t.text}.h`,
          t,
        );
      }
      return { kind: "var", name: t.text, span };
    }
    if (this.accept("(")) {
      const inner = this.expr();
      this.expect(")");
      return inner;
    }
    throw new ParseError(`Expected a value, found ${describe(t)}`, t);
  }
}

function describe(t: Token): string {
  switch (t.kind) {
    case "newline":
      return "end of line";
    case "eof":
      return "end of script";
    case "string":
      return `"${t.text}"`;
    default:
      return `"${t.text}"`;
  }
}

export function parse(source: string): {
  statements: Stmt[];
  diagnostics: Diagnostic[];
} {
  let tokens: Token[];
  try {
    tokens = tokenize(source);
  } catch (e) {
    if (!(e instanceof ParseError)) throw e;
    // Parse what comes before the bad character, so the rest still shows.
    const lines = source.split("\n");
    const blanked = lines
      .map((l, i) => (i + 1 === e.span.line ? "" : l))
      .join("\n");
    const rest = parse(blanked);
    return {
      statements: rest.statements,
      diagnostics: [{ ...e.span, message: e.message }, ...rest.diagnostics],
    };
  }
  return new Parser(tokens, source).parse();
}
