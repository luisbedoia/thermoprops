// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  areCompatibleInputs,
  calculateProperties,
  calculateProperty,
  getFluidDetails,
  getFluidsList,
  phaseLabel,
  validateStateInputs,
} from "../index";

// The 14 pairs coolprop-rs solves (cp.pairs()).
const RS_PAIRS = [
  ["pressure", "temperature"],
  ["pressure", "quality"],
  ["quality", "temperature"],
  ["density", "pressure"],
  ["enthalpy", "pressure"],
  ["pressure", "entropy"],
  ["pressure", "internal_energy"],
  ["density", "temperature"],
  ["entropy", "temperature"],
  ["density", "quality"],
  ["density", "enthalpy"],
  ["density", "entropy"],
  ["density", "internal_energy"],
  ["enthalpy", "entropy"],
];

const LIQUID = {
  pressure: 101325,
  temperature: 300,
  density: 996.5,
  enthalpy: 112654,
  entropy: 393,
  internal_energy: 112552,
  quality: null,
  phase: "liquid",
  cp: 4180,
  cv: 4130,
  viscosity: 8.5e-4,
  conductivity: 0.61,
  prandtl: 5.8,
  gibbs: -5300,
  compressibility: 0.0007,
  speed_of_sound: 1501,
};

const TWO_PHASE = {
  ...LIQUID,
  temperature: 373.12,
  density: 1.2,
  quality: 0.5,
  phase: "two_phase",
  cp: null,
  cv: null,
  viscosity: null,
  conductivity: null,
  prandtl: null,
  compressibility: null,
};

let state: ReturnType<typeof vi.fn>;

beforeEach(() => {
  state = vi.fn().mockReturnValue(LIQUID);
  window.CPRS = {
    pairs: () => RS_PAIRS,
    catalog: () => [{ name: "Water" }, { name: "Air" }, { name: "Ammonia" }],
    fluid: vi.fn((name: string) => ({
      name,
      data: {
        name,
        aliases: name === "Air" ? [] : ["H2O", "R718"],
        formula: name === "Air" ? "" : "H_{2}O_{1}",
      },
      critical: { temperature: 647.096, pressure: 22.064e6, density: 322 },
      state,
    })),
  } as unknown as typeof window.CPRS;
});

describe("areCompatibleInputs", () => {
  it("accepts the pairs coolprop-rs solves, in either order", () => {
    expect(areCompatibleInputs("T", "P")).toBe(true);
    expect(areCompatibleInputs("P", "T")).toBe(true);
    expect(areCompatibleInputs("Q", "T")).toBe(true);
    expect(areCompatibleInputs("H", "S")).toBe(true);
  });

  it("rejects pairs CoolProp cannot solve", () => {
    // Offered before the migration, but CoolProp does not implement them.
    expect(areCompatibleInputs("T", "H")).toBe(false);
    expect(areCompatibleInputs("T", "U")).toBe(false);
    expect(areCompatibleInputs("S", "U")).toBe(false);
    expect(areCompatibleInputs("Q", "H")).toBe(false);
  });

  it("rejects repeated and unknown inputs", () => {
    expect(areCompatibleInputs("T", "T")).toBe(false);
    expect(areCompatibleInputs("T", "CPMASS")).toBe(false);
  });
});

describe("calculateProperties", () => {
  it("solves once with the translated inputs", () => {
    calculateProperties("T", 300, "P", 101325, "Water");
    expect(window.CPRS.fluid).toHaveBeenCalledWith("Water");
    expect(state).toHaveBeenCalledTimes(1);
    expect(state).toHaveBeenCalledWith({ temperature: 300, pressure: 101325 });
  });

  it("returns every output except the inputs, in table order", () => {
    const names = calculateProperties("T", 300, "P", 101325, "Water").map(
      (r) => r.name,
    );
    expect(names).toEqual([
      "D",
      "H",
      "S",
      "U",
      "SPECVOL",
      "CPMASS",
      "CVMASS",
      "PHASE",
      "G",
      "Z",
      "L",
      "V",
      "PRANDTL",
    ]);
  });

  it("derives specific volume and keeps CoolProp's phase codes", () => {
    const results = calculateProperties("T", 300, "P", 101325, "Water");
    const value = (name: string) => results.find((r) => r.name === name)?.value;
    expect(value("SPECVOL")).toBeCloseTo(1 / 996.5, 12);
    expect(value("PHASE")).toBe(0);
    expect(phaseLabel(value("PHASE")!)).toBe("liquid");
  });

  it("skips properties undefined for the state", () => {
    state.mockReturnValue(TWO_PHASE);
    const results = calculateProperties("P", 101325, "Q", 0.5, "Water");
    const names = results.map((r) => r.name);
    expect(names).not.toContain("CPMASS");
    expect(names).not.toContain("V");
    expect(results.find((r) => r.name === "PHASE")?.value).toBe(6);
  });

  it("throws when the state cannot be solved", () => {
    state.mockImplementation(() => {
      throw new Error("out of range");
    });
    expect(() => calculateProperties("T", -10, "P", 101325, "Water")).toThrow(
      "out of range",
    );
    expect(() => validateStateInputs("T", -10, "P", 101325, "Water")).toThrow();
  });
});

describe("calculateProperty", () => {
  it("reads a single property", () => {
    expect(calculateProperty("H", "T", 300, "P", 101325, "Water")).toBe(112654);
  });

  it("throws for a property undefined in the state", () => {
    state.mockReturnValue(TWO_PHASE);
    expect(() =>
      calculateProperty("CPMASS", "P", 101325, "Q", 0.5, "Water"),
    ).toThrow("undefined");
  });
});

describe("fluid metadata", () => {
  it("lists the catalog sorted", async () => {
    expect(await getFluidsList()).toEqual(["Air", "Ammonia", "Water"]);
  });

  it("returns aliases and formula, omitting an empty formula", async () => {
    expect(await getFluidDetails("Water")).toEqual({
      aliases: ["H2O", "R718"],
      formula: "H_{2}O_{1}",
    });
    expect(await getFluidDetails("Air")).toEqual({
      aliases: [],
      formula: undefined,
    });
  });
});
