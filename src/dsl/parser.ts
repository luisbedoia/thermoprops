/**
 * Lexer and parser of the script language:
 *
 *   fluid R134a
 *   units celsius                       # celsius | kelvin | imperial
 *   reference ASHRAE                    # where h and s are measured from
 *   1: T = -10 °C, sat vapor            # a state from two properties
 *   2s: from 1, isentropic to P = 1.2 MPa
 *   2: from 1, compressed to P = 1.2 MPa, eta = 80%
 *   3: P = P2, h = h1 + (h2s - h1) / eta
 *   5 [Water]: T = 25 °C, P = 1 bar     # a state of another fluid
 *   eta = 0.8                           # a value
 *   draw 1 -> 2 -> 3 -> 4 -> 1          # the processes, on the chart
 *   print COP, T2 in °F
 *
 * One statement per line; `#` starts a comment. `h1` reads state 1's h, as
 * does `1.h` (the only way for a state named by a word: `inlet.h`).
 */
import { gluedUnit, unitAt } from "./units";
import { tr } from "../i18n";

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
      /** One of PROCESSES. */
      process: string;
      processSpan: Span;
      args: Assign[];
    };

export type PrintItem = {
  expr: Expr;
  text: string;
  /** "in °F": the unit to show the value in. */
  unit?: string;
  unitSpan?: Span;
};

export type Stmt = { span: Span; text: string } & (
  | { kind: "fluid"; name: string }
  | { kind: "units"; system: string }
  | { kind: "reference"; name: string }
  | { kind: "state"; name: string; fluid?: string; def: StateDef }
  | { kind: "value"; name: string; expr: Expr }
  | { kind: "draw"; states: { name: string; span: Span }[] }
  | { kind: "print"; items: PrintItem[] }
);

/** Words that start a statement; any other line defines a state or a value. */
export const STATEMENTS = ["fluid", "units", "reference", "draw", "print"];

/** Processes, as a state's definition names them: "compressed to P = ...". */
export const PROCESSES = [
  "isentropic",
  "isenthalpic",
  "throttled",
  "isobaric",
  "isothermal",
  "isochoric",
  "compressed",
  "expanded",
  "polytropic",
];

/** "sat liquid", "saturated vapor": the quality they fix. */
const SATURATION: Record<string, number> = {
  liquid: 0,
  vapor: 1,
  vapour: 1,
};

const has = (table: object, key: string) =>
  Object.prototype.hasOwnProperty.call(table, key);

type TokenKind =
  "num" | "word" | "string" | "punct" | "unit" | "newline" | "eof";

export type Token = Span & {
  kind: TokenKind;
  text: string;
  /** Offset in the source, to slice expression text for `print`. */
  start: number;
  end: number;
  value?: number;
  /** Its name in UNITS; `text` keeps it as typed ("ºC" for "°C"). */
  unit?: string;
};

export const NUMBER = /^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/;
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

