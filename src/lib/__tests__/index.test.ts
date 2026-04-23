import { describe, it, expect } from "vitest";
import {
  checkValidProperty,
  checkValidInputProperty,
  getPropertyDefinition,
  properties,
} from "../index";

describe("checkValidProperty", () => {
  it("returns true for a valid property name", () => {
    expect(checkValidProperty("T")).toBe(true);
    expect(checkValidProperty("P")).toBe(true);
    expect(checkValidProperty("H")).toBe(true);
    expect(checkValidProperty("CPMASS")).toBe(true);
  });

  it("throws for an unknown property name", () => {
    expect(() => checkValidProperty("UNKNOWN")).toThrow("Invalid property: UNKNOWN.");
    expect(() => checkValidProperty("")).toThrow();
  });
});

describe("checkValidInputProperty", () => {
  it("does not throw for properties with input: true", () => {
    const inputProps = properties.filter((p) => p.input).map((p) => p.name);
    for (const name of inputProps) {
      expect(() => checkValidInputProperty(name)).not.toThrow();
    }
  });

  it("throws for output-only properties", () => {
    // CPMASS has input: false
    expect(() => checkValidInputProperty("CPMASS")).toThrow("Invalid input property: CPMASS.");
    expect(() => checkValidInputProperty("CVMASS")).toThrow();
    expect(() => checkValidInputProperty("G")).toThrow();
    expect(() => checkValidInputProperty("PHASE")).toThrow();
  });

  it("throws for completely unknown property", () => {
    expect(() => checkValidInputProperty("BOGUS")).toThrow();
  });
});

describe("getPropertyDefinition", () => {
  it("returns the property definition for a known name", () => {
    const prop = getPropertyDefinition("T");
    expect(prop).toBeDefined();
    expect(prop?.name).toBe("T");
    expect(prop?.unit).toBe("K");
    expect(prop?.input).toBe(true);
  });

  it("returns undefined for an unknown property", () => {
    expect(getPropertyDefinition("UNKNOWN")).toBeUndefined();
    expect(getPropertyDefinition("")).toBeUndefined();
  });

  it("returns correct definition for all declared properties", () => {
    for (const declared of properties) {
      const found = getPropertyDefinition(declared.name);
      expect(found).toEqual(declared);
    }
  });
});
