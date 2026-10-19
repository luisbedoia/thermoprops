import { beforeEach, describe, expect, it } from "vitest";
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
  diagramOptionLabel,
  viewRange,
  buildPathArrows,
  buildPathTraces,
} from "../plotUtils";
import { setCoolProp } from "../../coolprop";
import { fakeCoolProp } from "../../test-fixtures/fakeCoolProp";

beforeEach(() => {
  setCoolProp(fakeCoolProp().cp);
});

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
    expect(buildAxisTitle("pressure", "celsius")).toBe("p (kPa)");
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
    expect(diagramLabel(PH)).toBe("Pressure – Specific enthalpy (p–h)");
  });

  it("puts the axis symbols first in the diagram select", () => {
    expect(diagramOptionLabel(PH)).toBe("p–h · Pressure – Specific enthalpy");
  });
});

describe("buildDomeTraces", () => {
  const dome = {
    liquid: { x: [1e5, 2e5], y: [1e4, 1e6] },
    vapor: { x: [2.5e6, 2e5], y: [1e4, 1e6] },
  };

  it("draws both branches as solid red lines", () => {
    const traces = buildDomeTraces(dome, "enthalpy", "pressure", "celsius");
    expect(traces).toHaveLength(2);
    for (const t of traces) {
      expect(t.line).toMatchObject({ color: "#dc2626", width: 2 });
      expect((t.line as { dash?: string }).dash).toBeUndefined();
    }
  });

  it("lists the dome once in the legend, naming each branch on hover", () => {
    const traces = buildDomeTraces(dome, "enthalpy", "pressure", "celsius");
    expect(traces.map((t) => t.showlegend)).toEqual([true, false]);
    expect(traces[0].name).toBe("Saturation dome");
    expect(new Set(traces.map((t) => t.legendgroup)).size).toBe(1);
    expect(String(traces[0].hovertemplate)).toContain("Saturated liquid");
    expect(String(traces[1].hovertemplate)).toContain("Saturated vapor");
  });

  it("draws one saturation curve where the branches coincide (P–T)", () => {
    const curve = { x: [300, 400, 647], y: [3e3, 2e5, 2.2e7] };
    const traces = buildDomeTraces(
      { liquid: curve, vapor: { x: [...curve.x], y: [...curve.y] } },
      "temperature",
      "pressure",
      "kelvin",
    );
    expect(traces.map((t) => t.name)).toEqual(["Saturation curve"]);
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

describe("buildPathTraces", () => {
  const arrows = (traces: Record<string, unknown>[]) =>
    traces.filter(
      (t) => t.mode === "markers" && (t.x as number[]).length > 0,
    ) as {
      x: number[];
      y: number[];
      marker: { symbol: string; angleref: string };
    }[];

  it("puts an arrow halfway along each leg, aimed the way it goes", () => {
    const traces = buildPathTraces(
      [
        { label: "1 → 2", kind: "process", x: [0, 1, 2, 4], y: [0, 0, 0, 0] },
        { label: "2 → 1", kind: "line", x: [4, 0], y: [5, 5] },
      ],
      "enthalpy",
      "temperature",
      "kelvin",
    );
    expect(traces.filter((t) => t.mode === "lines")).toHaveLength(2);
    const [a, b] = arrows(traces);
    expect(a.marker).toMatchObject({ symbol: "arrow", angleref: "previous" });
    // h is shown in kJ/kg: halfway along 0 → 4 J/kg is 2 J/kg.
    expect(a.x[1]).toBeCloseTo(0.002, 9);
    expect(a.x[0]).toBeLessThan(a.x[1]);
    // Backwards: the arrow's previous point is to its right.
    expect(b.x[1]).toBeCloseTo(0.002, 9);
    expect(b.x[0]).toBeGreaterThan(b.x[1]);
  });

  it("gives no arrow to a leg too short to see", () => {
    // A pump on T–s: 0.04 K next to a 300 K boiler leg.
    const traces = buildPathTraces(
      [
        { label: "1 → 2", kind: "process", x: [649, 649], y: [319, 319.04] },
        { label: "2 → 3", kind: "process", x: [649, 7000], y: [319.04, 619] },
      ],
      "entropy",
      "temperature",
      "kelvin",
    );
    expect(traces.filter((t) => t.mode === "lines")).toHaveLength(2);
    expect(arrows(traces)).toHaveLength(1);
  });

  it("gives a short leg its arrow when zoomed in on", () => {
    const pump = {
      label: "1 → 2",
      kind: "process" as const,
      x: [649, 649.0000001, 649],
      y: [319, 319.02, 319.04],
    };
    const legs = [
      pump,
      {
        label: "2 → 3",
        kind: "process" as const,
        x: [649, 7000],
        y: [319.04, 619],
      },
    ];
    expect(
      buildPathArrows(legs, "entropy", "temperature", "kelvin")[0].x,
    ).toEqual([]);
    // Zoomed on the pump: 0.649 kJ/(kg·K) ± a bit, 319–319.04 K.
    const [arrow] = buildPathArrows(
      legs,
      "entropy",
      "temperature",
      "kelvin",
      undefined,
      {
        x: [0.6489, 0.6491],
        y: [318.99, 319.05],
      },
    );
    expect(arrow.y[1]).toBeCloseTo(319.02, 6);
    // Up, whatever the noise across: the tail is below the tip.
    expect(arrow.y[0]).toBeLessThan(arrow.y[1]);
    expect(Math.abs(arrow.x[0] - arrow.x[1])).toBeLessThan(1e-6);
  });

  it("puts the arrow on the visible part of a leg", () => {
    const leg = {
      label: "",
      kind: "line" as const,
      x: [0, 10000],
      y: [300, 300],
    };
    // Only h in 0–2 kJ/kg is in view: halfway of that is 1 kJ/kg.
    const [arrow] = buildPathArrows(
      [leg],
      "enthalpy",
      "temperature",
      "kelvin",
      undefined,
      {
        x: [0, 2],
        y: [200, 400],
      },
    );
    expect(arrow.x[1]).toBeCloseTo(1, 6);
    // Out of view, none.
    const [none] = buildPathArrows(
      [leg],
      "enthalpy",
      "temperature",
      "kelvin",
      undefined,
      {
        x: [20, 30],
        y: [200, 400],
      },
    );
    expect(none.x).toEqual([]);
  });

  it("measures halfway as a log axis shows it", () => {
    const [a] = arrows(
      buildPathTraces(
        [{ label: "", kind: "line", x: [1e3, 1e3], y: [1e3, 1e5] }],
        "enthalpy",
        "pressure",
        "kelvin",
        { x: "linear", y: "log" },
      ),
    );
    // 1 → 100 kPa on a log axis: halfway is 10 kPa, not 50.5.
    expect(a.y[1]).toBeCloseTo(10, 6);
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
  const linear = (range: [number, number] | null): AxisData => ({
    property: "entropy",
    scale: "linear",
    range,
  });

  it("centers the dome, filling 70% of the axis", () => {
    const [a, b] = viewRange(linear([-20_000, 20_000]), [
      1000,
      8000,
      null,
      4000,
    ])!;
    expect((a + b) / 2).toBeCloseTo(4500, 9);
    expect(7000 / (b - a)).toBeCloseTo(0.7, 9);
  });

  it("centers in log space on log axes", () => {
    const axis: AxisData = {
      property: "pressure",
      scale: "log",
      range: [1, 1e9],
    };
    const [a, b] = viewRange(axis, [1e3, 1e7])!;
    expect(Math.sqrt(a * b)).toBeCloseTo(1e5, 3);
    expect(4 / Math.log10(b / a)).toBeCloseTo(0.7, 9);
  });

  it("may reach past the computed range to keep the dome off the edges", () => {
    const [a] = viewRange(linear([100, 20_000]), [100, 7100])!;
    expect(a).toBeLessThan(100);
  });

  it("falls back to the full range", () => {
    expect(viewRange(linear([0, 9000]), [3000, 3000])).toEqual([0, 9000]);
    expect(viewRange(linear([0, 9000]), [])).toEqual([0, 9000]);
    expect(viewRange(linear(null), [])).toBeNull();
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

  it("labels ticks by Plotly's defaults, minor log ticks in full", () => {
    const layout = buildPlotLayout("t", x, y, "right", null, null);
    expect(layout.xaxis).not.toHaveProperty("tickformat");
    expect(layout.xaxis).not.toHaveProperty("minorloglabels");
    expect(layout.yaxis).toMatchObject({ minorloglabels: "complete" });
    expect(layout.yaxis).not.toHaveProperty("dtick");
    const narrow = buildPlotLayout("t", x, y, "right", null, [5e5, 8e6]);
    expect(narrow.yaxis).toMatchObject({ dtick: "D2" });
  });

  it("places the legend", () => {
    const right = buildPlotLayout("t", x, y, "right", null, null);
    const bottom = buildPlotLayout("t", x, y, "bottom", null, null);
    expect(right.legend).toMatchObject({ orientation: "v" });
    expect(bottom.legend).toMatchObject({ orientation: "h" });
    expect((right.xaxis as { range?: unknown }).range).toBeUndefined();
  });
});
