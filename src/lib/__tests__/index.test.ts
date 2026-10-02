import { beforeEach, describe, expect, it } from "vitest";
import { setCoolProp } from "../../coolprop";
import { fakeCoolProp, LIQUID_WATER, TWO_PHASE_WATER } from "../../test-fixtures/fakeCoolProp";
import {
  areCompatibleInputs,
  displayUnit,
  fromSI,
  getDisplayUnit,
  getFluidDetails,
  getFluidsList,
  inputs,
  isInputName,
  phaseLabel,
  plotValue,
  quantityValue,
  solveState,
  tableQuantities,
  toSI,
} from "../index";

let fake: ReturnType<typeof fakeCoolProp>;

beforeEach(() => {
  fake = fakeCoolProp();
  setCoolProp(fake.cp);
});

describe("inputs", () => {
  it("are the catalog's seven inputs", () => {
    expect(inputs().map((i) => i.name)).toEqual([
      "pressure",
      "temperature",
      "density",
      "enthalpy",
      "entropy",
      "internal_energy",
      "quality",
    ]);
  });

  it("recognizes only catalog names", () => {
    expect(isInputName("temperature")).toBe(true);
    expect(isInputName("T")).toBe(false);
    expect(isInputName("cp")).toBe(false);
  });
});

describe("areCompatibleInputs", () => {
  it("accepts the pairs CoolProp solves, in either order", () => {
    expect(areCompatibleInputs("pressure", "temperature")).toBe(true);
    expect(areCompatibleInputs("temperature", "pressure")).toBe(true);
    expect(areCompatibleInputs("quality", "temperature")).toBe(true);
    expect(areCompatibleInputs("enthalpy", "entropy")).toBe(true);
  });

  it("rejects pairs CoolProp cannot solve and repeated inputs", () => {
    expect(areCompatibleInputs("temperature", "enthalpy")).toBe(false);
    expect(areCompatibleInputs("entropy", "internal_energy")).toBe(false);
    expect(areCompatibleInputs("temperature", "temperature")).toBe(false);
  });
});

describe("solveState", () => {
  it("passes both inputs by name to the fluid", () => {
    const state = solveState("Water", "temperature", 300, "pressure", 101325);
    expect(state).toBe(LIQUID_WATER);
    expect(fake.cp.fluid("Water").state).toHaveBeenCalledWith({
      temperature: 300,
      pressure: 101325,
    });
  });

  it("propagates CoolProp failures", () => {
    expect(() => solveState("Unobtainium", "temperature", 1, "pressure", 1)).toThrow(
      "unknown fluid",
    );
  });
});

describe("fluid metadata", () => {
  it("lists the catalog sorted", () => {
    const list = getFluidsList();
    expect(list).toHaveLength(30);
    expect(list).toEqual([...list].sort());
    expect(list).toContain("Water");
  });

  it("returns aliases and formula, omitting an empty formula", () => {
    expect(getFluidDetails("Water").aliases).toContain("H2O");
    expect(getFluidDetails("Water").formula).toBeTruthy();
    expect(getFluidDetails("Air").formula).toBeUndefined();
  });
});

describe("quantities", () => {
  it("follow the property catalog with specific volume after density", () => {
    const order = tableQuantities();
    expect(order.slice(0, 4)).toEqual(["pressure", "temperature", "density", "specific_volume"]);
    expect(order).toContain("speed_of_sound");
    expect(order).not.toContain("phase");
  });

  it("derive specific volume and keep undefined values as null", () => {
    expect(quantityValue(LIQUID_WATER, "specific_volume")).toBeCloseTo(1 / 996.5569, 12);
    expect(quantityValue(LIQUID_WATER, "cp")).toBe(4180.6);
    expect(quantityValue(TWO_PHASE_WATER, "cp")).toBeNull();
    expect(plotValue(LIQUID_WATER, "specific_volume")).toBeCloseTo(1 / 996.5569, 12);
    expect(plotValue(LIQUID_WATER, "enthalpy")).toBe(112654.9);
  });

  it("label phases", () => {
    expect(phaseLabel("two_phase")).toBe("two-phase");
    expect(phaseLabel(null)).toBe("unknown");
  });
});

describe("units by coolprop-rs name", () => {
  it("convert temperature and pressure for display and back", () => {
    expect(fromSI("temperature", 373.15, "celsius")).toBeCloseTo(100, 10);
    expect(toSI("temperature", 212, "imperial")).toBeCloseTo(373.15, 10);
    expect(fromSI("pressure", 101325, "celsius")).toBeCloseTo(101.325, 10);
    expect(getDisplayUnit("pressure", "imperial")).toBe("psi");
  });

  it("cover the quantities new to the app", () => {
    expect(getDisplayUnit("speed_of_sound", "celsius")).toBe("m/s");
    expect(getDisplayUnit("speed_of_sound", "imperial")).toBe("ft/s");
    expect(fromSI("speed_of_sound", 304.8, "imperial")).toBeCloseTo(1000, 10);
    expect(getDisplayUnit("internal_energy", "celsius")).toBe("kJ/kg");
    expect(getDisplayUnit("specific_volume", "imperial")).toBe("ft^3/lb");
  });

  it("describe each conversion as an affine map for coolprop-rs", () => {
    expect(displayUnit("temperature", "celsius")).toEqual({ scale: 1, offset: -273.15 });
    expect(displayUnit("pressure", "celsius")).toEqual({ scale: 1e-3, offset: 0 });
    const f = displayUnit("temperature", "imperial");
    expect(f.scale).toBeCloseTo(1.8, 12);
    expect(f.offset).toBeCloseTo(-459.67, 9);
    expect(displayUnit("quality", "imperial")).toEqual({ scale: 1, offset: 0 });
  });

  it("leave dimensionless quantities unitless", () => {
    expect(getDisplayUnit("quality", "imperial")).toBe("");
    expect(fromSI("prandtl", 5.8, "imperial")).toBe(5.8);
  });
});
