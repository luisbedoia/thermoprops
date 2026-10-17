import { beforeAll, describe, expect, it } from "vitest";
import type { CoolProp } from "@luisbedoia/coolprop-rs-wasm";
import { loadRealCoolProp } from "../../test-fixtures/realCoolProp";
import {
  evaluate,
  PROCESSES as EVAL_PROCESSES,
  PROPERTY_ALIASES,
  type ScriptResult,
} from "../evaluate";
import { TEMPLATES } from "../templates";
import { PROCESSES, PROPERTIES } from "../vocabulary";
import { parse } from "../parser";

let cp: CoolProp;

beforeAll(async () => {
  cp = await loadRealCoolProp();
});

function run(source: string): ScriptResult {
  return evaluate(source, cp);
}

function state(result: ScriptResult, name: string) {
  const s = result.states.find((x) => x.name === name);
  expect(s?.error).toBeUndefined();
  return s!.state!;
}

function value(result: ScriptResult, name: string) {
  const v = result.values.find((x) => x.name === name);
  expect(v?.error).toBeUndefined();
  return v!.value!;
}

const REFRIGERATION = `
fluid R134a
units celsius

state 1: T = -10 °C, x = 1
state 2s = 1 -> isentropic(P = 1.2 MPa)
let eta_c = 0.8
state 2: P = 2s.P, h = 1.h + (2s.h - 1.h) / eta_c
state 3: P = 2.P, x = 0
state 4 = 3 -> throttle(P = 1.P)

let q_evap = 1.h - 4.h
let w_comp = 2.h - 1.h
let COP = q_evap / w_comp
let m_dot = 0.05 kg/s
let Q_evap = m_dot * q_evap

cycle 1 -> 2 -> 3 -> 4 -> 1
print COP, Q_evap
`;

describe("parser", () => {
  it("reads state references, units and processes", () => {
    const { statements, diagnostics } = parse(REFRIGERATION);
    expect(diagnostics).toEqual([]);
    const s1 = statements.find((s) => s.kind === "state" && s.name === "1");
    expect(s1).toMatchObject({
      def: {
        kind: "pair",
        a: { name: "T", expr: { kind: "num", value: -10, unit: "°C" } },
        b: { name: "x", expr: { kind: "num", value: 1 } },
      },
    });
    const s4 = statements.find((s) => s.kind === "state" && s.name === "4");
    expect(s4).toMatchObject({
      def: { kind: "process", from: "3", process: "throttle" },
    });
  });

  it("reports each bad line and keeps parsing the rest", () => {
    const { statements, diagnostics } = parse(
      "state 1 T = 300 K\nlet a = 2 *\nlet b = 3",
    );
    expect(diagnostics.map((d) => d.line)).toEqual([1, 2]);
    expect(statements).toHaveLength(1);
  });

  it("accepts phone keyboard variants", () => {
    const { diagnostics } = parse(
      "state 2 = 1 → isentropic(P = 5 bar)\nlet a = 2 × 3 − 1",
    );
    expect(diagnostics).toEqual([]);
  });
});