class ParseError extends Error {
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
    if (num && (!glued || gluedUnit(rest.slice(num[0].length)))) {
      if (!Number.isFinite(Number(num[0])))
        throw new ParseError(
          tr("Number too large", "Número demasiado grande"),
          at(i),
        );
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
        unit: unit?.name,
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
      // "in °F": the unit to print a value in.
      if (word[0] === "in") {
        let j = i;
        while (source[j] === " " || source[j] === "\t") j++;
        const unit = unitAt(source.slice(j));
        if (unit) {
          tokens.push({
            kind: "unit",
            text: source.slice(j, j + unit.length),
            unit: unit.name,
            ...at(j),
            start: j,
            end: j + unit.length,
          });
          i = j + unit.length;
        }
      }
      continue;
    }
    if (c === '"') {
      const close = source.indexOf('"', i + 1);
      if (close < 0 || source.slice(i, close).includes("\n")) {
        throw new ParseError(
          tr("Unterminated string", "Cadena sin cerrar"),
          at(i),
        );
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
    throw new ParseError(
      tr(`Unexpected character "${c}"`, `Carácter inesperado "${c}"`),
      at(i),
    );
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
    throw new ParseError(expected(what, t), t);
  }

  private word(what: string): Token {
    const t = this.peek();
    if (t.kind === "word") return this.next();
    throw new ParseError(expected(what, t), t);
  }

  /** A fluid name: bare (R134a) or quoted ("R-410A"). */
  private fluidName(): string {
    const t = this.peek();
    if (t.kind === "word" || t.kind === "string") return this.next().text;
    throw new ParseError(
      expected(tr("a fluid name", "un nombre de fluido"), t),
      t,
    );
  }

  private endOfStatement() {
    const t = this.peek();
    if (t.kind !== "newline") {
      // "1,5": a decimal comma.
      const before = this.tokens[this.pos - 1];
      const after = this.peek(1);
      const comma =
        t.text === "," &&
        before?.kind === "num" &&
        after.kind === "num" &&
        before.end === t.start &&
        after.start === t.end;
      throw new ParseError(
        comma
          ? tr(
              `Unexpected ",": decimals take a point, ${before.text}.${after.text}`,
              `Inesperado: ",": los decimales llevan punto, ${before.text}.${after.text}`,
            )
          : tr(`Unexpected ${describe(t)}`, `Inesperado: ${describe(t)}`),
        t,
      );
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
    const keyword =
      first.kind === "word" && STATEMENTS.includes(first.text)
        ? this.next().text
        : undefined;
    switch (keyword) {
      case "fluid":
        return { kind: "fluid", name: this.fluidName(), span, text };
      case "units":
        return {
          kind: "units",
          system: this.word(tr("a unit system", "un sistema de unidades")).text,
          span,
          text,
        };
      case "reference":
        return {
          kind: "reference",
          name: this.word(
            tr(
              "a reference state (IIR, ASHRAE, NBP or DEF)",
              "un estado de referencia (IIR, ASHRAE, NBP o DEF)",
            ),
          ).text,
          span,
          text,
        };
      case "draw": {
        const states = [this.stateName()];
        while (this.accept("->")) states.push(this.stateName());
        if (states.length < 2) {
          throw new ParseError(
            tr(
              "draw links two or more states with ->, e.g. draw 1 -> 2",
              "draw une dos o más estados con ->, p. ej. draw 1 -> 2",
            ),
            span,
          );
        }
        return { kind: "draw", states, span, text };
      }
      case "print": {
        const items = [this.printItem()];
        while (this.accept(",")) items.push(this.printItem());
        return { kind: "print", items, span, text };
      }
    }
    return this.definition(span, text);
  }

  /** A value: "COP = q / w". */
  private value(name: Token, span: Span, text: string): Stmt {
    if (/^\d/.test(name.text)) {
      throw new ParseError(
        tr(
          `Names of values start with a letter; "${name.text}" is a state's name (${name.text}: T = ..., P = ...)`,
          `Los nombres de valores empiezan con una letra; "${name.text}" es el nombre de un estado (${name.text}: T = ..., P = ...)`,
        ),
        name,
      );
    }
    return { kind: "value", name: name.text, expr: this.expr(), span, text };
  }

  /** "1: ..." (a state) or "COP = ..." (a value). */
  private definition(span: Span, text: string): Stmt {
    const nameToken = this.peek();
    const { name } = this.stateName(
      "a statement (1: ..., name = ..., print, draw, fluid, units)",
    );
    let fluid: string | undefined;
    if (this.accept("[")) {
      fluid = this.fluidName();
      this.expect("]");
    }
    if (this.accept(":")) {
      return {
        kind: "state",
        name,
        fluid,
        def: this.clauses(name),
        span,
        text,
      };
    }
    if (fluid === undefined && this.accept("=")) {
      return this.value(nameToken, span, text);
    }
    throw new ParseError(
      fluid !== undefined || /^\d/.test(name)
        ? tr(
            `Expected ":" after the state's name: ${name}: T = ..., P = ...`,
            `Se esperaba ":" después del nombre del estado: ${name}: T = ..., P = ...`,
          )
        : tr(
            `Expected ":" (a state: ${name}: T = ..., P = ...) or "=" (a value: ${name} = ...)`,
            `Se esperaba ":" (un estado: ${name}: T = ..., P = ...) o "=" (un valor: ${name} = ...)`,
          ),
      this.peek(),
    );
  }

  /**
   * What fixes a state, as a list: two properties ("T = 25 °C, sat vapor"),
   * or a starting state, a process and its target ("from 1, compressed to
   * P = 1.2 MPa, eta = 80%"), in any order.
   */
  private clauses(name: string): StateDef {
    let from: { name: string; span: Span } | undefined;
    let process: { name: string; span: Span } | undefined;
    const assigns: Assign[] = [];
    const takeFrom = () => {
      const t = this.next();
      if (from)
        throw new ParseError(
          tr(
            "The starting state is given twice",
            "El estado inicial se da dos veces",
          ),
          t,
        );
      from = this.stateName();
    };
    do {
      const t = this.peek();
      const next = this.peek(1);
      const isAssign = next.kind === "punct" && next.text === "=";
      if (t.kind === "word" && t.text === "from" && !isAssign) {
        takeFrom();
      } else if (
        t.kind === "word" &&
        (t.text === "sat" || t.text === "saturated") &&
        !isAssign
      ) {
        this.next();
        const phase = this.word(
          tr('"liquid" or "vapor"', '"liquid" o "vapor"'),
        );
        const x = has(SATURATION, phase.text)
          ? SATURATION[phase.text]
          : undefined;
        if (x === undefined) {
          throw new ParseError(
            tr(
              `Expected "liquid" or "vapor", found "${phase.text}"`,
              `Se esperaba "liquid" o "vapor", se encontró "${phase.text}"`,
            ),
            phase,
          );
        }
        assigns.push({
          span: { line: t.line, col: t.col },
          name: "x",
          expr: { kind: "num", value: x, span: { line: t.line, col: t.col } },
        });
      } else if (t.kind === "word" && PROCESSES.includes(t.text) && !isAssign) {
        this.next();
        if (process) {
          throw new ParseError(
            tr(
              "A state is reached by one process",
              "Un estado se alcanza por un solo proceso",
            ),
            t,
          );
        }
        process = {
          name: t.text,
          span: { line: t.line, col: t.col },
        };
        const w = this.peek();
        if (w.kind === "word" && w.text === "from") takeFrom();
        const to = this.peek();
        if (to.kind === "word" && to.text === "to") {
          this.next();
          assigns.push(this.assign());
        }
      } else {
        assigns.push(this.assign());
      }
    } while (this.accept(","));

    if (process) {
      if (!from) {
        throw new ParseError(
          tr(
            `Say where it starts: ${name}: from 1, ${process.name} to ...`,
            `Indica desde dónde parte: ${name}: from 1, ${process.name} to ...`,
          ),
          process.span,
        );
      }
      return {
        kind: "process",
        from: from.name,
        fromSpan: from.span,
        process: process.name,
        processSpan: process.span,
        args: assigns,
      };
    }
    if (from) {
      throw new ParseError(
        tr(
          `Say how it is reached from ${from.name}: isentropic, isobaric, compressed, expanded, throttled, ...`,
          `Indica cómo se alcanza desde ${from.name}: isentropic, isobaric, compressed, expanded, throttled, ...`,
        ),
        from.span,
      );
    }
    if (assigns.length !== 2) {
      throw new ParseError(
        assigns.length < 2
          ? tr(
              "A state needs two properties, e.g. T = 25 °C, P = 1 bar",
              "Un estado necesita dos propiedades, p. ej. T = 25 °C, P = 1 bar",
            )
          : tr(
              `A state is fixed by two properties, not ${assigns.length}`,
              `Un estado se fija con dos propiedades, no ${assigns.length}`,
            ),
        assigns[assigns.length < 2 ? 0 : 2].span,
      );
    }
    return { kind: "pair", a: assigns[0], b: assigns[1] };
  }

  /** A state name: a word (2s, evap_out) or a plain number (1). */
  private stateName(what = tr("a state name", "un nombre de estado")): {
    name: string;
    span: Span;
  } {
    const t = this.peek();
    if (
      t.kind === "word" ||
      (t.kind === "num" && !t.unit && /^\d+$/.test(t.text))
    ) {
      this.next();
      return { name: t.text, span: { line: t.line, col: t.col } };
    }
    throw new ParseError(expected(what, t), t);
  }

  private assign(): Assign {
    const t = this.word(PROPERTY_NAME);
    this.expect("=");
    return {
      span: { line: t.line, col: t.col },
      name: t.text,
      expr: this.expr(),
    };
  }

  private printItem(): PrintItem {
    const start = this.peek().start;
    const expr = this.expr();
    const end = this.tokens[this.pos - 1].end;
    const item: PrintItem = {
      expr,
      text: this.source.slice(start, end).trim(),
    };
    const t = this.peek();
    if (t.kind === "word" && t.text === "in") {
      this.next();
      const unit = this.peek();
      if (unit.kind !== "unit") {
        throw new ParseError(
          tr(
            `Expected a unit after "in", e.g. in °F`,
            `Se esperaba una unidad después de "in", p. ej. in °F`,
          ),
          unit,
        );
      }
      this.next();
      item.unit = unit.unit;
      item.unitSpan = { line: unit.line, col: unit.col };
    }
    return item;
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
          prop: this.word(PROPERTY_NAME).text,
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
          tr(
            `"${t.text}" is a state: read a property, e.g. h${t.text} or ${t.text}.h`,
            `"${t.text}" es un estado: lee una propiedad, p. ej. h${t.text} o ${t.text}.h`,
          ),
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
    throw new ParseError(expected(tr("a value", "un valor"), t), t);
  }
}

function describe(t: Token): string {
  switch (t.kind) {
    case "newline":
      return tr("end of line", "fin de línea");
    case "eof":
      return tr("end of script", "fin del código");
    case "string":
      return `"${t.text}"`;
    case "unit":
      return tr(`the unit "${t.text}"`, `la unidad "${t.text}"`);
    default:
      return `"${t.text}"`;
  }
}

/** "Expected a value, found end of line". */
const expected = (what: string, t: Token) =>
  tr(
    `Expected ${what}, found ${describe(t)}`,
    `Se esperaba ${what}, se encontró ${describe(t)}`,
  );

const PROPERTY_NAME = tr("a property name", "un nombre de propiedad");

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
