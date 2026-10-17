/**
 * Evaluates a parsed script against a synchronous CoolProp. Statements are
 * assignments: each state and `let` is solved once its dependencies are, in
 * dependency order (not source order), and a cycle among them is an error.
 * A failure is reported where it happens; what depends on it is skipped.
 *
 * Runs in a worker (see worker.ts), where the synchronous API is cheap.
 */
import type {
  InputName,
  State,
  StateInputs,
} from "@luisbedoia/coolprop-rs-wasm";
import { isUnitSystem, toSI, type UnitSystem } from "../lib/units";
import {
  parse,
  type Assign,
  type Diagnostic,
  type Expr,
  type Span,
  type Stmt,
} from "./parser";
import {
  dimEq,
  dimMul,
  dimPow,
  isDimensionless,
  literal,
  NONE,
  PROPERTY_DIM,
  type Quantity,
} from "./units";

/** The part of the synchronous coolprop-rs API the evaluator needs. */
export interface EngineFluid {
  readonly name: string;
  state(inputs: StateInputs): State;
  states(inputs: readonly StateInputs[]): (State | Error)[];
}

export interface Engine {
  pairs(): readonly (readonly [InputName, InputName])[];
  fluid(name: string): EngineFluid;
}

/** How a state was reached from another, to draw the path between them. */
export type PathHint =
  | { kind: "conserve"; from: string; input: InputName }
  | { kind: "polytropic"; from: string; n: number }
  | { kind: "real"; from: string };

export type ScriptState = {
  name: string;
  line: number;
  fluid?: string;
  /** "P, h" or "isentropic from 1". */
  how: string;
  inputs?: StateInputs;
  state?: State;
  error?: string;
};

export type ScriptValue = {
  name: string;
  line: number;
  value?: Quantity;
  error?: string;
};

export type ScriptPath = {
  from: string;
  to: string;
  fluid: string;
  /** "process": along the process; "line": endpoints only, drawn straight. */
  kind: "process" | "line";
  states: State[];
};

export type ScriptResult = {
  /** Syntax and evaluation errors, by line. */
  diagnostics: Diagnostic[];
  /** Canonical name of the script's default fluid. */
  fluid?: string;
  unitSystem: UnitSystem;
  states: ScriptState[];
  values: ScriptValue[];
  prints: (ScriptValue & { text: string })[];
  paths: ScriptPath[];
};

class EvalError extends Error {
  constructor(
    message: string,
    readonly span?: Span,
  ) {
    super(message);
  }
}

/** Input names a state is fixed with, by the names a script may use. */
const INPUT_ALIASES: Record<string, InputName | "specific_volume"> = {
  T: "temperature",
  temperature: "temperature",
  P: "pressure",
  p: "pressure",
  pressure: "pressure",
  D: "density",
  rho: "density",
  density: "density",
  v: "specific_volume",
  specific_volume: "specific_volume",
  h: "enthalpy",
  enthalpy: "enthalpy",
  s: "entropy",
  entropy: "entropy",
  u: "internal_energy",
  internal_energy: "internal_energy",
  x: "quality",
  Q: "quality",
  quality: "quality",
};

/** Properties a script may read from a state, beyond the inputs. */
export const PROPERTY_ALIASES: Record<string, keyof State | "specific_volume"> =
  {
    ...INPUT_ALIASES,
    cp: "cp",
    cv: "cv",
    mu: "viscosity",
    viscosity: "viscosity",
    k: "conductivity",
    conductivity: "conductivity",
    Pr: "prandtl",
    prandtl: "prandtl",
    Z: "compressibility",
    compressibility: "compressibility",
    a: "speed_of_sound",
    speed_of_sound: "speed_of_sound",
    g: "gibbs",
    gibbs: "gibbs",
  };

