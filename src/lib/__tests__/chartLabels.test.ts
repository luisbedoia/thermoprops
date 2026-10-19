import { beforeEach, describe, expect, it } from "vitest";
import type { IsolineCurve } from "@luisbedoia/coolprop-rs-wasm";
import { buildChartLabels, isolineText, type LabelInput } from "../chartLabels";
import { setCoolProp } from "../../coolprop";
import { fakeCoolProp } from "../../test-fixtures/fakeCoolProp";

beforeEach(() => {
  setCoolProp(fakeCoolProp().cp);
});

/** A 500×400 plot of s (J/(kg·K)) against T (K), in kelvin. */
function input(over: Partial<LabelInput>): LabelInput {
  return {
    points: [],
    paths: [],
    isolines: [],
    dome: { liquid: { x: [], y: [] }, vapor: { x: [], y: [] } },
    xProperty: "entropy",
    yProperty: "temperature",
    unitSystem: "kelvin",
    scales: { x: "linear", y: "linear" },
    view: { x: [0, 8], y: [250, 900] },
    size: { w: 500, h: 400 },
    colors: { text: "#000", isoline: "#6b6b6b" },
    font: "Inter",
    ...over,
  };
}

const texts = (a: Record<string, unknown>[]) => a.map((x) => x.text);

describe("buildChartLabels", () => {
  // A pump: two states 0.04 K apart, and one far from them.
  const points = [
    { id: "1", label: "1", x: 649, y: 319 },
    { id: "2", label: "2", x: 649, y: 319.04 },
    { id: "3", label: "3", x: 6600, y: 800 },
  ];

  it("gives states that sit together one label", () => {
    expect(texts(buildChartLabels(input({ points })))).toEqual(["1, 2", "3"]);
  });

  it("parts them again when zoomed in", () => {
    const zoomed = buildChartLabels(
      input({ points, view: { x: [0.6, 0.7], y: [318.98, 319.06] } }),
    );
    expect(texts(zoomed)).toEqual(["1", "2"]);
  });

  it("puts a label on the free side of its point", () => {
    // A line running right and up from the point fills its top-right side.
    const [label] = buildChartLabels(
      input({
        points: [{ id: "1", label: "1", x: 4000, y: 575 }],
        paths: [
          {
            label: "1 → 2",
            kind: "process",
            x: [4000, 4400, 4800],
            y: [575, 600, 625],
          },
        ],
      }),
    );
    expect(label.xanchor).toBe("right");
  });

  it("writes an isoline's value on its line, and never upside down", () => {
    const iso = (value: number, y: number[]): IsolineCurve => ({
      kind: "pressure",
      value,
      x: [0, 2000, 4000, 6000, 8000],
      y,
    });
    const a = buildChartLabels(
      input({
        isolines: [
          iso(1e4, [300, 300, 300, 300, 300]),
          // Steep: bottom to top on screen.
          { kind: "pressure", value: 1.2e6, x: [5000, 5000.1], y: [300, 850] },
        ],
      }),
    );
    expect(texts(a)).toEqual(["10 kPa", "1200 kPa"]);
    for (const l of a) {
      expect(l.textangle as number).toBeGreaterThanOrEqual(-91);
      expect(l.textangle as number).toBeLessThanOrEqual(80);
    }
  });

  it("leaves out an isoline's label that has no free place", () => {
    // A plot narrower than the label: no place at all, so no label (rather
    // than one cut off at the edge or laid over something).
    const a = buildChartLabels(
      input({
        size: { w: 30, h: 30 },
        isolines: [
          { kind: "pressure", value: 1e5, x: [0, 8000], y: [300, 300] },
        ],
      }),
    );
    expect(texts(a)).toEqual([]);
  });

  it("labels an isoline that crosses the view between solved points", () => {
    // Zoomed in so far that both of its points lie off the screen.
    const a = buildChartLabels(
      input({
        // Shown values: s in kJ/(kg·K).
        view: { x: [0.64, 0.66], y: [318, 322] },
        isolines: [
          // At s = 0.65 kJ/(kg·K) it runs at 319.3 K: across the view.
          { kind: "pressure", value: 1e4, x: [0, 8000], y: [319, 323] },
        ],
      }),
    );
    expect(texts(a)).toEqual(["10 kPa"]);
  });

  it("puts each label nearer its own point than any other", () => {
    // Two states one above the other, 20px apart on screen.
    const a = buildChartLabels(
      input({
        view: { x: [0.6, 0.7], y: [318, 322] },
        points: [
          { id: "1", label: "1", x: 649, y: 319.8 },
          { id: "2", label: "2", x: 649, y: 320 },
        ],
      }),
    );
    expect(texts(a)).toEqual(["1", "2"]);
    // The lower state's label goes below it, the upper one's above.
    const one = a.find((l) => l.text === "1")!;
    const two = a.find((l) => l.text === "2")!;
    expect(one.yanchor).toBe("top");
    expect(two.yanchor).toBe("bottom");
  });

  it("finds room beside a steep isoline that runs along the cycle", () => {
    // A steep isobar under a process leg, with the dome a few pixels to its
    // side: its upright box would touch both; the rotated text does not.
    const steep = { x: [1000, 3000], y: [300, 800] };
    const a = buildChartLabels(
      input({
        paths: [{ label: "2 → 3", kind: "process", ...steep }],
        dome: {
          liquid: { x: [1100, 3100], y: [300, 800] },
          vapor: { x: [], y: [] },
        },
        isolines: [{ kind: "pressure", value: 1.2e6, ...steep }],
      }),
    );
    expect(texts(a)).toEqual(["1200 kPa"]);
  });

  it("keeps labels off each other", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      label: `State ${i}`,
      x: 1000 + i * 1000,
      y: 400 + (i % 2) * 30,
    }));
    const boxes = buildChartLabels(input({ points: many }));
    expect(boxes).toHaveLength(6);
  });
});

describe("isolineText", () => {
  it("has no thousands separator, and names a quantity without unit", () => {
    expect(isolineText("pressure", 1.5e7, "celsius")).toBe("15000 kPa");
    expect(isolineText("quality", 0.87942, "celsius")).toBe("x = 0.8794");
  });
});
