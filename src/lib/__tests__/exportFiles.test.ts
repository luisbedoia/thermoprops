import { beforeEach, describe, expect, it } from "vitest";
import { setCoolProp } from "../../coolprop";
import { fakeCoolProp, LIQUID_WATER, TWO_PHASE_WATER } from "../../test-fixtures/fakeCoolProp";
import type { ComputedState, StateDefinition } from "../../workspace/types";
import { fileName, statesToCsv } from "../exportFiles";

beforeEach(() => {
  setCoolProp(fakeCoolProp().cp);
});

const definition = (overrides: Partial<StateDefinition> = {}): StateDefinition => ({
  id: "a",
  label: "State 1",
  property1: "temperature",
  value1: "300",
  property2: "pressure",
  value2: "101325",
  ...overrides,
});

const last = (row: string[]) => row[row.length - 1];

/** Parses the simple CSV written here (fields without line breaks). */
function parse(csv: string): string[][] {
  return csv
    .trimEnd()
    .split("\r\n")
    .map((line) => line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.slice(0, -1).map((f) => {
      const v = f.replace(/,$/, "");
      return v.startsWith('"') ? v.slice(1, -1).replace(/""/g, '"') : v;
    }));
}

describe("statesToCsv", () => {
  it("writes every table quantity in display units, with its unit", () => {
    const rows = parse(
      statesToCsv([{ definition: definition(), state: LIQUID_WATER }], "celsius"),
    );
    const header = rows[0];
    expect(header.slice(0, 2)).toEqual(["State", "Defined by"]);
    expect(header).toContain("Temperature T (°C)");
    expect(header).toContain("Pressure p (kPa)");
    expect(header).toContain("Specific volume v (m³/kg)");
    expect(last(header)).toBe("Phase");

    const row = rows[1];
    const at = (h: string) => Number(row[header.indexOf(h)]);
    expect(row[0]).toBe("State 1");
    expect(row[1]).toBe("T, p");
    expect(at("Temperature T (°C)")).toBeCloseTo(26.85, 9);
    expect(at("Pressure p (kPa)")).toBeCloseTo(101.325, 9);
    expect(at("Specific volume v (m³/kg)")).toBeCloseTo(1 / 996.5569, 12);
    expect(last(row)).toBe("liquid");
    expect(row).toHaveLength(header.length);
  });

  it("leaves undefined properties empty and keeps unsolved states", () => {
    const states: ComputedState[] = [
      { definition: definition({ property2: "quality", value2: "0.5" }), state: TWO_PHASE_WATER },
      { definition: definition({ id: "b", label: "Bad, state" }), error: "Unable to evaluate this state." },
    ];
    const [header, twoPhase, bad] = parse(statesToCsv(states, "kelvin"));
    // Transport properties are undefined inside the dome.
    const viscosity = header.findIndex((h) => h.startsWith("Dynamic viscosity"));
    expect(viscosity).toBeGreaterThan(1);
    expect(twoPhase[viscosity]).toBe("");
    expect(Number(twoPhase[header.indexOf("Vapor quality; only inside the two-phase region x")])).toBe(0.5);
    expect(last(twoPhase)).toBe("two-phase");
    // The comma in the label is quoted, the row keeps its shape.
    expect(bad[0]).toBe("Bad, state");
    expect(bad).toHaveLength(header.length);
    expect(last(bad)).toBe("Unable to evaluate this state.");
  });
});

describe("fileName", () => {
  it("makes a safe, lower-case name", () => {
    expect(fileName("R1234ze(E)", "pressure_enthalpy")).toBe("thermoprops-r1234ze-e-pressure-enthalpy");
  });
});
