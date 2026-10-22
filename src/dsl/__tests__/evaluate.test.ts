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
import { FUNCTIONS, PROCESSES, PROPERTIES } from "../vocabulary";
import { parse } from "../parser";
import { formatNumber, formatQuantity } from "../format";

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

1: T = -10 °C, sat vapor
2s: from 1, isentropic to P = 1.2 MPa
eta_c = 0.8
2: P = P2s, h = h1 + (h2s - h1) / eta_c
3: P = P2, sat liquid
4: from 3, throttled to P = P1

q_evap = h1 - h4
w_comp = h2 - h1
COP = q_evap / w_comp
m_dot = 0.05 kg/s
Q_evap = m_dot * q_evap

draw 1 -> 2 -> 3 -> 4 -> 1
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
      def: { kind: "process", from: "3", process: "throttled" },
    });
  });

  it("reads a process's clauses in any order", () => {
    const defs = [
      "2: from 1, compressed to P = 1 MPa, eta = 80%",
      "2: compressed from 1 to P = 1 MPa, eta = 80%",
      "2: eta = 80%, from 1, compressed, P = 1 MPa",
    ].map((line) => {
      const { statements, diagnostics } = parse(line);
      expect(diagnostics).toEqual([]);
      return statements[0];
    });
    for (const d of defs) {
      expect(d).toMatchObject({
        kind: "state",
        name: "2",
        def: { kind: "process", from: "1", process: "compressed" },
      });
    }
  });

  it("tells states from values without keywords", () => {
    const { statements, diagnostics } = parse(
      "inlet [Water]: T = 25 °C, P = 1 bar\nCOP = 3",
    );
    expect(diagnostics).toEqual([]);
    expect(statements.map((s) => s.kind)).toEqual(["state", "value"]);
  });

  it("explains a state or process missing a part", () => {
    const message = (src: string) => parse(src).diagnostics[0]?.message;
    expect(message("1: T = 25 °C")).toMatch(/needs two properties/);
    expect(message("1: T = 25 °C, P = 1 bar, h = 3")).toMatch(
      /two properties, not 3/,
    );
    expect(message("2: from 1, P = 2 bar")).toMatch(/Say how it is reached/);
    expect(message("2: isentropic to P = 2 bar")).toMatch(/from 1/);
    expect(message("1: T = 25 °C, sat gas")).toMatch(/"liquid" or "vapor"/);
    expect(message("2 = 3")).toMatch(/start with a letter/);
    expect(message("COP")).toMatch(/":" .* or "="/);
    expect(message("print T1 in")).toMatch(/a unit after "in"/);
  });

  it("does not read the first syntax", () => {
    for (const line of [
      "state 1: T = 25 °C, P = 1 bar",
      "let a = 2",
      "2 = 1 -> isentropic(P = 5 bar)",
      "2: from 1, compress to P = 5 bar, eta = 0.8",
    ])
      expect(parse(line).diagnostics).toHaveLength(1);
  });

  it("reports each bad line and keeps parsing the rest", () => {
    const { statements, diagnostics } = parse("1 T = 300 K\na = 2 *\nb = 3");
    expect(diagnostics.map((d) => d.line)).toEqual([1, 2]);
    expect(statements).toHaveLength(1);
  });

  it("accepts phone keyboard variants", () => {
    const { diagnostics } = parse("a = 2 × 3 − 1\ndraw 1 → 2");
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

  it("reads properties as the textbooks write them", () => {
    const r = run(
      "fluid Water\n1: T = 25 °C, P = 1 bar\n2s: from 1, isentropic to P = 5 bar\na = h2s - h1\nb = 2s.h - 1.h\nk1 = 1.4\nk_2 = 1.4\nprint h3",
    );
    expect(value(r, "a").value).toBe(value(r, "b").value);
    expect(value(r, "k_2").value).toBe(1.4);
    expect(r.diagnostics.map((d) => d.message)).toEqual([
      `"k1" is state 1's k: give this value another name, e.g. k_1`,
      `Unknown name "h3" (there is no state 3 to read h from)`,
    ]);
    // Without a state 1, k1 is a value like any other.
    expect(value(run("k1 = 1.4\nb = k1 * 2"), "b").value).toBe(2.8);
  });

  it("fixes saturated states by name", () => {
    const r = run(
      "fluid Water\n1: P = 1 bar, sat vapor\n2: P = 1 bar, saturated liquid",
    );
    expect(state(r, "1").quality).toBe(1);
    expect(state(r, "2").quality).toBe(0);
  });

  it("prints in a chosen unit", () => {
    const r = run(
      "fluid Water\nunits celsius\n1: T = 25 °C, P = 1 bar\n2: T = 40 °C, P = 1 bar\nprint T1 in °F, T2 - T1 in °F, P1 in psi, 50% in %, T1 in kPa",
    );
    const shown = r.prints.map((p) =>
      p.value ? formatQuantity(p.value, r.unitSystem, p.unit) : p.error,
    );
    expect(shown.slice(0, 4)).toEqual([
      "77.00 °F",
      "27.00 °F",
      "14.50 psi",
      "50.00 %",
    ]);
    expect(shown[4]).toMatch(/cannot be shown in kPa/);
  });

  it("explains a process missing a part", () => {
    const errors = (src: string) =>
      run(
        `fluid Water\n1: T = 25 °C, P = 1 bar\n2: from 1, ${src}`,
      ).diagnostics.map((d) => d.message);
    expect(errors("compressed to P = 2 bar")).toEqual([
      "compressed needs its isentropic efficiency, e.g. eta = 80%",
    ]);
    expect(errors("compressed to P = 2 bar, eta = 80")).toEqual([
      "eta is between 0 and 1: write 0.8 or 80%",
    ]);
    expect(errors("isobaric")).toEqual([
      "Say where isobaric goes, e.g. isobaric to P = 1 MPa",
    ]);
    expect(errors("isobaric to P = 3 bar")).toEqual([
      "isobaric keeps P: aim it at another property",
    ]);
    expect(errors("isobaric to T = 50 °C, h = 3")).toEqual([
      "isobaric goes to one property, not T and h",
    ]);
  });

  it("solves Çengel's example 10-5, a regenerative Rankine cycle", () => {
    const t = TEMPLATES.find((x) => x.id === "regenerative")!;
    const r = run(t.source);
    expect(value(r, "y").value).toBeCloseTo(0.227, 3);
    expect(value(r, "efficiency").value).toBeCloseTo(0.463, 3);
  });

  it("solves a combined cycle of two fluids", () => {
    const t = TEMPLATES.find((x) => x.id === "combined")!;
    const r = run(t.source);
    expect(new Set(r.paths.map((p) => p.fluid))).toEqual(
      new Set(["Air", "Water"]),
    );
    expect(value(r, "efficiency").value).toBeGreaterThan(0.4);
  });

  it("knows heat transfer units", () => {
    const r = run(
      "UA = 3 kW/K\nA = 2 m^2\nU = UA / A\nQ = UA * 10 K\nprint U, Q in BTU/h",
    );
    expect(formatQuantity(value(r, "U"), "celsius")).toBe("1500.00 W/(m²·K)");
    expect(formatQuantity(value(r, "Q"), "celsius")).toBe("30.00 kW");
    expect(r.diagnostics).toEqual([]);
  });

  it("measures h and s from the reference state", () => {
    const at = (reference: string) =>
      run(
        `fluid R134a\n${reference}\n1: T = -40 °C, sat liquid\n2: P = 1 MPa, T = 50 °C\nq = h2 - h1`,
      );
    const ashrae = at("reference ASHRAE");
    const plain = at("");
    expect(ashrae.reference).toBe("ASHRAE");
    expect(plain.reference).toBe("DEF");
    expect(state(ashrae, "1").enthalpy).toBeCloseTo(0, 6);
    expect(state(ashrae, "1").entropy).toBeCloseTo(0, 9);
    expect(state(at("reference IIR"), "1").enthalpy).not.toBeCloseTo(0, 0);
    // Differences, and everything else, do not change.
    expect(value(ashrae, "q").value).toBeCloseTo(value(plain, "q").value, 6);
    expect(state(ashrae, "2").temperature).toBe(state(plain, "2").temperature);
    // Lower case is fine.
    expect(at("reference ashrae").reference).toBe("ASHRAE");
  });

  it("explains a reference a fluid cannot take, once", () => {
    const r = run(
      "fluid Water\nreference ASHRAE\n1: T = 25 °C, P = 1 bar\n2: T = 50 °C, P = 1 bar",
    );
    expect(r.diagnostics.map((d) => [d.line, d.message])).toEqual([
      [
        2,
        "Water cannot take the ASHRAE reference state (h = s = 0 for the saturated liquid at −40 °C)",
      ],
    ]);
    expect(r.states.every((s) => s.error)).toBe(true);
    expect(run("reference XYZ").diagnostics[0].message).toMatch(
      /Unknown reference state "XYZ"/,
    );
  });

  it("draws legs along their processes", () => {
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

  it("draws a leg through the dome's corners, as its isoline", () => {
    // Superheated steam cooled at 1.2 MPa down to the saturated liquid.
    const r = run(
      "fluid Water\n6: P = 1.2 MPa, T = 220 °C\n3: P = 1.2 MPa, sat liquid\ndraw 6 -> 3",
    );
    const [leg] = r.paths;
    expect(leg.kind).toBe("process");
    expect(leg.states.length).toBeGreaterThan(100);
    // The saturated vapor at 1.2 MPa is a state of the leg, exactly.
    const vapor = cp.fluid("Water").state({ pressure: 1.2e6, quality: 1 });
    expect(
      leg.states.some((s) => Math.abs(s.enthalpy - vapor.enthalpy) < 1e-6),
    ).toBe(true);
    // And the leg runs one way: enthalpy falls all along.
    for (let i = 1; i < leg.states.length; i++)
      expect(leg.states[i].enthalpy).toBeLessThanOrEqual(
        leg.states[i - 1].enthalpy + 1e-9,
      );
  });

  it("evaluates in dependency order and reports cycles", () => {
    const r = run("fluid Water\nb = a * 2\na = 3\nc = d\nd = c");
    expect(value(r, "b").value).toBe(6);
    expect(r.values.find((v) => v.name === "c")?.error).toBe(
      "Circular dependency",
    );
  });

  it("reads numbers without units in the unit system", () => {
    const r = run("fluid Water\nunits celsius\n1: T = 25, P = 101.325");
    const s = state(r, "1");
    expect(s.temperature).toBeCloseTo(298.15, 9);
    expect(s.pressure).toBeCloseTo(101325, 3);
  });

  it("rejects mixed dimensions and unsupported pairs", () => {
    const r = run(
      "fluid Water\n1: T = 25 °C, P = 1 bar\nbad = P1 + h1\n2: T = 30 °C, h = h1",
    );
    expect(r.values[0].error).toMatch(/different dimensions/);
    expect(r.states.find((s) => s.name === "2")?.error).toMatch(
      /T, h is not supported/,
    );
    expect(r.diagnostics.map((d) => d.line)).toEqual([3, 4]);
  });

  it("skips what depends on a failed state", () => {
    const r = run(
      "fluid Water\n1: T = 25 °C, P = -1 bar\n2: from 1, isobaric to T = 50 °C",
    );
    expect(r.states[0].error).toBeDefined();
    expect(r.states[1].error).toBe("Depends on state 1, which failed");
  });

  it("supports per-state fluids, polytropic and expansion processes", () => {
    const r = run(`
fluid Air
1: T = 300 K, P = 1 bar
2: from 1, polytropic to P = 8 bar, n = 1.3
w [Water]: T = 500 °C, P = 50 bar
w2: from w, expanded to P = 0.1 bar, eta = 85%
pv1 = P1 * v1 ^ 1.3
pv2 = P2 * v2 ^ 1.3
`);
    expect(r.diagnostics).toEqual([]);
    expect(value(r, "pv2").value).toBeCloseTo(value(r, "pv1").value, 3);
    expect(state(r, "w2").phase).toBe("two_phase");
    expect(r.states.find((s) => s.name === "w2")?.fluid).toBe("Water");
  });

  it("keeps temperature differences apart from temperatures", () => {
    const r = run(
      "fluid Water\n1: T = 20 °C, P = 1 bar\n2: T = T1 + 15 K, P = 1 bar\ndT = T2 - T1",
    );
    expect(state(r, "2").temperature).toBeCloseTo(308.15, 9);
    expect(value(r, "dT")).toMatchObject({
      value: expect.closeTo(15, 9),
      absolute: 0,
    });
  });

  it("reads a °C literal added to a temperature as degrees", () => {
    const r = run(
      "fluid Water\nunits celsius\n1: T = 20 °C, P = 100 kPa\n" +
        "2: T = T1 + 10 °C, P = 100 kPa\n3: T = 10 °C + T1, P = 100 kPa\n" +
        "4: T = T2 - 5 °C, P = 100 kPa\n" +
        "Tm = (T1 + T2) / 2\nTh = 0.5 * (T1 + T2)\nd = 100 °C - T1\nd2 = 30 °C - 10 °C\n" +
        "print Tm in °C, Tm, d, abs(-T1)",
    );
    expect(r.diagnostics).toEqual([]);
    expect(state(r, "2").temperature).toBeCloseTo(303.15, 9);
    expect(state(r, "3").temperature).toBeCloseTo(303.15, 9);
    expect(state(r, "4").temperature).toBeCloseTo(298.15, 9);
    expect(value(r, "Tm")).toMatchObject({
      value: expect.closeTo(298.15, 9),
      absolute: 1,
    });
    expect(value(r, "Th").absolute).toBe(1);
    expect(value(r, "d")).toMatchObject({
      value: expect.closeTo(80, 9),
      absolute: 0,
    });
    expect(value(r, "d2")).toMatchObject({
      value: expect.closeTo(20, 9),
      absolute: 0,
    });
    expect(
      r.prints.map((p) => formatQuantity(p.value!, r.unitSystem, p.unit)),
    ).toEqual(["25.00 °C", "25.00 °C", "80.00 K", "20.00 °C"]);
  });

  it("tells a temperature from a difference through arithmetic", () => {
    const r = run(
      "fluid Water\n1: T = 20 °C, P = 100 kPa\n2: T = 80 °C, P = 500 kPa\n" +
        "m1 = 2 kg/s\nm2 = 1 kg/s\nQ = 10 kW\nUA = 1 kW/K\n" +
        "Tmix = (m1*T1 + m2*T2) / (m1 + m2)\n" +
        "T2s = T1 * (P2/P1)^0.2857\n" +
        "Tg = sqrt(T1*T2)\n" +
        "dT = Q / UA\n" +
        "Tout = T1 + Q / UA\n" +
        "Tx = 2*T1 - T2\n" +
        "print Tmix, T2s, T2s in °C, Tg in °C, dT in °F, Tout, Tx",
    );
    expect(r.diagnostics).toEqual([]);
    expect(
      r.prints.map((p) => formatQuantity(p.value!, r.unitSystem, p.unit)),
    ).toEqual([
      "40.00 °C",
      "464.29 K",
      "191.14 °C",
      "48.60 °C",
      "18.00 °F",
      "30.00 °C",
      "-40.00 °C",
    ]);
  });

  it("reads a °C constant added to a temperature as degrees", () => {
    const r = run(
      "fluid Water\n1: T = 20 °C, P = 100 kPa\n2: T = T1 + 2*5 °C, P = 100 kPa",
    );
    expect(state(r, "2").temperature).toBeCloseTo(303.15, 9);
  });

  it("hints at a number missing its unit", () => {
    const r = run("fluid Water\n1: T = 20 °C, P = 100 kPa\nX = T1 + 10");
    expect(r.values[0].error).toMatch(/lack its unit\? e\.g\. 10 K/);
  });

  it("reads units as the app shows them and a Spanish keyboard types them", () => {
    const r = run(
      "fluid Water\nunits imperial\n1: T = 25 ºC, P = 1 bar\n" +
        "a = 1 kJ/(kg·K)\nb = 2 m²\nc = 1 kg/m³\nd = 1 lb/ft^3\ne = 1 BTU/(lb·°R)\nf = 300 °K\n" +
        "print T1 in ℃, a in kJ/(kg*K), b in m^2, c in kg/m^3, d in lbm/ft^3, e in BTU/(lbm*R), f",
    );
    expect(r.diagnostics).toEqual([]);
    expect(
      r.prints.map((p) => formatQuantity(p.value!, r.unitSystem, p.unit)),
    ).toEqual([
      "25.00 ℃",
      "1.00 kJ/(kg·K)",
      "2.00 m²",
      "1.00 kg/m³",
      "1.00 lbm/ft³",
      "1.00 BTU/(lbm·R)",
      "540.00 °R",
    ]);
  });

  it("takes a state named like a number with a unit", () => {
    const r = run("fluid Water\n1m: T = 20 °C, P = 1 bar\nx = 1m.h + h1m");
    expect(r.diagnostics).toEqual([]);
  });

  it("reports arithmetic that leaves the real numbers", () => {
    const errors = (expr: string) =>
      run(`X = ${expr}`).diagnostics.map((d) => d.message);
    expect(errors("1 / 0")).toEqual(["Division by zero"]);
    expect(errors("sqrt(-1)")).toEqual(["sqrt() of a negative value"]);
    expect(errors("ln(0)")).toEqual(["ln() of a value that is not positive"]);
    expect(errors("1e309")).toEqual(["Number too large"]);
    expect(errors("10^400")).toEqual([
      "The result is not a finite real number",
    ]);
    expect(errors("(-8)^0.5")).toEqual([
      "The result is not a finite real number",
    ]);
  });

  it("sets the unit system once", () => {
    const r = run(
      "fluid Water\nunits kelvin\nunits imperial\n1: T = 300, P = 100",
    );
    expect(r.unitSystem).toBe("kelvin");
    expect(r.diagnostics.map((d) => d.message)).toEqual([
      "The unit system is already set",
    ]);
  });

  it("keeps a temperature through min and max", () => {
    const r = run(
      "fluid Water\n1: T = 20 °C, P = 1 bar\n2: T = 80 °C, P = 1 bar\n" +
        "a = max(T1, 300 K)\nb = min(T1, T2 - T1)\nprint a, b",
    );
    expect(
      r.prints.map((p) => formatQuantity(p.value!, r.unitSystem, p.unit)),
    ).toEqual(["26.85 °C", "60.00 K"]);
  });

  it("reads a kelvin literal as a temperature, a difference only of two", () => {
    const r = run(
      "fluid Water\n1: T = 20 °C, P = 1 bar\n2: T = 80 °C, P = 1 bar\n" +
        "a = 323.15 K\nb = T1 + 15 K\nc = (T2 - T1) + 15 K\n" +
        "print a, a in °C, b, c in °F, 15 K in °F",
    );
    expect(
      r.prints.map((p) => formatQuantity(p.value!, r.unitSystem, p.unit)),
    ).toEqual(["323.15 K", "50.00 °C", "35.00 °C", "135.00 °F", "-432.67 °F"]);
  });

  it("points out a decimal comma", () => {
    expect(run("X = 1,5").diagnostics[0].message).toBe(
      'Unexpected ",": decimals take a point, 1.5',
    );
  });
});

describe("number format", () => {
  it("shows two decimals, a point and no thousands separator", () => {
    expect(formatNumber(1046.163)).toBe("1046.16");
    expect(formatNumber(244.5)).toBe("244.50");
    expect(formatNumber(-10)).toBe("-10.00");
    expect(formatNumber(1)).toBe("1.00");
    expect(formatNumber(1234567.891)).toBe("1234567.89");
  });

  it("shows four decimals under 1, three significant digits under 0.01", () => {
    expect(formatNumber(0.879422)).toBe("0.8794");
    expect(formatNumber(-0.5)).toBe("-0.5000");
    expect(formatNumber(0)).toBe("0.0000");
    expect(formatNumber(-0)).toBe("0.0000");
    expect(formatNumber(0.01)).toBe("0.0100");
    expect(formatNumber(0.0010207)).toBe("0.00102");
    expect(formatNumber(-0.000891)).toBe("-0.000891");
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
  it("shows function examples that work", () => {
    const given =
      "fluid Water\n1: T = 300 °C, P = 1 MPa\n2: from 1, isentropic to P = 100 kPa\n" +
      "3: T = 400 °C, P = 1 MPa\n4: P = 1 MPa, sat liquid\nR = 0.4615 kJ/(kg*K)\n" +
      "NTU = 1.5\nC_hot = 2 kW/K\nC_cold = 3 kW/K\n";
    for (const f of FUNCTIONS) {
      const r = run(given + f.example);
      expect(r.diagnostics, f.example).toEqual([]);
      expect(r.values[r.values.length - 1].value, f.example).toBeDefined();
    }
  });

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
