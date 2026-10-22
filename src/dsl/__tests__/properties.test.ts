/**
 * Property-based tests: random scripts and expressions against invariants
 * and an independent model of the arithmetic. fast-check shrinks a failure
 * to its smallest case and prints it with the seed that reproduces it.
 */
import { beforeAll, describe, expect, it } from "vitest";
import fc from "fast-check";
import type { CoolProp } from "@luisbedoia/coolprop-rs-wasm";
import { loadRealCoolProp } from "../../test-fixtures/realCoolProp";
import { evaluate, type ScriptResult } from "../evaluate";
import { formatQuantity } from "../format";
import { formatScript } from "../formatScript";
import { scriptLanguage } from "../editor/language";
import {
  convertTo,
  dimEq,
  dimMul,
  dimPow,
  displayKind,
  isAbsolute,
  isDifference,
  NONE,
  PROPERTY_DIM,
  UNITS,
  unitAt,
  type Dim,
  type Quantity,
} from "../units";
import { toSI, type UnitSystem } from "../../lib/units";

let cp: CoolProp;

const BASE =
  "fluid Water\n1: T = 20 °C, P = 100 kPa\n2: T = 80 °C, P = 500 kPa\n";
/** SI values of what BASE defines, read from a run. */
const STATE_VALUES = new Map<string, number>();

beforeAll(async () => {
  cp = await loadRealCoolProp();
  const r = evaluate(BASE, cp);
  for (const s of r.states) {
    STATE_VALUES.set(`T${s.name}`, s.state!.temperature);
    STATE_VALUES.set(`P${s.name}`, s.state!.pressure);
    STATE_VALUES.set(`h${s.name}`, s.state!.enthalpy);
    STATE_VALUES.set(`s${s.name}`, s.state!.entropy);
  }
});

function run(source: string): ScriptResult {
  return evaluate(source, cp);
}

function close(a: number, b: number, rel = 1e-9): boolean {
  return Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b), 1e-300);
}

const SYSTEMS: UnitSystem[] = ["celsius", "kelvin", "imperial"];

// ---------------------------------------------------------------------------
// Expressions and a model of their arithmetic.

type Node =
  | { kind: "leaf"; src: string; unit?: string }
  | { kind: "bin"; op: "+" | "-" | "*" | "/"; l: Node; r: Node }
  | { kind: "pow"; base: Node; n: number }
  | { kind: "neg"; arg: Node }
  | { kind: "call"; fn: string; args: Node[] };

const NUMBERS = [0, 0.5, 1, 2, 3.7, 10, 250, 0.001];

/** Leaves of several dimensions; no °C or °F (they shift, see evaluate). */
const leaf: fc.Arbitrary<Node> = fc.oneof(
  fc
    .constantFrom("T1", "T2", "P1", "P2", "h1", "h2", "s1", "s2")
    .map((src): Node => ({ kind: "leaf", src })),
  fc
    .tuple(
      fc.constantFrom(...NUMBERS),
      fc.constantFrom(undefined, "K", "kPa", "kJ/kg", "kJ/(kg*K)", "kg/s", "%"),
    )
    .map(([n, unit]): Node => ({
      kind: "leaf",
      src: unit ? `${n} ${unit}` : String(n),
      unit,
    })),
);

const { expr } = fc.letrec<{ expr: Node }>((tie) => ({
  expr: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    leaf,
    fc
      .tuple(
        fc.constantFrom("+", "-", "*", "/" as const),
        tie("expr"),
        tie("expr"),
      )
      .map(([op, l, r]): Node => ({ kind: "bin", op, l, r })),
    fc
      .tuple(tie("expr"), fc.constantFrom(-2, -1, 0.5, 2, 3))
      .map(([base, n]): Node => ({ kind: "pow", base, n })),
    tie("expr").map((arg): Node => ({ kind: "neg", arg })),
    fc
      .tuple(fc.constantFrom("abs", "sqrt", "ln", "exp"), tie("expr"))
      .map(([fn, a]): Node => ({ kind: "call", fn, args: [a] })),
    fc
      .tuple(fc.constantFrom("min", "max"), tie("expr"), tie("expr"))
      .map(([fn, a, b]): Node => ({ kind: "call", fn, args: [a, b] })),
  ),
}));