/** The input each simple process keeps from its starting state. */
const CONSERVED: Record<string, InputName> = {
  isentropic: "entropy",
  isenthalpic: "enthalpy",
  throttle: "enthalpy",
  isobaric: "pressure",
  isothermal: "temperature",
  isochoric: "density",
};

export const PROCESSES = [
  ...Object.keys(CONSERVED),
  "compress",
  "expand",
  "polytropic",
];

const SYMBOL: Record<string, string> = {
  pressure: "P",
  temperature: "T",
  density: "D",
  specific_volume: "v",
  enthalpy: "h",
  entropy: "s",
  internal_energy: "u",
  quality: "x",
};

const PATH_POINTS = 40;

type Node =
  | { kind: "state"; stmt: Extract<Stmt, { kind: "state" }> }
  | { kind: "let"; stmt: Extract<Stmt, { kind: "let" }> };

export function evaluate(source: string, engine: Engine): ScriptResult {
  const { statements, diagnostics } = parse(source);
  const report = (e: unknown, fallback: Span) => {
    const span = e instanceof EvalError && e.span ? e.span : fallback;
    diagnostics.push({ ...span, message: errorMessage(e) });
  };

  // Settings: fluid and units.
  let unitSystem: UnitSystem = "celsius";
  let defaultFluid: string | undefined;
  for (const stmt of statements) {
    if (stmt.kind === "units") {
      if (isUnitSystem(stmt.system)) unitSystem = stmt.system;
      else
        report(
          new EvalError(
            `Unknown unit system "${stmt.system}" (celsius, kelvin or imperial)`,
          ),
          stmt.span,
        );
    }
    if (stmt.kind === "fluid") {
      if (defaultFluid !== undefined)
        report(new EvalError("The fluid is already set"), stmt.span);
      else defaultFluid = stmt.name;
    }
  }

  const fluids = new Map<string, EngineFluid>();
  const openFluid = (name: string, span: Span): EngineFluid => {
    let f = fluids.get(name);
    if (!f) {
      try {
        f = engine.fluid(name);
      } catch (e) {
        throw new EvalError(errorMessage(e), span);
      }
      fluids.set(name, f);
    }
    return f;
  };
  let fluidName: string | undefined;
  if (defaultFluid !== undefined) {
    const stmt = statements.find((s) => s.kind === "fluid")!;
    try {
      fluidName = openFluid(defaultFluid, stmt.span).name;
    } catch (e) {
      report(e, stmt.span);
    }
  }

  const pairs = new Set(
    engine.pairs().flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]),
  );

  // Definitions, by name; states and variables have separate namespaces.
  const nodes = new Map<string, Node>();
  const order: string[] = [];
  for (const stmt of statements) {
    if (stmt.kind !== "state" && stmt.kind !== "let") continue;
    const key = `${stmt.kind}:${stmt.name}`;
    if (nodes.has(key)) {
      report(
        new EvalError(
          `${stmt.kind === "state" ? "State" : "Variable"} "${stmt.name}" is defined twice`,
        ),
        stmt.span,
      );
      continue;
    }
    nodes.set(
      key,
      stmt.kind === "state" ? { kind: "state", stmt } : { kind: "let", stmt },
    );
    order.push(key);
  }

  // Dependency order (Kahn); what is left over is on a cycle.
  const deps = new Map<string, Set<string>>();
  for (const key of order) {
    const node = nodes.get(key)!;
    const found = new Set<string>();
    if (node.kind === "let") collectDeps(node.stmt.expr, found);
    else {
      const { def } = node.stmt;
      if (def.kind === "pair") {
        collectDeps(def.a.expr, found);
        collectDeps(def.b.expr, found);
      } else {
        found.add(`state:${def.from}`);
        def.args.forEach((a) => collectDeps(a.expr, found));
      }
    }
    deps.set(key, new Set([...found].filter((d) => nodes.has(d) && d !== key)));
    if (found.has(key)) deps.get(key)!.add(key);
  }
  const sorted: string[] = [];
  const remaining = new Map([...deps].map(([k, d]) => [k, new Set(d)]));
  let progress = true;
  while (progress) {
    progress = false;
    for (const key of order) {
      const d = remaining.get(key);
      if (d && d.size === 0) {
        sorted.push(key);
        remaining.delete(key);
        remaining.forEach((other) => other.delete(key));
        progress = true;
      }
    }
  }

  const states = new Map<string, ScriptState>();
  // Kept out of the result, which is posted from the worker.
  const hints = new Map<string, PathHint>();
  const solvedIn = new Map<string, EngineFluid>();
  const values = new Map<string, ScriptValue>();
  const failed = new Set<string>();

  for (const key of remaining.keys()) {
    const node = nodes.get(key)!;
    const message = "Circular dependency";
    failed.add(key);
    report(new EvalError(message), node.stmt.span);
    if (node.kind === "state") {
      states.set(node.stmt.name, {
        name: node.stmt.name,
        line: node.stmt.span.line,
        how: "",
        error: message,
      });
    } else {
      values.set(node.stmt.name, {
        name: node.stmt.name,
        line: node.stmt.span.line,
        error: message,
      });
    }
  }

  const ctx: Ctx = { states, values, unitSystem };

  for (const key of sorted) {
    const node = nodes.get(key)!;
    const stmt = node.stmt;
    const blocked = [...deps.get(key)!].find((d) => failed.has(d));
    if (node.kind === "let") {
      const v: ScriptValue = { name: stmt.name, line: stmt.span.line };
      values.set(stmt.name, v);
      if (blocked) {
        v.error = `Depends on ${blocked.replace(":", " ")}, which failed`;
        failed.add(key);
        continue;
      }
      try {
        v.value = evalExpr(node.stmt.expr, ctx);
      } catch (e) {
        v.error = errorMessage(e);
        failed.add(key);
        report(e, stmt.span);
      }
      continue;
    }

    const s = node.stmt;
    const entry: ScriptState = {
      name: s.name,
      line: s.span.line,
      how:
        s.def.kind === "pair"
          ? `${pairLabel(s.def.a.name)}, ${pairLabel(s.def.b.name)}`
          : `${s.def.process} from ${s.def.from}`,
    };
    states.set(s.name, entry);
    if (blocked) {
      entry.error = `Depends on ${blocked.replace(":", " ")}, which failed`;
      failed.add(key);
      continue;
    }
    try {
      // A process stays in its starting state's fluid.
      const origin =
        s.def.kind === "process" ? states.get(s.def.from)?.fluid : undefined;
      const name = s.fluid ?? origin ?? defaultFluid;
      if (name === undefined)
        throw new EvalError(
          "No fluid: add a line `fluid <name>`, or give one: state 1 [Water]: ...",
          s.span,
        );
      const fluid = openFluid(name, s.span);
      entry.fluid = fluid.name;
      solvedIn.set(s.name, fluid);
      if (s.def.kind === "pair") {
        const a = input(s.def.a, ctx);
        const b = input(s.def.b, ctx);
        entry.inputs = makeInputs(a, b, pairs, s.span);
      } else {
        const solved = processInputs(s.def, entry, fluid, ctx, pairs);
        entry.inputs = solved.inputs;
        hints.set(s.name, solved.hint);
      }
      entry.state = solve(fluid, entry.inputs, s.span);
    } catch (e) {
      entry.error = errorMessage(e);
      failed.add(key);
      report(e, s.span);
    }
  }

  // Prints, after everything they may name.
  const prints: ScriptResult["prints"] = [];
  for (const stmt of statements) {
    if (stmt.kind !== "print") continue;
    for (const item of stmt.items) {
      const p: ScriptValue & { text: string } = {
        name: item.text,
        text: item.text,
        line: stmt.span.line,
      };
      try {
        p.value = evalExpr(item.expr, ctx);
      } catch (e) {
        p.error = errorMessage(e);
        report(e, stmt.span);
      }
      prints.push(p);
    }
  }

  // Cycles: the path of each leg.
  const paths: ScriptPath[] = [];
  for (const stmt of statements) {
    if (stmt.kind !== "cycle") continue;
    for (let i = 0; i + 1 < stmt.states.length; i++) {
      const a = states.get(stmt.states[i].name);
      const b = states.get(stmt.states[i + 1].name);
      for (const [ref, st] of [
        [stmt.states[i], a],
        [stmt.states[i + 1], b],
      ] as const) {
        if (!st) report(new EvalError(`Unknown state "${ref.name}"`), ref.span);
      }
      const fluid = a && solvedIn.get(a.name);
      if (!a?.state || !b?.state || !fluid) continue;
      if (a.fluid !== b.fluid) {
        report(
          new EvalError(`States ${a.name} and ${b.name} are different fluids`),
          stmt.states[i].span,
        );
        continue;
      }
      paths.push(
        samplePath(a.name, a.state, b.name, b.state, hints.get(b.name), fluid),
      );
    }
  }

  diagnostics.sort((x, y) => x.line - y.line || x.col - y.col);
  const bySource = (x: { line: number }, y: { line: number }) =>
    x.line - y.line;
  return {
    diagnostics,
    fluid: fluidName,
    unitSystem,
    states: [...states.values()].sort(bySource),
    values: [...values.values()].sort(bySource),
    prints,
    paths,
  };
}

