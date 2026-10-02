import { describe, expect, it } from "vitest";
import type {
  AxisData,
  DiagramInfo,
  IsolineCurve,
} from "@luisbedoia/coolprop-rs-wasm";
import {
  buildAxisTitle,
  buildDomeTraces,
  buildIsolineLabel,
  buildIsolineTraces,
  buildPlotLayout,
  buildPointTrace,
  diagramLabel,
  viewRange,
} from "../plotUtils";

const PH: DiagramInfo = {
  id: "pressure_enthalpy",
  x: { property: "enthalpy", scale: "linear" },
  y: { property: "pressure", scale: "log" },
  isolines: ["temperature", "density", "entropy", "internal_energy", "quality"],
};

const isoline = (
  value: number,
  x: (number | null)[] = [1e5, 2e5],
): IsolineCurve => ({
  kind: "temperature",
  value,
  x,
  y: x.map((v) => (v === null ? null : 1e5)),
});

describe("labels", () => {
  it("name axes with symbol and display unit", () => {
    expect(buildAxisTitle("pressure", "celsius")).toBe("P (kPa)");
    expect(buildAxisTitle("temperature", "imperial")).toBe("T (°F)");
    expect(buildAxisTitle("quality", "celsius")).toBe("x");
  });

  it("name isolines with symbol, value in display units and unit", () => {
    expect(buildIsolineLabel("temperature", 373.15, "celsius")).toBe(
      "T 100 °C",
    );
    expect(buildIsolineLabel("quality", 0.5, "celsius")).toBe("x 0.5");
  });

  it("name diagrams by their axes", () => {
    expect(diagramLabel(PH)).toBe("Pressure – Specific enthalpy (P–h)");
  });
});

describe("buildDomeTraces", () => {
  const dome = {
    liquid: { x: [1e5, 2e5], y: [1e4, 1e6] },
    vapor: { x: [2.5e6, 2e5], y: [1e4, 1e6] },
  };

  it("draws both branches as solid red lines", () => {
    const traces = buildDomeTraces(dome, "enthalpy", "pressure", "celsius");
    expect(traces.map((t) => t.name)).toEqual([
      "Saturated liquid",
      "Saturated vapor",
    ]);
    for (const t of traces) {
      expect(t.line).toMatchObject({ color: "#dc2626", width: 2 });
      expect((t.line as { dash?: string }).dash).toBeUndefined();
    }
  });

  it("converts to display units", () => {
    const [liquid] = buildDomeTraces(dome, "enthalpy", "pressure", "celsius");
    expect(liquid.x).toEqual([100, 200]); // kJ/kg
    expect(liquid.y).toEqual([10, 1000]); // kPa
  });
});

describe("buildIsolineTraces", () => {
  it("returns one dashed trace per isoline, cycling the palette", () => {
    const traces = buildIsolineTraces(
      Array.from({ length: 8 }, (_, i) => isoline(300 + i)),
      "enthalpy",
      "pressure",
    );
    expect(traces).toHaveLength(8);
    expect(
      traces.every((t) => (t.line as { dash: string }).dash === "dash"),
    ).toBe(true);
    expect((traces[7].line as { color: string }).color).toBe(
      (traces[0].line as { color: string }).color,
    );
  });

  it("keeps unsolvable points as null breaks", () => {
    const [trace] = buildIsolineTraces(
      [isoline(300, [1e5, null, 2e5])],
      "enthalpy",
      "pressure",
    );
    expect(trace.x).toEqual([100, null, 200]);
    expect(trace.y).toEqual([100, null, 100]);
  });

  it("labels each trace with its value", () => {
    const [trace] = buildIsolineTraces(
      [isoline(373.15)],
      "enthalpy",
      "pressure",
      "kelvin",
    );
    expect(trace.name).toBe("T 373.2 K");
  });
});

describe("buildPointTrace", () => {
  it("returns null without points", () => {
    expect(buildPointTrace([], "enthalpy", "pressure")).toBeNull();
  });

  it("marks each tracked state in display units", () => {
    const trace = buildPointTrace(
      [{ id: "a", label: "State 1", x: 112654.9, y: 101325 }],
      "enthalpy",
      "pressure",
      "celsius",
    )!;
    expect(trace).toMatchObject({
      mode: "markers",
      name: "Tracked states",
      text: ["State 1"],
    });
    expect((trace.x as number[])[0]).toBeCloseTo(112.6549, 6);
    expect((trace.y as number[])[0]).toBeCloseTo(101.325, 6);
  });
});

describe("viewRange", () => {
  const axis = (
    property: AxisData["property"],
    range: [number, number],
  ): AxisData => ({
    property,
    scale: "linear",
    range,
  });

  it("caps temperature at 1.5 Tc", () => {
    expect(viewRange(axis("temperature", [276, 1456]), 647.096)).toEqual([
      276, 970.644,
    ]);
  });

  it("leaves other axes as they are", () => {
    expect(viewRange(axis("entropy", [0, 9000]), 647.096)).toEqual([0, 9000]);
  });

  it("is null without a range", () => {
    expect(
      viewRange({ property: "enthalpy", scale: "linear", range: null }, 647),
    ).toBeNull();
  });
});

describe("buildPlotLayout", () => {
  const x: AxisData = {
    property: "enthalpy",
    scale: "linear",
    range: [0, 3e6],
  };
  const y: AxisData = { property: "pressure", scale: "log", range: [1e3, 1e7] };

  it("sets the title and axis types from the diagram", () => {
    const layout = buildPlotLayout(
      "Water - P–h",
      x,
      y,
      "right",
      [0, 3e6],
      [1e3, 1e7],
      "celsius",
    );
    expect(layout.title).toMatchObject({ text: "Water - P–h" });
    expect(layout.xaxis).toMatchObject({ type: "linear", range: [0, 3000] });
    // Log axes take log10 of the display-unit range (kPa here).
    expect(layout.yaxis).toMatchObject({ type: "log", range: [0, 4] });
  });

  it("places the legend", () => {
    const right = buildPlotLayout("t", x, y, "right", null, null);
    const bottom = buildPlotLayout("t", x, y, "bottom", null, null);
    expect(right.legend).toMatchObject({ orientation: "v" });
    expect(bottom.legend).toMatchObject({ orientation: "h" });
    expect((right.xaxis as { range?: unknown }).range).toBeUndefined();
  });
});