/** Every subexpression in parentheses. */
function full(e: Node): string {
  switch (e.kind) {
    case "leaf":
      return e.unit ? `(${e.src})` : e.src;
    case "bin":
      return `(${full(e.l)} ${e.op} ${full(e.r)})`;
    case "pow":
      return `(${full(e.base)}^${e.n})`;
    case "neg":
      return `(-${full(e.arg)})`;
    case "call":
      return `${e.fn}(${e.args.map(full).join(", ")})`;
  }
}

const PREC = { "+": 1, "-": 1, "*": 2, "/": 2 } as const;
function prec(e: Node): number {
  if (e.kind === "bin") return PREC[e.op];
  if (e.kind === "neg") return 3;
  if (e.kind === "pow") return 4;
  return 5;
}

/** Only the parentheses precedence needs. */
function minimal(e: Node): string {
  const wrap = (x: Node, need: boolean) =>
    need ? `(${minimal(x)})` : minimal(x);
  switch (e.kind) {
    case "leaf":
      return e.src;
    case "bin":
      // The right operand keeps its parentheses at the same level: a + (b + c)
      // rounds differently from a + b + c.
      return `${wrap(e.l, prec(e.l) < PREC[e.op])} ${e.op} ${wrap(e.r, prec(e.r) <= PREC[e.op])}`;
    case "pow":
      // "2 K^2" is 2 K squared, but "2 m^2" is an area: a unit stays inside.
      return `${wrap(e.base, prec(e.base) <= 4 || !!(e.base.kind === "leaf" && e.base.unit))}^${e.n}`;
    case "neg":
      return `-${wrap(e.arg, prec(e.arg) < 3)}`;
    case "call":
      return `${e.fn}(${e.args.map(minimal).join(", ")})`;
  }
}

type Model = { value: number; dim: Dim } | { error: string };

const TEMPERATURE = PROPERTY_DIM.temperature;

/** The arithmetic as the language defines it, written apart from it. */
function model(e: Node): Model {
  const fail = (error: string): Model => ({ error });
  const ok = (value: number, dim: Dim): Model =>
    Number.isFinite(value) ? { value, dim } : fail("not finite");
  switch (e.kind) {
    case "leaf": {
      if (STATE_VALUES.has(e.src)) {
        const dims: Record<string, Dim> = {
          T: TEMPERATURE,
          P: PROPERTY_DIM.pressure,
          h: PROPERTY_DIM.enthalpy,
          s: PROPERTY_DIM.entropy,
        };
        return { value: STATE_VALUES.get(e.src)!, dim: dims[e.src[0]] };
      }
      const n = parseFloat(e.src);
      if (!e.unit) return { value: n, dim: NONE };
      const u = UNITS[e.unit];
      return { value: n * u.scale, dim: u.dim };
    }
    case "neg": {
      const a = model(e.arg);
      return "error" in a ? a : { value: -a.value, dim: a.dim };
    }
    case "pow": {
      const a = model(e.base);
      return "error" in a ? a : ok(a.value ** e.n, dimPow(a.dim, e.n));
    }
    case "bin": {
      const a = model(e.l);
      if ("error" in a) return a;
      const b = model(e.r);
      if ("error" in b) return b;
      switch (e.op) {
        case "+":
        case "-":
          if (!dimEq(a.dim, b.dim)) return fail("dimensions");
          return ok(
            e.op === "+" ? a.value + b.value : a.value - b.value,
            a.dim,
          );
        case "*":
          return ok(a.value * b.value, dimMul(a.dim, b.dim));
        case "/":
          if (b.value === 0) return fail("division by zero");
          return ok(a.value / b.value, dimMul(a.dim, b.dim, -1));
      }
    }
    // falls through: unreachable
    case "call": {
      const args: { value: number; dim: Dim }[] = [];
      for (const x of e.args) {
        const m = model(x);
        if ("error" in m) return m;
        args.push(m);
      }
      const [a] = args;
      switch (e.fn) {
        case "abs":
          return ok(Math.abs(a.value), a.dim);
        case "sqrt":
          if (a.value < 0) return fail("sqrt");
          return ok(Math.sqrt(a.value), dimPow(a.dim, 0.5));
        case "ln":
        case "exp":
          if (!dimEq(a.dim, NONE)) return fail("dimensionless");
          if (e.fn === "ln" && a.value <= 0) return fail("ln");
          return ok(
            e.fn === "ln" ? Math.log(a.value) : Math.exp(a.value),
            NONE,
          );
        default: {
          if (!args.every((x) => dimEq(x.dim, a.dim))) return fail("dims");
          const pick = args.reduce((m, x) =>
            (e.fn === "min" ? x.value < m.value : x.value > m.value) ? x : m,
          );
          return pick;
        }
      }
    }
  }
}