type Ctx = {
  states: Map<string, ScriptState>;
  values: Map<string, ScriptValue>;
  unitSystem: UnitSystem;
};

function collectDeps(e: Expr, out: Set<string>) {
  switch (e.kind) {
    case "var":
      out.add(`let:${e.name}`);
      break;
    case "prop":
      out.add(`state:${e.state}`);
      break;
    case "neg":
      collectDeps(e.arg, out);
      break;
    case "bin":
      collectDeps(e.left, out);
      collectDeps(e.right, out);
      break;
    case "call":
      e.args.forEach((a) => collectDeps(a, out));
      break;
  }
}

function pairLabel(name: string): string {
  const input = INPUT_ALIASES[name];
  return input ? SYMBOL[input] : name;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function readProperty(state: ScriptState, prop: string, span: Span): Quantity {
  const name = PROPERTY_ALIASES[prop];
  if (!name || name === "phase") {
    throw new EvalError(
      `Unknown property "${prop}" (T, P, D, v, h, s, u, x, cp, cv, mu, k, Pr, Z, a, g)`,
      span,
    );
  }
  const st = state.state!;
  const raw = name === "specific_volume" ? 1 / st.density : st[name];
  if (raw === null || raw === undefined) {
    const why =
      name === "quality"
        ? ` (state ${state.name} is ${st.phase?.replace("_", "-") ?? "not two-phase"})`
        : "";
    throw new EvalError(
      `${prop} is undefined for state ${state.name}${why}`,
      span,
    );
  }
  return {
    value: raw as number,
    dim: PROPERTY_DIM[name],
    absolute: name === "temperature",
  };
}

function evalExpr(e: Expr, ctx: Ctx): Quantity {
  switch (e.kind) {
    case "num":
      return literal(e.value, e.unit);
    case "var": {
      const v = ctx.values.get(e.name);
      if (!v) {
        const hint = ctx.states.has(e.name)
          ? ` ("${e.name}" is a state: read a property, e.g. ${e.name}.h)`
          : "";
        throw new EvalError(`Unknown variable "${e.name}"${hint}`, e.span);
      }
      if (!v.value)
        throw new EvalError(`Variable "${e.name}" has no value`, e.span);
      return v.value;
    }
    case "prop": {
      const st = ctx.states.get(e.state);
      if (!st) throw new EvalError(`Unknown state "${e.state}"`, e.span);
      if (!st.state)
        throw new EvalError(`State "${e.state}" was not solved`, e.span);
      return readProperty(st, e.prop, e.span);
    }
    case "neg": {
      const q = evalExpr(e.arg, ctx);
      return { value: -q.value, dim: q.dim };
    }
    case "bin":
      return binary(
        e.op,
        evalExpr(e.left, ctx),
        evalExpr(e.right, ctx),
        e.span,
      );
    case "call":
      return callFunction(
        e.fn,
        e.args.map((a) => evalExpr(a, ctx)),
        e.span,
      );
  }
}

function binary(
  op: "+" | "-" | "*" | "/" | "^",
  a: Quantity,
  b: Quantity,
  span: Span,
): Quantity {
  switch (op) {
    case "+":
    case "-":
      if (!dimEq(a.dim, b.dim)) {
        throw new EvalError(
          `Cannot ${op === "+" ? "add" : "subtract"} quantities of different dimensions`,
          span,
        );
      }
      return {
        value: op === "+" ? a.value + b.value : a.value - b.value,
        dim: a.dim,
        // T + ΔT is a temperature; T - T is a difference.
        absolute:
          op === "+" ? a.absolute !== b.absolute : a.absolute && !b.absolute,
      };
    case "*":
      return { value: a.value * b.value, dim: dimMul(a.dim, b.dim) };
    case "/":
      return { value: a.value / b.value, dim: dimMul(a.dim, b.dim, -1) };
    case "^":
      if (!isDimensionless(b.dim)) {
        throw new EvalError("An exponent must be dimensionless", span);
      }
      return { value: a.value ** b.value, dim: dimPow(a.dim, b.value) };
  }
}

function callFunction(fn: string, args: Quantity[], span: Span): Quantity {
  const arity = (n: number) => {
    if (args.length !== n)
      throw new EvalError(
        `${fn}() takes ${n} argument${n === 1 ? "" : "s"}`,
        span,
      );
  };
  const dimensionless = () => {
    if (!isDimensionless(args[0].dim))
      throw new EvalError(`${fn}() takes a dimensionless value`, span);
  };
  switch (fn) {
    case "sqrt":
      arity(1);
      return { value: Math.sqrt(args[0].value), dim: dimPow(args[0].dim, 0.5) };
    case "abs":
      arity(1);
      return { ...args[0], value: Math.abs(args[0].value) };
    case "min":
    case "max": {
      if (args.length === 0)
        throw new EvalError(`${fn}() takes at least one argument`, span);
      if (!args.every((a) => dimEq(a.dim, args[0].dim))) {
        throw new EvalError(`${fn}() takes values of one dimension`, span);
      }
      const pick = args.reduce((m, a) =>
        (fn === "min" ? a.value < m.value : a.value > m.value) ? a : m,
      );
      return pick;
    }
    case "ln":
    case "exp":
    case "log10":
      arity(1);
      dimensionless();
      return {
        value: Math[fn === "ln" ? "log" : fn](args[0].value),
        dim: NONE,
      };
  }
  throw new EvalError(
    `Unknown function "${fn}" (sqrt, abs, min, max, ln, exp, log10)`,
    span,
  );
}

/**
 * A value for `input` in SI. A number without a unit is read in the unit
 * system, so with `units celsius`, `T = 25` is 25 °C and `P = 100` is 100 kPa.
 */
function toInput(
  q: Quantity,
  name: InputName | "specific_volume",
  ctx: Ctx,
  span: Span,
  label: string,
): number {
  const dim = PROPERTY_DIM[name];
  if (dimEq(q.dim, dim)) return q.value;
  if (isDimensionless(q.dim)) return toSI(name, q.value, ctx.unitSystem);
  throw new EvalError(
    `${label} must be a ${name.replace("_", " ")}: the value has other units`,
    span,
  );
}

function input(
  a: Assign,
  ctx: Ctx,
): { name: InputName; value: number; span: Span } {
  const name = INPUT_ALIASES[a.name];
  if (!name) {
    throw new EvalError(
      `"${a.name}" cannot fix a state (use T, P, D, v, h, s, u or x)`,
      a.span,
    );
  }
  const value = toInput(evalExpr(a.expr, ctx), name, ctx, a.span, a.name);
  // v = 1/D: coolprop-rs is given the density.
  return name === "specific_volume"
    ? { name: "density", value: 1 / value, span: a.span }
    : { name, value, span: a.span };
}

function makeInputs(
  a: { name: InputName; value: number },
  b: { name: InputName; value: number },
  pairs: Set<string>,
  span: Span,
): StateInputs {
  if (a.name === b.name)
    throw new EvalError(`Both properties are ${SYMBOL[a.name]}`, span);
  if (!pairs.has(`${a.name}|${b.name}`)) {
    throw new EvalError(
      `The pair ${SYMBOL[a.name]}, ${SYMBOL[b.name]} is not supported`,
      span,
    );
  }
  return { [a.name]: a.value, [b.name]: b.value } as unknown as StateInputs;
}

function solve(fluid: EngineFluid, inputs: StateInputs, span: Span): State {
  try {
    return fluid.state(inputs);
  } catch (e) {
    throw new EvalError(errorMessage(e), span);
  }
}

function processInputs(
  def: Extract<Extract<Stmt, { kind: "state" }>["def"], { kind: "process" }>,
  entry: ScriptState,
  fluid: EngineFluid,
  ctx: Ctx,
  pairs: Set<string>,
): { inputs: StateInputs; hint: PathHint } {
  const fromEntry = ctx.states.get(def.from);
  if (!fromEntry)
    throw new EvalError(`Unknown state "${def.from}"`, def.fromSpan);
  const from = fromEntry.state!;
  if (fromEntry.fluid !== entry.fluid) {
    throw new EvalError(
      `State ${def.from} is ${fromEntry.fluid}, not ${entry.fluid}`,
      def.fromSpan,
    );
  }
  const span = def.fromSpan;
  if (!PROCESSES.includes(def.process)) {
    throw new EvalError(
      `Unknown process "${def.process}" (${PROCESSES.join(", ")})`,
      span,
    );
  }
  const named = new Map(def.args.map((a) => [a.name, a]));
  const take = (name: string): Assign | undefined => {
    const a = named.get(name);
    named.delete(name);
    return a;
  };
  const scalar = (name: string, what: string): number => {
    const a = take(name);
    if (!a)
      throw new EvalError(`${def.process}() needs ${name} = ${what}`, span);
    const q = evalExpr(a.expr, ctx);
    if (!isDimensionless(q.dim))
      throw new EvalError(`${name} must be dimensionless`, a.span);
    return q.value;
  };
  /** The one property the process is aimed at, e.g. P = 1.2 MPa. */
  const target = (): { name: InputName; value: number; span: Span } => {
    const rest = [...named.values()];
    if (rest.length !== 1) {
      throw new EvalError(
        `${def.process}() takes one target property, e.g. ${def.process}(P = 1 MPa)`,
        span,
      );
    }
    named.clear();
    return input(rest[0], ctx);
  };

  const conserved = CONSERVED[def.process];
  if (conserved) {
    const t = target();
    if (t.name === conserved) {
      throw new EvalError(
        `An ${def.process} process keeps ${SYMBOL[conserved]}: give another property`,
        t.span,
      );
    }
    return {
      inputs: makeInputs(
        { name: conserved, value: from[conserved] as number },
        t,
        pairs,
        span,
      ),
      hint: { kind: "conserve", from: def.from, input: conserved },
    };
  }
  if (def.process === "compress" || def.process === "expand") {
    const eta = scalar("eta", "an isentropic efficiency, e.g. 0.8");
    if (!(eta > 0 && eta <= 1))
      throw new EvalError("eta must be in (0, 1]", span);
    const t = target();
    const ideal = solve(
      fluid,
      makeInputs({ name: "entropy", value: from.entropy }, t, pairs, span),
      span,
    );
    const h =
      def.process === "compress"
        ? from.enthalpy + (ideal.enthalpy - from.enthalpy) / eta
        : from.enthalpy - eta * (from.enthalpy - ideal.enthalpy);
    return {
      inputs: makeInputs({ name: "enthalpy", value: h }, t, pairs, span),
      hint:
        eta === 1
          ? { kind: "conserve", from: def.from, input: "entropy" }
          : { kind: "real", from: def.from },
    };
  }
  // polytropic: P v^n = const.
  const n = scalar("n", "the polytropic exponent, e.g. 1.3");
  const t = target();
  if (t.name !== "pressure")
    throw new EvalError(
      "polytropic() is aimed at a pressure: polytropic(n = 1.3, P = ...)",
      t.span,
    );
  const density = from.density * (t.value / from.pressure) ** (1 / n);
  return {
    inputs: { pressure: t.value, density },
    hint: { kind: "polytropic", from: def.from, n },
  };
}

function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-6 * Math.max(Math.abs(a), Math.abs(b), 1e-12);
}

