/**
 * Evaluates a parsed script against a synchronous CoolProp. Statements are
 * assignments: each state and value is solved once its dependencies are, in
 * dependency order (not source order), and a cycle among them is an error.
 * A failure is reported where it happens; what depends on it is skipped.
 *
 * Runs in a worker (see worker.ts), where the synchronous API is cheap.
 */
import type {
  InputName,
  ReferenceState,
  State,
  StateInputs,
} from "@luisbedoia/coolprop-rs-wasm";
import { isUnitSystem, toSI, type UnitSystem } from "../lib/units";
import {
  parse,
  PROCESSES,
  type Assign,
  type Diagnostic,
  type Expr,
  type Span,
  type Stmt,
} from "./parser";
import {
  convertTo,
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
  /** Throws for a fluid it does not know, or one that cannot take the reference. */
  fluid(name: string, options: { reference: ReferenceState }): EngineFluid;
}

/**
 * Where enthalpy and entropy are measured from, by the names a script may
 * use, and the state each one fixes (for messages).
 */
export const REFERENCES: Record<ReferenceState, string> = {
  DEF: "the fluid's own (CoolProp's default)",
  IIR: "h = 200 kJ/kg, s = 1 kJ/(kg·K) for the saturated liquid at 0 °C",
  ASHRAE: "h = s = 0 for the saturated liquid at −40 °C",
  NBP: "h = s = 0 for the saturated liquid at 1 atm",
};

function isReference(name: string): name is ReferenceState {
  return Object.prototype.hasOwnProperty.call(REFERENCES, name);
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
  /** A print's "in °F". */
  unit?: string;
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
  /** Where enthalpy and entropy are measured from, for every fluid. */
  reference: ReferenceState;
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

/** A fluid that would not open: reported once, not by each of its states. */
class FluidError extends EvalError {}

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
  throttled: "enthalpy",
  isobaric: "pressure",
  isothermal: "temperature",
  isochoric: "density",
};

export { PROCESSES };

/**
 * Properties a script may read as the textbooks write them, `h1` for state
 * 1's h, `T2s` for state 2s's T: a short name and a state whose name starts
 * with a digit. Not Q, which in "Q12" is a heat.
 */
const TEXTBOOK = /^(T|P|p|D|rho|v|h|s|u|x|cp|cv|mu|k|Pr|Z|a|g)(\d\w*)$/;

/** `h1` as state 1's h; undefined for a name that is not of that shape. */
export function textbookProperty(
  name: string,
): { state: string; prop: string } | undefined {
  const m = TEXTBOOK.exec(name);
  return m ? { state: m[2], prop: m[1] } : undefined;
}

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

/** States along a drawn leg: as many as along an isoline on the chart, so a
 *  leg and the isoline it follows have the same resolution. */
const PATH_POINTS = 120;

type Node =
  | { kind: "state"; stmt: Extract<Stmt, { kind: "state" }> }
  | { kind: "value"; stmt: Extract<Stmt, { kind: "value" }> };