function evalExpression(src: string): { q?: Quantity; error?: string } {
  const r = run(`${BASE}x = ${src}\n`);
  const v = r.values.find((x) => x.name === "x");
  return { q: v?.value, error: v?.error };
}

describe("expressions", () => {
  it("agree with a model of the arithmetic", () => {
    fc.assert(
      fc.property(expr, (e) => {
        const src = full(e);
        const want = model(e);
        const got = evalExpression(src);
        if ("error" in want) {
          expect(got.error, src).toBeDefined();
        } else {
          expect(got.error, src).toBeUndefined();
          expect(close(got.q!.value, want.value, 1e-12), src).toBe(true);
          expect(dimEq(got.q!.dim, want.dim), src).toBe(true);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it("parse with the usual precedence", () => {
    fc.assert(
      fc.property(expr, (e) => {
        const a = evalExpression(full(e));
        const b = evalExpression(minimal(e));
        const where = `${minimal(e)}  vs  ${full(e)}`;
        expect(!!b.error, where).toBe(!!a.error);
        if (a.q && b.q) {
          expect(close(a.q.value, b.q.value, 1e-12), where).toBe(true);
          expect(dimEq(a.q.dim, b.q.dim), where).toBe(true);
        }
      }),
      { numRuns: 1000 },
    );
  });
});

// ---------------------------------------------------------------------------
// Temperatures.

describe("temperatures", () => {
  const coefficient = fc.constantFrom(-2, -1, -0.5, 0, 0.25, 0.5, 1, 1.5, 2, 3);
  /** Terms c*T plus differences, whose coefficients sum to `sum`. */
  const affine = (sum: number) =>
    fc
      .tuple(
        fc.array(fc.tuple(fc.constantFrom("T1", "T2"), coefficient), {
          minLength: 1,
          maxLength: 4,
        }),
        fc.constantFrom("T1", "T2"),
        fc.array(
          fc.tuple(
            coefficient,
            fc.constantFrom("(T2 - T1)", "10 K", "(T1 - 5 °C)", "Q/UA"),
          ),
          { maxLength: 3 },
        ),
      )
      .map(([terms, last, diffs]) => {
        const rest = sum - terms.reduce((s, [, c]) => s + c, 0);
        // "(T1 - 5 °C)" is a temperature: it counts towards the sum.
        const shifts = diffs.filter(([, d]) => d === "(T1 - 5 °C)");
        const fix = rest - shifts.reduce((s, [c]) => s + c, 0);
        return [
          ...terms.map(([t, c]) => `${c}*${t}`),
          `${fix}*${last}`,
          ...diffs.map(([c, d]) => `${c}*${d}`),
        ].join(" + ");
      });

  const setup = `${BASE}Q = 10 kW\nUA = 1 kW/K\n`;

  it("an affine combination of weight 1 is a temperature", () => {
    fc.assert(
      fc.property(affine(1), fc.constantFrom(...SYSTEMS), (src, system) => {
        const r = run(`units ${system}\n${setup}x = ${src}\n`);
        const q = r.values.find((v) => v.name === "x")!.value!;
        expect(isAbsolute(q), src).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it("one of weight 0 is a difference", () => {
    fc.assert(
      fc.property(affine(0), (src) => {
        const r = run(`${setup}x = ${src}\n`);
        const q = r.values.find((v) => v.name === "x")!.value!;
        expect(isDifference(q), src).toBe(true);
      }),
      { numRuns: 300 },
    );
  });
});

// ---------------------------------------------------------------------------
// Units.

const TEMPERATURE_UNITS = ["K", "°C", "°F", "°R", "ºC", "℃", "degF", "°K"];
const PRESSURE_UNITS = ["Pa", "kPa", "MPa", "bar", "atm", "psi", "psia"];

describe("units", () => {
  it("any spelling of a state's inputs reaches the same state", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 280, max: 900, noNaN: true }),
        fc.double({ min: 1e4, max: 2e7, noNaN: true }),
        fc.constantFrom(...TEMPERATURE_UNITS),
        fc.constantFrom(...PRESSURE_UNITS),
        fc.option(fc.constantFrom(...SYSTEMS)),
        (T, P, tu, pu, bare) => {
          const asTemperature: Quantity = {
            value: T,
            dim: TEMPERATURE,
            absolute: 1,
          };
          const asPressure: Quantity = { value: P, dim: PROPERTY_DIM.pressure };
          const reference = run(`fluid Water\n1: T = ${T} K, P = ${P} Pa`);
          // "ºC" is typed; it converts as "°C".
          const t = convertTo(asTemperature, unitAt(tu)!.name)!;
          const p = convertTo(asPressure, unitAt(pu)!.name)!;
          const src = bare
            ? `units ${bare}\nfluid Water\n1: T = ${bareIn("temperature", T, bare)}, P = ${bareIn("pressure", P, bare)}`
            : `fluid Water\n1: T = ${t} ${tu}, P = ${p} ${pu}`;
          const r = run(src);
          const a = reference.states[0].state;
          const b = r.states[0].state;
          // Near the saturation line both may fail; they must agree on that.
          expect(!!b, src).toBe(!!a);
          if (a && b) {
            expect(close(a.temperature, b.temperature, 1e-9), src).toBe(true);
            // CoolProp gives a liquid's P back from its equation of state:
            // the rounding of a unit conversion moves it by ~1e-8.
            expect(close(a.pressure, b.pressure, 1e-6), src).toBe(true);
            expect(close(a.enthalpy, b.enthalpy, 1e-6), src).toBe(true);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("what the app shows reads back as itself", () => {
    const dims: Dim[] = [
      ...Object.values(PROPERTY_DIM),
      ...["kW", "kJ", "kg/s", "kg", "kW/K", "W/(m^2*K)", "m^2", "m^3", "m"].map(
        (u) => UNITS[u].dim,
      ),
    ];
    const magnitude = fc
      .tuple(
        fc.double({ min: -9, max: 9, noNaN: true }),
        fc.boolean(),
        fc.constantFrom(1, 2, 5),
      )
      .map(([e, neg, m]) => (neg ? -1 : 1) * m * 10 ** Math.round(e));
    fc.assert(
      fc.property(
        fc.constantFrom(...dims),
        magnitude,
        fc.constantFrom(undefined, 0, 1),
        fc.constantFrom(...SYSTEMS),
        (dim, value, absolute, system) => {
          const temperature = dimEq(dim, TEMPERATURE);
          const q: Quantity = {
            value: temperature && absolute === 1 ? Math.abs(value) : value,
            dim,
            absolute: temperature ? absolute : undefined,
          };
          if (!displayKind(dim)) return;
          const text = formatQuantity(q, system);
          const back = run(`units ${system}\nx = ${text}\nprint x`);
          const p = back.prints[0]?.value;
          const again = p
            ? formatQuantity(p, system)
            : back.diagnostics.map((d) => d.message).join("; ");
          expect(again, `${value} → ${text}`).toBe(text);
        },
      ),
      { numRuns: 1000 },
    );
  });
});

/** `si` written as a bare number in `system`, as a script would. */
function bareIn(name: string, si: number, system: UnitSystem): number {
  // toSI's inverse, by bisection-free algebra: toSI is affine.
  const at0 = toSI(name, 0, system);
  const scale = toSI(name, 1, system) - at0;
  return (si - at0) / scale;
}

// ---------------------------------------------------------------------------
// Anything typed.

const TOKENS = [
  "1",
  "2s",
  "3",
  ":",
  "T",
  "P",
  "h1",
  "x",
  "=",
  "25",
  "-10",
  "1.5e3",
  "°C",
  "ºC",
  "K",
  "kPa",
  "bar",
  "%",
  "kJ/kg",
  "kJ/(kg·K)",
  "m²",
  ",",
  "1,5",
  "from",
  "to",
  "isentropic",
  "compressed",
  "eta",
  "polytropic",
  "n",
  "sat",
  "vapor",
  "liquid",
  "(",
  ")",
  "+",
  "-",
  "−",
  "*",
  "×",
  "/",
  "^",
  ".",
  "[",
  "]",
  "Water",
  '"R-410A"',
  "print",
  "in",
  "°F",
  "draw",
  "->",
  "→",
  "fluid",
  "units",
  "celsius",
  "imperial",
  "reference",
  "ASHRAE",
  "max",
  "sqrt",
  "ln",
  "abs",
  "#",
  '"',
  "\n",
  " ",
  "  ",
  "1e309",
  "0",
  "1/0",
  "inf",
  "NaN",
  "@",
  "ñ",
  "😀",
  "\t",
];

const soup = fc.oneof(
  fc
    .array(fc.constantFrom(...TOKENS), { maxLength: 40 })
    .map((t) => t.join("")),
  fc
    .array(fc.constantFrom(...TOKENS), { maxLength: 40 })
    .map((t) => t.join(" ")),
  fc.string({ unit: "grapheme", maxLength: 60 }),
);

describe("anything typed", () => {
  it("never throws, and shows no NaN or ∞", () => {
    fc.assert(
      fc.property(soup, (src) => {
        const r = run(src);
        const lines = src.split("\n").length;
        for (const d of r.diagnostics) {
          expect(d.line >= 1 && d.line <= lines, src).toBe(true);
          expect(d.col >= 1, src).toBe(true);
          expect(d.message, src).not.toMatch(/undefined|\[object/);
        }
        for (const q of [
          ...r.values.map((v) => v.value),
          ...r.prints.map((p) => p.value),
        ]) {
          if (q)
            expect(formatQuantity(q, r.unitSystem), src).not.toMatch(
              /NaN|Infinity|∞/,
            );
        }
        scriptLanguage.parser.parse(src);
      }),
      { numRuns: 2000 },
    );
  });

  it("formats to a fixed point", () => {
    fc.assert(
      fc.property(soup, (src) => {
        const once = formatScript(src);
        expect(formatScript(once), JSON.stringify(src)).toBe(once);
      }),
      { numRuns: 2000 },
    );
  });

  it("formats without changing what it computes", () => {
    fc.assert(
      fc.property(
        fc.array(expr, { minLength: 1, maxLength: 3 }),
        soup,
        (es, noise) => {
          const src = `${BASE}${es.map((e, i) => `v${i} = ${minimal(e)}`).join("\n")}\n${noise}`;
          const a = run(src);
          const b = run(formatScript(src));
          const summary = (r: ScriptResult) => ({
            values: r.values.map((v) => [v.name, v.value?.value, v.error]),
            states: r.states.map((s) => [s.name, s.state?.enthalpy, s.error]),
            // Without what they quote: "1kPa" is formatted "1 kPa".
            messages: r.diagnostics
              .map((d) => d.message.replace(/"[^"]*"/g, '""'))
              .sort(),
          });
          expect(summary(b), JSON.stringify(src)).toEqual(summary(a));
        },
      ),
      { numRuns: 500 },
    );
  });
});
