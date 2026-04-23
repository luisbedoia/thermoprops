import { describe, it, expect } from "vitest";
import {
  scaleToPlotlyType,
  isSaturationCurve,
  getSaturationLabel,
  generateEvenlySpacedValues,
  buildIsolineTraces,
  buildPointTrace,
  buildPlotLayout,
} from "../plotUtils";
import type { PlotPoint } from "../plotUtils";

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

// Note: buildIsolineTraces / buildPointTrace / buildPlotLayout call getParameterInfo
// internally, which accesses window.CP. In the node test environment, window is
// undefined → the try-catch in getParameterInfo returns "" for all labels.
// Tests here verify structure and logic, not label strings.

describe("buildIsolineTraces", () => {
  it("returns one trace per isoline", () => {
    const isolines = [
      { parameter: 19, value: 300, x: [1, 2], y: [3, 4] },
      { parameter: 19, value: 400, x: [5, 6], y: [7, 8] },
    ];
    expect(buildIsolineTraces(isolines, 5, 2)).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(buildIsolineTraces([], 5, 2)).toEqual([]);
  });

  it("each trace is a scatter line with correct x/y", () => {
    const isolines = [{ parameter: 19, value: 300, x: [1, 2], y: [10, 20] }];
    const [trace] = buildIsolineTraces(isolines, 5, 2);
    expect(trace.type).toBe("scatter");
    expect(trace.mode).toBe("lines");
    expect(trace.x).toEqual([1, 2]);
    expect(trace.y).toEqual([10, 20]);
  });

  it("saturation curves (Q=0 or Q=1) use solid red lines", () => {
    const liquid = [{ parameter: 21, value: 0, x: [1], y: [2] }];
    const vapor = [{ parameter: 21, value: 1, x: [1], y: [2] }];
    const [liquidTrace] = buildIsolineTraces(liquid, 5, 2);
    const [vaporTrace] = buildIsolineTraces(vapor, 5, 2);
    expect(liquidTrace.line).toMatchObject({ dash: "solid", color: "#dc2626" });
    expect(vaporTrace.line).toMatchObject({ dash: "solid", color: "#dc2626" });
  });

  it("non-saturation isolines use dashed palette colors", () => {
    const isolines = [{ parameter: 19, value: 300, x: [1], y: [2] }];
    const [trace] = buildIsolineTraces(isolines, 5, 2);
    expect(trace.line).toMatchObject({ dash: "dash" });
    expect(typeof (trace.line as Record<string, unknown>).color).toBe("string");
  });

  it("cycles through palette when there are more isolines than palette colors", () => {
    const isolines = Array.from({ length: 9 }, (_, i) => ({
      parameter: 19,
      value: 280 + i * 10,
      x: [i],
      y: [i],
    }));
    const traces = buildIsolineTraces(isolines, 5, 2);
    const color0 = (traces[0].line as Record<string, unknown>).color;
    const color7 = (traces[7].line as Record<string, unknown>).color;
    expect(color0).toBe(color7); // palette has 7 colors → index 7 wraps to index 0
  });

  it("saturation curves have greater line width than isolines", () => {
    const saturation = [{ parameter: 21, value: 0, x: [1], y: [2] }];
    const isoline = [{ parameter: 19, value: 300, x: [1], y: [2] }];
    const [satTrace] = buildIsolineTraces(saturation, 5, 2);
    const [isoTrace] = buildIsolineTraces(isoline, 5, 2);
    const satWidth = (satTrace.line as Record<string, unknown>).width as number;
    const isoWidth = (isoTrace.line as Record<string, unknown>).width as number;
    expect(satWidth).toBeGreaterThan(isoWidth);
  });
});

describe("buildPointTrace", () => {
  it("returns null for an empty points array", () => {
    expect(buildPointTrace([], 5, 2)).toBeNull();
  });

  it("returns a markers trace for non-empty points", () => {
    const points: PlotPoint[] = [{ id: "1", label: "State 1", x: 100, y: 200 }];
    const trace = buildPointTrace(points, 5, 2);
    expect(trace).not.toBeNull();
    expect(trace?.type).toBe("scatter");
    expect(trace?.mode).toBe("markers");
  });

  it("maps x, y, and text correctly from each point", () => {
    const points: PlotPoint[] = [
      { id: "a", label: "A", x: 10, y: 100 },
      { id: "b", label: "B", x: 20, y: 200 },
    ];
    const trace = buildPointTrace(points, 5, 2);
    expect(trace?.x).toEqual([10, 20]);
    expect(trace?.y).toEqual([100, 200]);
    expect(trace?.text).toEqual(["A", "B"]);
  });

  it("names the trace 'Tracked states'", () => {
    const points: PlotPoint[] = [{ id: "1", label: "S1", x: 1, y: 2 }];
    expect(buildPointTrace(points, 5, 2)?.name).toBe("Tracked states");
  });
});

describe("buildPlotLayout", () => {
  it("sets the fluid and plot label in the title", () => {
    const layout = buildPlotLayout("Water", "pH Diagram", 5, 2, 0, 1, "right");
    expect(layout.title).toMatchObject({ text: "Water - pH Diagram" });
  });

  it("uses vertical legend and wide right margin when legendPlacement is right", () => {
    const layout = buildPlotLayout("Water", "test", 5, 2, 0, 1, "right");
    expect(layout.legend).toMatchObject({ orientation: "v" });
    expect(layout.margin).toMatchObject({ r: 160 });
  });

  it("uses horizontal legend and tall bottom margin when legendPlacement is bottom", () => {
    const layout = buildPlotLayout("Water", "test", 5, 2, 0, 1, "bottom");
    expect(layout.legend).toMatchObject({ orientation: "h" });
    expect(layout.margin).toMatchObject({ b: 100 });
  });

  it("sets dragmode to pan", () => {
    const layout = buildPlotLayout("Water", "test", 5, 2, 0, 1, "right");
    expect(layout.dragmode).toBe("pan");
  });

  it("sets log scale on y-axis for scale=1", () => {
    const layout = buildPlotLayout("Water", "test", 5, 2, 0, 1, "right");
    expect((layout.yaxis as Record<string, unknown>).type).toBe("log");
  });

  it("sets linear scale on x-axis for scale=0", () => {
    const layout = buildPlotLayout("Water", "test", 5, 2, 0, 1, "right");
    expect((layout.xaxis as Record<string, unknown>).type).toBe("linear");
  });

  it("applies white background colors", () => {
    const layout = buildPlotLayout("Water", "test", 5, 2, 0, 0, "right");
    expect(layout.paper_bgcolor).toBe("#f8fafc");
    expect(layout.plot_bgcolor).toBe("#ffffff");
  });
});