describe("evaluate", () => {
  it("solves a refrigeration cycle", () => {
    const r = run(REFRIGERATION);
    expect(r.diagnostics).toEqual([]);
    expect(r.fluid).toBe("R134a");

    const s1 = state(r, "1");
    const s2s = state(r, "2s");
    const s2 = state(r, "2");
    const s4 = state(r, "4");
    expect(s1.temperature).toBeCloseTo(263.15, 6);
    expect(s2s.entropy).toBeCloseTo(s1.entropy, 3);
    expect(s2.enthalpy - s1.enthalpy).toBeCloseTo(
      (s2s.enthalpy - s1.enthalpy) / 0.8,
      3,
    );
    expect(s4.enthalpy).toBeCloseTo(state(r, "3").enthalpy, 3);
    expect(s4.phase).toBe("two_phase");

    const cop = value(r, "COP");
    expect(cop.dim).toEqual([0, 0, 0, 0]);
    expect(cop.value).toBeGreaterThan(2);
    expect(cop.value).toBeLessThan(5);
    // kg/s × J/kg = W
    expect(value(r, "Q_evap").dim).toEqual([1, 2, -3, 0]);
    expect(r.prints.map((p) => p.text)).toEqual(["COP", "Q_evap"]);
  });

  it("draws cycle legs along their processes", () => {
    const r = run(REFRIGERATION);
    expect(r.paths.map((p) => [p.from, p.to, p.kind])).toEqual([
      ["1", "2", "line"], // real compression: path unknown
      ["2", "3", "process"], // same P: isobaric
      ["3", "4", "process"], // throttle
      ["4", "1", "process"], // same P
    ]);
    const throttle = r.paths[2].states;
    expect(throttle.length).toBeGreaterThan(10);
    for (const s of throttle)
      expect(s.enthalpy).toBeCloseTo(throttle[0].enthalpy, 0);
  });

  it("evaluates in dependency order and reports cycles", () => {
    const r = run(
      "fluid Water\nlet b = a * 2\nlet a = 3\nlet c = d\nlet d = c",
    );
    expect(value(r, "b").value).toBe(6);
    expect(r.values.find((v) => v.name === "c")?.error).toBe(
      "Circular dependency",
    );
  });

  it("reads numbers without units in the unit system", () => {
    const r = run("fluid Water\nunits celsius\nstate 1: T = 25, P = 101.325");
    const s = state(r, "1");
    expect(s.temperature).toBeCloseTo(298.15, 9);
    expect(s.pressure).toBeCloseTo(101325, 3);
  });

  it("rejects mixed dimensions and unsupported pairs", () => {
    const r = run(
      "fluid Water\nstate 1: T = 25 °C, P = 1 bar\nlet bad = 1.P + 1.h\nstate 2: T = 30 °C, h = 1.h",
    );
    expect(r.values[0].error).toMatch(/different dimensions/);
    expect(r.states.find((s) => s.name === "2")?.error).toMatch(
      /T, h is not supported/,
    );
    expect(r.diagnostics.map((d) => d.line)).toEqual([3, 4]);
  });

  it("skips what depends on a failed state", () => {
    const r = run(
      "fluid Water\nstate 1: T = 25 °C, P = -1 bar\nstate 2 = 1 -> isobaric(T = 50 °C)",
    );
    expect(r.states[0].error).toBeDefined();
    expect(r.states[1].error).toBe("Depends on state 1, which failed");
  });

  it("supports per-state fluids, polytropic and expansion processes", () => {
    const r = run(`
fluid Air
state 1: T = 300 K, P = 1 bar
state 2 = 1 -> polytropic(n = 1.3, P = 8 bar)
state w [Water]: T = 500 °C, P = 50 bar
state w2 = w -> expand(P = 0.1 bar, eta = 0.85)
let pv1 = 1.P * 1.v ^ 1.3
let pv2 = 2.P * 2.v ^ 1.3
`);
    expect(r.diagnostics).toEqual([]);
    expect(value(r, "pv2").value).toBeCloseTo(value(r, "pv1").value, 3);
    expect(state(r, "w2").phase).toBe("two_phase");
    expect(r.states.find((s) => s.name === "w2")?.fluid).toBe("Water");
  });

  it("keeps temperature differences apart from temperatures", () => {
    const r = run(
      "fluid Water\nstate 1: T = 20 °C, P = 1 bar\nstate 2: T = 1.T + 15 K, P = 1 bar\nlet dT = 2.T - 1.T",
    );
    expect(state(r, "2").temperature).toBeCloseTo(308.15, 9);
    expect(value(r, "dT")).toMatchObject({
      value: expect.closeTo(15, 9),
      absolute: false,
    });
  });
});

describe("templates", () => {
  it.each(TEMPLATES.map((t) => [t.name, t] as const))(
    "%s solves cleanly",
    (_, t) => {
      const r = run(t.source);
      expect(r.diagnostics).toEqual([]);
      expect(r.states.every((s) => s.state)).toBe(true);
      expect(r.prints.every((p) => p.value)).toBe(true);
    },
  );
});

describe("vocabulary", () => {
  it("documents what the evaluator accepts", () => {
    expect(PROCESSES.map((p) => p.name).sort()).toEqual(
      [...EVAL_PROCESSES].sort(),
    );
    for (const p of PROPERTIES)
      expect(PROPERTY_ALIASES[p.name]).toBe(
        p.field === "specific_volume" ? "specific_volume" : p.field,
      );
  });
});
