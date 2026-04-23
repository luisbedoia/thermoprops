import { describe, it, expect } from "vitest";
import {
  scaleToPlotlyType,
  isSaturationCurve,
  getSaturationLabel,
  generateEvenlySpacedValues,
} from "../plotUtils";

describe("scaleToPlotlyType", () => {
  it("returns linear for scale 0", () => {
    expect(scaleToPlotlyType(0)).toBe("linear");
  });

  it("returns log for scale 1", () => {
    expect(scaleToPlotlyType(1)).toBe("log");
  });
});

describe("isSaturationCurve", () => {
  it("returns true for Q=0 (saturated liquid)", () => {
    expect(isSaturationCurve(21, 0)).toBe(true);
  });

  it("returns true for Q=1 (saturated vapor)", () => {
    expect(isSaturationCurve(21, 1)).toBe(true);
  });

  it("returns false for Q values other than 0 or 1", () => {
    expect(isSaturationCurve(21, 0.5)).toBe(false);
    expect(isSaturationCurve(21, 0.1)).toBe(false);
    expect(isSaturationCurve(21, 2)).toBe(false);
  });

  it("returns false when parameter is not 21", () => {
    expect(isSaturationCurve(19, 0)).toBe(false);
    expect(isSaturationCurve(19, 1)).toBe(false);
    expect(isSaturationCurve(0, 0)).toBe(false);
  });
});

describe("getSaturationLabel", () => {
  it("returns Saturated Liquid for value 0", () => {
    expect(getSaturationLabel(0)).toBe("Saturated Liquid");
  });

  it("returns Saturated Vapor for value 1", () => {
    expect(getSaturationLabel(1)).toBe("Saturated Vapor");
  });

  it("returns empty string for other values", () => {
    expect(getSaturationLabel(0.5)).toBe("");
    expect(getSaturationLabel(2)).toBe("");
    expect(getSaturationLabel(-1)).toBe("");
  });
});

describe("generateEvenlySpacedValues", () => {
  it("returns [min] when count is 1", () => {
    expect(generateEvenlySpacedValues(0, 10, 1)).toEqual([0]);
    expect(generateEvenlySpacedValues(5, 20, 1)).toEqual([5]);
  });

  it("returns [min, max] when count is 2", () => {
    expect(generateEvenlySpacedValues(0, 10, 2)).toEqual([0, 10]);
  });

  it("returns evenly spaced values for count > 2", () => {
    expect(generateEvenlySpacedValues(0, 10, 5)).toEqual([0, 2.5, 5, 7.5, 10]);
  });

  it("starts at min and ends at max", () => {
    const values = generateEvenlySpacedValues(3, 7, 10);
    expect(values[0]).toBe(3);
    expect(values[values.length - 1]).toBe(7);
  });

  it("returns correct count of values", () => {
    expect(generateEvenlySpacedValues(0, 100, 6)).toHaveLength(6);
    expect(generateEvenlySpacedValues(0, 100, 15)).toHaveLength(15);
  });

  it("handles min equal to max", () => {
    expect(generateEvenlySpacedValues(5, 5, 3)).toEqual([5, 5, 5]);
  });

  it("handles negative ranges", () => {
    const values = generateEvenlySpacedValues(-10, 10, 3);
    expect(values).toEqual([-10, 0, 10]);
  });
});
