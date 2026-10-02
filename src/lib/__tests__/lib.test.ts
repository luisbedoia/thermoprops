import { beforeEach, describe, expect, it } from "vitest";
import { setCoolProp } from "../../coolprop";
import { fakeCoolProp, LIQUID_WATER, TWO_PHASE_WATER } from "../../test-fixtures/fakeCoolProp";
import { phaseInfo, quantityInfo, quantityValue, tableQuantities } from "../quantities";
import { displayUnit, fromSI, getDisplayUnit, resolveUnitSystem, toSI } from "../units";
import { symbolToMath } from "../unitsFormat";

beforeEach(() => {
  setCoolProp(fakeCoolProp().cp);
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
    expect(quantityValue(LIQUID_WATER, "enthalpy")).toBe(112654.9);
  });

  it("label phases", () => {
    expect(phaseInfo("two_phase")).toMatchObject({
      label: "two-phase",
      description: "Liquid-vapor mixture inside the saturation dome",
    });
    expect(phaseInfo(null)).toBeUndefined();
  });

  it("take symbols and descriptions from the coolprop-rs catalogs", () => {
    expect(quantityInfo("pressure")).toMatchObject({ symbol: "p", description: "Pressure" });
    expect(quantityInfo("conductivity").symbol).toBe("λ");
    // Not a State property: from the diagram-axis catalog.
    expect(quantityInfo("specific_volume")).toMatchObject({
      symbol: "v",
      description: "Specific volume",
    });
  });

  it("render multi-letter symbols as one italic name", () => {
    expect(symbolToMath("cp")).toBe("\\mathit{cp}");
    expect(symbolToMath("ρ")).toBe("ρ");
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

  it("accept only the three unit systems", () => {
    expect(resolveUnitSystem("imperial")).toBe("imperial");
    expect(resolveUnitSystem("si")).toBe("celsius");
    expect(resolveUnitSystem(null)).toBe("celsius");
  });

  it("leave dimensionless quantities unitless", () => {
    expect(getDisplayUnit("quality", "imperial")).toBe("");
    expect(fromSI("prandtl", 5.8, "imperial")).toBe(5.8);
  });
});