export function evaluate(source: string, engine: Engine): ScriptResult {
  const { statements, diagnostics } = parse(source);
  const report = (e: unknown, fallback: Span) => {
    const span = e instanceof EvalError && e.span ? e.span : fallback;
    diagnostics.push({ ...span, message: errorMessage(e) });
  };

  // Settings: fluid, units and reference state.
  let unitSystem: UnitSystem = "celsius";
  let defaultFluid: string | undefined;
  let reference: ReferenceState = "DEF";
  let referenceStmt: Stmt | undefined;
  for (const stmt of statements) {
    if (stmt.kind === "reference") {
      const name = stmt.name.toUpperCase();
      if (referenceStmt)
        report(new EvalError("The reference state is already set"), stmt.span);
      else if (isReference(name)) {
        reference = name;
        referenceStmt = stmt;
      } else
        report(
          new EvalError(
            `Unknown reference state "${stmt.name}" (IIR, ASHRAE, NBP or DEF)`,
          ),
          stmt.span,
        );
    }
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

  // Each fluid opened once; one that fails is reported once, where it
  // fails first (a reference it cannot take: at the `reference` line).
  const fluids = new Map<string, EngineFluid | FluidError>();
  const openFluid = (name: string, span: Span): EngineFluid => {
    let f = fluids.get(name);
    if (!f) {
      try {
        f = engine.fluid(name, { reference });
      } catch (e) {
        const cannot =
          reference !== "DEF" &&
          (e as { kind?: string }).kind === "invalid_input";
        f = cannot
          ? new FluidError(
              `${name} cannot take the ${reference} reference state (${REFERENCES[reference]})`,
              referenceStmt!.span,
            )
          : new FluidError(errorMessage(e), span);
        report(f, span);
      }
      fluids.set(name, f);
    }
    if (f instanceof FluidError) throw f;
    return f;
  };
  let fluidName: string | undefined;
  if (defaultFluid !== undefined) {
    const stmt = statements.find((s) => s.kind === "fluid")!;
    try {
      fluidName = openFluid(defaultFluid, stmt.span).name;
    } catch (e) {
      // Reported where it was opened.
      if (!(e instanceof FluidError)) report(e, stmt.span);
    }
  }

  const pairs = new Set(
    engine.pairs().flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]),
  );

  // Definitions, by name; states and variables have separate namespaces.
  const nodes = new Map<string, Node>();
  const order: string[] = [];
  for (const stmt of statements) {
    if (stmt.kind !== "state" && stmt.kind !== "value") continue;
    const key = `${stmt.kind}:${stmt.name}`;
    if (nodes.has(key)) {
      report(
        new EvalError(
          `${stmt.kind === "state" ? "State" : "Value"} "${stmt.name}" is defined twice`,
        ),
        stmt.span,
      );
      continue;
    }
    nodes.set(
      key,
      stmt.kind === "state" ? { kind: "state", stmt } : { kind: "value", stmt },
    );
    order.push(key);
  }

  // "h1" is state 1's h when there is a state 1; a value cannot take it.
  const stateNames = new Set(
    order.filter((k) => k.startsWith("state:")).map((k) => k.slice(6)),
  );
  const clashes = new Set<string>();
  for (const key of order) {
    if (!key.startsWith("value:")) continue;
    const name = key.slice(6);
    const tb = textbookProperty(name);
    if (tb && stateNames.has(tb.state)) {
      const stmt = nodes.get(key)!.stmt;
      report(
        new EvalError(
          `"${name}" is state ${tb.state}'s ${tb.prop}: give this value another name, e.g. ${tb.prop}_${tb.state}`,
        ),
        stmt.span,
      );
      clashes.add(key);
    }
  }
  for (const key of clashes) {
    nodes.delete(key);
    order.splice(order.indexOf(key), 1);
  }
  const resolve = (name: string) => resolveName(name, stateNames);

  // Dependency order (Kahn); what is left over is on a cycle.
  const deps = new Map<string, Set<string>>();
  for (const key of order) {
    const node = nodes.get(key)!;
    const found = new Set<string>();
    if (node.kind === "value") collectDeps(node.stmt.expr, found, resolve);
    else {
      const { def } = node.stmt;
      if (def.kind === "pair") {
        collectDeps(def.a.expr, found, resolve);
        collectDeps(def.b.expr, found, resolve);
      } else {
        found.add(`state:${def.from}`);
        def.args.forEach((a) => collectDeps(a.expr, found, resolve));
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

  const ctx: Ctx = { states, values, unitSystem, stateNames };

  for (const key of sorted) {
    const node = nodes.get(key)!;
    const stmt = node.stmt;
    const blocked = [...deps.get(key)!].find((d) => failed.has(d));
    if (node.kind === "value") {
      const v: ScriptValue = { name: stmt.name, line: stmt.span.line };
      values.set(stmt.name, v);
      if (blocked) {
        v.error = dependsOn(blocked);
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
      entry.error = dependsOn(blocked);
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
          "No fluid: add a line `fluid <name>`, or give one: 1 [Water]: ...",
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
      if (!(e instanceof FluidError)) report(e, s.span);
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
        unit: item.unit,
      };
      try {
        p.value = evalExpr(item.expr, ctx);
        if (item.unit && !convertTo(p.value, item.unit)) {
          p.value = undefined;
          throw new EvalError(
            `${item.text} cannot be shown in ${item.unit}: other dimensions`,
            item.unitSpan,
          );
        }
      } catch (e) {
        p.error = errorMessage(e);
        report(e, stmt.span);
      }
      prints.push(p);
    }
  }

  // Drawn processes: the path of each leg.
  const paths: ScriptPath[] = [];
  for (const stmt of statements) {
    if (stmt.kind !== "draw") continue;
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
    reference,
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
  /** Every state the script defines, solved or not. */
  stateNames: Set<string>;
};

/** A bare name: a value, or a property read as the textbooks write it. */
function resolveName(
  name: string,
  stateNames: Set<string>,
): { kind: "value" } | { kind: "prop"; state: string; prop: string } {
  const tb = textbookProperty(name);
  return tb && stateNames.has(tb.state)
    ? { kind: "prop", ...tb }
    : { kind: "value" };
}

function collectDeps(
  e: Expr,
  out: Set<string>,
  resolve: (name: string) => ReturnType<typeof resolveName>,
) {
  switch (e.kind) {
    case "var": {
      const r = resolve(e.name);
      out.add(r.kind === "prop" ? `state:${r.state}` : `value:${e.name}`);
      break;
    }
    case "prop":
      out.add(`state:${e.state}`);
      break;
    case "neg":
      collectDeps(e.arg, out, resolve);
      break;
    case "bin":
      collectDeps(e.left, out, resolve);
      collectDeps(e.right, out, resolve);
      break;
    case "call":
      e.args.forEach((a) => collectDeps(a, out, resolve));
      break;
  }
}

function dependsOn(key: string): string {
  const [kind, name] = [
    key.slice(0, key.indexOf(":")),
    key.slice(key.indexOf(":") + 1),
  ];
  return `Depends on ${kind === "state" ? `state ${name}` : `"${name}"`}, which failed`;
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
      const r = resolveName(e.name, ctx.stateNames);
      if (r.kind === "prop") {
        return evalExpr(
          { kind: "prop", state: r.state, prop: r.prop, span: e.span },
          ctx,
        );
      }
      const v = ctx.values.get(e.name);
      if (!v) {
        const tb = textbookProperty(e.name);
        const hint = ctx.stateNames.has(e.name)
          ? ` ("${e.name}" is a state: read a property, e.g. ${e.name}.h)`
          : tb
            ? ` (there is no state ${tb.state} to read ${tb.prop} from)`
            : "";
        throw new EvalError(`Unknown name "${e.name}"${hint}`, e.span);
      }
      if (!v.value) throw new EvalError(`"${e.name}" has no value`, e.span);
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
      arity(1);
      dimensionless();
      return {
        value: fn === "ln" ? Math.log(args[0].value) : Math.exp(args[0].value),
        dim: NONE,
      };
  }
  throw new EvalError(
    `Unknown function "${fn}" (sqrt, ln, exp, abs, min, max)`,
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
  const span = def.processSpan;
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
  const etaSpan = named.get("eta")?.span;
  const scalar = (name: string, what: string): number => {
    const a = take(name);
    if (!a) throw new EvalError(`${def.process} needs ${what}`, span);
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
        rest.length === 0
          ? `Say where ${def.process} goes, e.g. ${def.process} to P = 1 MPa`
          : `${def.process} goes to one property, not ${rest.map((a) => a.name).join(" and ")}`,
        rest[1]?.span ?? span,
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
        `${def.process} keeps ${SYMBOL[conserved]}: aim it at another property`,
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
  if (def.process === "compressed" || def.process === "expanded") {
    const eta = scalar("eta", "its isentropic efficiency, e.g. eta = 80%");
    if (!(eta > 0 && eta <= 1))
      throw new EvalError(
        "eta is between 0 and 1: write 0.8 or 80%",
        etaSpan ?? span,
      );
    const t = target();
    const ideal = solve(
      fluid,
      makeInputs({ name: "entropy", value: from.entropy }, t, pairs, span),
      span,
    );
    const h =
      def.process === "compressed"
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
  const n = scalar("n", "its exponent, e.g. n = 1.3");
  const t = target();
  if (t.name !== "pressure")
    throw new EvalError(
      "polytropic goes to a pressure: polytropic to P = ..., n = 1.3",
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
  let middle = fluid
    .states(inputs)
    .filter((s): s is State => !(s instanceof Error));
  // A leg at constant pressure or temperature that crosses the dome turns
  // a corner at its saturated liquid and vapor: those states are on the
  // leg exactly, as they are on its isoline, or the leg cuts the corner.
  if (keep === "pressure" || keep === "temperature") {
    const key = (s: State) => (keep === "pressure" ? s.enthalpy : s.entropy);
    const fixed =
      keep === "pressure"
        ? { pressure: a.pressure }
        : { temperature: a.temperature };
    const corners = fluid
      .states([
        { ...fixed, quality: 0 },
        { ...fixed, quality: 1 },
      ] as StateInputs[])
      .filter((s): s is State => !(s instanceof Error));
    const [lo, hi] = [Math.min(key(a), key(b)), Math.max(key(a), key(b))];
    const inside = corners.filter((s) => key(s) > lo && key(s) < hi);
    if (inside.length > 0) {
      const dir = key(b) >= key(a) ? 1 : -1;
      middle = [...middle, ...inside].sort((p, q) => dir * (key(p) - key(q)));
    }
  }
  return { ...line, kind: "process", states: [a, ...middle, b] };
}