/** Points along the leg a → b, by how b was reached or what a and b share. */
function samplePath(
  aName: string,
  a: State,
  bName: string,
  b: State,
  hint: PathHint | undefined,
  fluid: EngineFluid,
): ScriptPath {
  const line: ScriptPath = {
    from: aName,
    to: bName,
    fluid: fluid.name,
    kind: "line",
    states: [a, b],
  };
  let keep: InputName | undefined;
  let polytropic: number | undefined;
  if (hint && hint.from === aName) {
    if (hint.kind === "conserve") keep = hint.input;
    if (hint.kind === "polytropic") polytropic = hint.n;
  }
  if (!keep && polytropic === undefined) {
    // A pair-defined leg: follow the property both ends share, if any.
    if (close(a.pressure, b.pressure)) keep = "pressure";
    else if (close(a.entropy, b.entropy)) keep = "entropy";
    else if (close(a.enthalpy, b.enthalpy)) keep = "enthalpy";
    else if (close(a.temperature, b.temperature)) keep = "temperature";
    else if (close(a.density, b.density)) keep = "density";
    else return line;
  }

  const lerp = (x: number, y: number, t: number) => x + (y - x) * t;
  const glerp = (x: number, y: number, t: number) => x * (y / x) ** t;
  const inputs: StateInputs[] = [];
  for (let i = 1; i < PATH_POINTS; i++) {
    const t = i / PATH_POINTS;
    if (polytropic !== undefined) {
      const p = glerp(a.pressure, b.pressure, t);
      inputs.push({
        pressure: p,
        density: a.density * (p / a.pressure) ** (1 / polytropic),
      });
    } else if (keep === "pressure") {
      inputs.push({
        pressure: a.pressure,
        enthalpy: lerp(a.enthalpy, b.enthalpy, t),
      });
    } else if (keep === "temperature") {
      inputs.push({
        temperature: a.temperature,
        entropy: lerp(a.entropy, b.entropy, t),
      });
    } else if (keep === "density") {
      inputs.push({
        density: a.density,
        enthalpy: lerp(a.enthalpy, b.enthalpy, t),
      });
    } else if (keep === "entropy") {
      inputs.push({
        pressure: glerp(a.pressure, b.pressure, t),
        entropy: a.entropy,
      });
    } else {
      inputs.push({
        pressure: glerp(a.pressure, b.pressure, t),
        enthalpy: a.enthalpy,
      });
    }
  }
  const middle = fluid
    .states(inputs)
    .filter((s): s is State => !(s instanceof Error));
  return { ...line, kind: "process", states: [a, ...middle, b] };
}
