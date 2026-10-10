// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import type { DiagramInfo } from "@luisbedoia/coolprop-rs-wasm";
import { ThermoPlot, type PlotPoint } from "../Plot";
import { setCoolProp } from "../coolprop";
import { fakeCoolProp } from "../test-fixtures/fakeCoolProp";

// vi.hoisted runs before imports, required so vi.mock factory can reference these
const plotlyMocks = vi.hoisted(() => ({
  react: vi.fn().mockResolvedValue(undefined),
  purge: vi.fn(),
  resize: vi.fn(),
  downloadImage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/plotly", () => ({
  loadPlotly: async () => ({
    react: plotlyMocks.react,
    purge: plotlyMocks.purge,
    Plots: { resize: plotlyMocks.resize },
    downloadImage: plotlyMocks.downloadImage,
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

let fake: ReturnType<typeof fakeCoolProp>;

function diagram(id: string): DiagramInfo {
  return fake.cp.diagrams().find((d) => d.id === id)!;
}

function renderPlot(props: Partial<Parameters<typeof ThermoPlot>[0]> = {}) {
  return render(
    <ThermoPlot
      fluid="Water"
      diagram={diagram("pressure_enthalpy")}
      isolineKind="temperature"
      points={[]}
      {...props}
    />,
  );
}

// Wait until the plot renders successfully (onPlotError(false) is the signal)
async function waitForSuccess(onPlotError: ReturnType<typeof vi.fn>) {
  await waitFor(() => expect(onPlotError).toHaveBeenCalledWith(false));
}

function lastTraces(): Record<string, unknown>[] {
  const calls = plotlyMocks.react.mock.calls;
  return calls[calls.length - 1][1] as Record<string, unknown>[];
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe("ThermoPlot", () => {
  beforeEach(() => {
    fake = fakeCoolProp();
    setCoolProp(fake.cp);

    vi.stubGlobal(
      "ResizeObserver",
      vi.fn(function ResizeObserverMock(this: object) {
        Object.assign(this, {
          observe: vi.fn(),
          disconnect: vi.fn(),
          unobserve: vi.fn(),
        });
      }),
    );

    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe("controls", () => {
    it("offers every diagram of the catalog", () => {
      renderPlot();
      const options = screen
        .getByLabelText("Chart type")
        .querySelectorAll("option");
      expect(options).toHaveLength(6);
      expect(screen.getByLabelText("Chart type")).toHaveValue(
        "pressure_enthalpy",
      );
    });

    it("offers the isoline families of the current diagram", () => {
      renderPlot({
        diagram: diagram("temperature_entropy"),
        isolineKind: "pressure",
      });
      const kinds = [
        ...screen.getByLabelText("Isolines").querySelectorAll("option"),
      ].map((o) => o.getAttribute("value"));
      expect(kinds).toEqual(diagram("temperature_entropy").isolines);
      expect(kinds).not.toContain("temperature");
    });

    it("reports diagram and isoline changes", () => {
      const onDiagramChange = vi.fn();
      const onIsolineChange = vi.fn();
      renderPlot({ onDiagramChange, onIsolineChange });
      fireEvent.change(screen.getByLabelText("Chart type"), {
        target: { value: "temperature_entropy" },
      });
      fireEvent.change(screen.getByLabelText("Isolines"), {
        target: { value: "quality" },
      });
      expect(onDiagramChange).toHaveBeenCalledWith("temperature_entropy");
      expect(onIsolineChange).toHaveBeenCalledWith("quality");
    });
  });

  describe("rendering", () => {
    it("requests the diagram with the selected isoline family", async () => {
      const onPlotError = vi.fn();
      renderPlot({
        onPlotError,
        isolineCount: 4,
        isolinePoints: 80,
        domePoints: 90,
      });
      await waitForSuccess(onPlotError);
      expect(fake.cp.fluid("Water").diagram).toHaveBeenCalledWith({
        diagram: "pressure_enthalpy",
        isolines: [
          {
            kind: "temperature",
            count: 4,
            unit: { scale: 1, offset: -273.15 },
          },
        ],
        points: 80,
        dome_points: 90,
      });
      expect(plotlyMocks.react).toHaveBeenCalledTimes(1);
    });

    it("downloads the chart as a PNG once it is drawn", async () => {
      const onPlotError = vi.fn();
      renderPlot({ onPlotError });
      const button = screen.getByRole("button", { name: /download png/i });
      await waitForSuccess(onPlotError);
      await waitFor(() => expect(button).toBeEnabled());
      fireEvent.click(button);
      expect(plotlyMocks.downloadImage).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        {
          format: "png",
          filename: "thermoprops-water-pressure-enthalpy",
          scale: 3,
        },
      );
    });

    it("draws the dome, then the isolines", async () => {
      const onPlotError = vi.fn();
      renderPlot({ onPlotError });
      await waitForSuccess(onPlotError);
      const names = lastTraces().map((t) => t.name);
      expect(names.slice(0, 2)).toEqual([
        "Saturated liquid",
        "Saturated vapor",
      ]);
      expect(names).toHaveLength(3);
    });

    it("adds tracked states as markers", async () => {
      const onPlotError = vi.fn();
      const points: PlotPoint[] = [
        { id: "a", label: "State 1", x: 1e5, y: 1e5 },
      ];
      renderPlot({ onPlotError, points });
      await waitForSuccess(onPlotError);
      const traces = lastTraces();
      expect(traces[traces.length - 1]).toMatchObject({
        mode: "markers",
        text: ["State 1"],
      });
    });

    it("updates the chart in place when states change, without recomputing the diagram", async () => {
      const onPlotError = vi.fn();
      const { rerender } = renderPlot({ onPlotError });
      await waitForSuccess(onPlotError);
      const diagramCalls = vi.mocked(fake.cp.fluid("Water").diagram).mock.calls
        .length;

      const points: PlotPoint[] = [
        { id: "a", label: "State 1", x: 1e5, y: 1e5 },
      ];
      rerender(
        <ThermoPlot
          fluid="Water"
          diagram={diagram("pressure_enthalpy")}
          isolineKind="temperature"
          points={points}
          onPlotError={onPlotError}
        />,
      );
      await waitFor(() => expect(plotlyMocks.react).toHaveBeenCalledTimes(2));
      expect(fake.cp.fluid("Water").diagram).toHaveBeenCalledTimes(
        diagramCalls,
      );
      expect(lastTraces()[lastTraces().length - 1]).toMatchObject({
        mode: "markers",
      });
      // Same uirevision: Plotly keeps the user's zoom.
      const revision = (call: number) =>
        (plotlyMocks.react.mock.calls[call][2] as { uirevision: string })
          .uirevision;
      expect(revision(1)).toBe(revision(0));
      expect(plotlyMocks.purge).not.toHaveBeenCalled();
    });

    it("recomputes, and resets the view, when the diagram changes", async () => {
      const onPlotError = vi.fn();
      const { rerender } = renderPlot({ onPlotError });
      await waitForSuccess(onPlotError);
      const diagramCalls = vi.mocked(fake.cp.fluid("Water").diagram).mock.calls
        .length;
      rerender(
        <ThermoPlot
          fluid="Water"
          diagram={diagram("temperature_entropy")}
          isolineKind="pressure"
          points={[]}
          onPlotError={onPlotError}
        />,
      );
      await waitFor(() => expect(plotlyMocks.react).toHaveBeenCalledTimes(2));
      expect(fake.cp.fluid("Water").diagram).toHaveBeenCalledTimes(
        diagramCalls + 1,
      );
      const revision = (call: number) =>
        (plotlyMocks.react.mock.calls[call][2] as { uirevision: string })
          .uirevision;
      expect(revision(1)).not.toBe(revision(0));
    });

    it("uses the diagram's axis scales", async () => {
      const onPlotError = vi.fn();
      renderPlot({ onPlotError });
      await waitForSuccess(onPlotError);
      const layout = plotlyMocks.react.mock.calls[0][2] as Record<
        string,
        { type: string }
      >;
      expect(layout.yaxis.type).toBe("log");
      expect(layout.xaxis.type).toBe("linear");
    });
  });

  describe("errors", () => {
    it("asks for a fluid when none is selected", () => {
      renderPlot({ fluid: "" });
      expect(screen.getByText(/Select a fluid/)).toBeInTheDocument();
    });

    it("reports a diagram CoolProp cannot build", async () => {
      const onPlotError = vi.fn();
      vi.mocked(fake.cp.fluid("Water").diagram).mockImplementation(() => {
        throw new Error("boom");
      });
      renderPlot({ onPlotError });
      await waitFor(() => expect(onPlotError).toHaveBeenCalledWith(true));
      expect(
        await screen.findByText(/could not be generated/),
      ).toBeInTheDocument();
    });

    it("reports a Plotly failure", async () => {
      const onPlotError = vi.fn();
      plotlyMocks.react.mockRejectedValueOnce(new Error("plotly"));
      renderPlot({ onPlotError });
      await waitFor(() => expect(onPlotError).toHaveBeenCalledWith(true));
    });
  });
});
