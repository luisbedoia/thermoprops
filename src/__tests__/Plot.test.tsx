// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ThermoPlot, type PlotPoint } from "../Plot";

// vi.hoisted runs before imports, required so vi.mock factory can reference these
const plotlyMocks = vi.hoisted(() => ({
  newPlot: vi.fn().mockResolvedValue(undefined),
  purge: vi.fn(),
  resize: vi.fn(),
}));

vi.mock("plotly.js-dist-min", () => ({
  default: {
    newPlot: plotlyMocks.newPlot,
    purge: plotlyMocks.purge,
    Plots: { resize: plotlyMocks.resize },
  },
}));

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_CATALOGUE = {
  fluid: "Water",
  plots: [
    {
      id: "ph",
      label: "Pressure-Enthalpy",
      xAxis: { parameter: 5, scale: 0 as const, range: { min: 0, max: 3e6 } },
      yAxis: { parameter: 2, scale: 1 as const, range: { min: 1e4, max: 1e8 } },
      isolineOptions: [
        { parameter: 19, range: { min: 273, max: 647 } },
        { parameter: 8, range: { min: 0, max: 5e6 } },
      ],
    },
    {
      id: "ts",
      label: "Temperature-Entropy",
      xAxis: { parameter: 8, scale: 0 as const, range: { min: 0, max: 5000 } },
      yAxis: {
        parameter: 19,
        scale: 0 as const,
        range: { min: 273, max: 700 },
      },
      isolineOptions: [{ parameter: 2, range: { min: 1e4, max: 1e8 } }],
    },
  ],
};

const MOCK_PLOT_DATA = {
  fluid: "Water",
  plotId: "ph",
  xAxis: { parameter: 5, scale: 0 as const, range: { min: 0, max: 3e6 } },
  yAxis: { parameter: 2, scale: 1 as const, range: { min: 1e4, max: 1e8 } },
  isolines: [
    { parameter: 19, value: 300, x: [100, 200], y: [50000, 60000] },
    { parameter: 21, value: 0, x: [50, 150], y: [40000, 45000] },
  ],
  availableIsolines: [],
  generatedIsolines: [],
};

const DEFAULT_PROPS = {
  fluid: "Water",
  points: [] as PlotPoint[],
  plotId: "ph",
  isolineParameter: 19,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCPMock(overrides: Partial<typeof window.CP> = {}) {
  return {
    describeFluidPlots: vi.fn().mockReturnValue(MOCK_CATALOGUE),
    buildPropertyPlot: vi.fn().mockReturnValue(MOCK_PLOT_DATA),
    // propsSI returning NaN short-circuits computeSaturationDomeRange → null
    propsSI: vi.fn().mockReturnValue(NaN),
    getParameterInformation: vi.fn().mockReturnValue(""),
    ...overrides,
  } as unknown as typeof window.CP;
}

// Wait until the plot renders successfully (onPlotError(false) is the signal)
async function waitForSuccess(onPlotError: ReturnType<typeof vi.fn>) {
  await waitFor(() => expect(onPlotError).toHaveBeenCalledWith(false));
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe("ThermoPlot", () => {
  beforeEach(() => {
    window.CP = makeCPMock();

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

  // ── Catalogue ──────────────────────────────────────────────────────────────

  describe("catalogue", () => {
    it("fetches catalogue from window.CP.describeFluidPlots on mount", async () => {
      render(<ThermoPlot {...DEFAULT_PROPS} />);
      await waitFor(() => {
        expect(window.CP.describeFluidPlots).toHaveBeenCalledWith("Water");
      });
    });

    it("refetches catalogue when fluid prop changes", async () => {
      const { rerender } = render(<ThermoPlot {...DEFAULT_PROPS} />);
      await waitFor(() =>
        expect(window.CP.describeFluidPlots).toHaveBeenCalledWith("Water"),
      );

      rerender(<ThermoPlot {...DEFAULT_PROPS} fluid="Ammonia" />);
      await waitFor(() =>
        expect(window.CP.describeFluidPlots).toHaveBeenCalledWith("Ammonia"),
      );
    });

    it("renders chart type options from catalogue", async () => {
      render(<ThermoPlot {...DEFAULT_PROPS} />);
      await waitFor(() => {
        expect(screen.getByRole("option", { name: "Pressure-Enthalpy" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Temperature-Entropy" })).toBeInTheDocument();
      });
    });

    it("sets catalogue to null and shows no options when window.CP is missing", async () => {
      (window as unknown as Record<string, unknown>).CP = undefined;
      render(<ThermoPlot {...DEFAULT_PROPS} />);
      await waitFor(() => {
        expect(screen.getByText("CoolProp plot API is not available.")).toBeInTheDocument();
      });
    });
  });

  // ── Controls ───────────────────────────────────────────────────────────────

  describe("controls", () => {
    it("calls onPlotChange when chart type select changes", async () => {
      const onPlotChange = vi.fn();
      render(<ThermoPlot {...DEFAULT_PROPS} onPlotChange={onPlotChange} />);
      await waitFor(() =>
        expect(screen.getByLabelText("Chart type")).toBeInTheDocument(),
      );

      fireEvent.change(screen.getByLabelText("Chart type"), {
        target: { value: "ts" },
      });

      expect(onPlotChange).toHaveBeenCalledWith("ts");
    });

    it("calls onIsolineParameterChange when isoline select changes", async () => {
      const onIsolineParameterChange = vi.fn();
      render(
        <ThermoPlot
          {...DEFAULT_PROPS}
          onIsolineParameterChange={onIsolineParameterChange}
        />,
      );
      await waitFor(() =>
        expect(screen.getByLabelText("Isoline parameter")).toBeInTheDocument(),
      );

      fireEvent.change(screen.getByLabelText("Isoline parameter"), {
        target: { value: "8" },
      });

      expect(onIsolineParameterChange).toHaveBeenCalledWith(8);
    });
  });

  // ── Render success ─────────────────────────────────────────────────────────

  describe("successful render", () => {
    it("calls window.CP.buildPropertyPlot with fluid and plotId", async () => {
      const onPlotError = vi.fn();
      render(<ThermoPlot {...DEFAULT_PROPS} onPlotError={onPlotError} />);
      await waitForSuccess(onPlotError);

      expect(window.CP.buildPropertyPlot).toHaveBeenCalledWith(
        expect.objectContaining({
          fluid: "Water",
          plotId: "ph",
          isolines: expect.arrayContaining([
            expect.objectContaining({ parameter: 19 }),
          ]),
        }),
      );
    });

    it("calls onPlotError(false) after successful render", async () => {
      const onPlotError = vi.fn();
      render(<ThermoPlot {...DEFAULT_PROPS} onPlotError={onPlotError} />);
      await waitForSuccess(onPlotError);
      expect(onPlotError).toHaveBeenCalledWith(false);
    });

    it("calls Plotly.newPlot once per render", async () => {
      const onPlotError = vi.fn();
      render(<ThermoPlot {...DEFAULT_PROPS} onPlotError={onPlotError} />);
      await waitForSuccess(onPlotError);
      expect(plotlyMocks.newPlot).toHaveBeenCalledTimes(1);
    });

    it("passes isoline traces to Plotly", async () => {
      const onPlotError = vi.fn();
      render(<ThermoPlot {...DEFAULT_PROPS} onPlotError={onPlotError} />);
      await waitForSuccess(onPlotError);

      const [, traces] = plotlyMocks.newPlot.mock.calls[0] as [
        unknown,
        Array<{ mode: string }>,
      ];
      const isolineTraces = traces.filter((t) => t.mode === "lines");
      expect(isolineTraces.length).toBe(MOCK_PLOT_DATA.isolines.length);
    });
  });

  // ── Point traces ───────────────────────────────────────────────────────────

  describe("point traces", () => {
    it("includes a marker trace when points are provided", async () => {
      const onPlotError = vi.fn();
      const points: PlotPoint[] = [
        { id: "s1", label: "State 1", x: 250000, y: 500000 },
        { id: "s2", label: "State 2", x: 300000, y: 800000 },
      ];
      render(
        <ThermoPlot {...DEFAULT_PROPS} points={points} onPlotError={onPlotError} />,
      );
      await waitForSuccess(onPlotError);

      const [, traces] = plotlyMocks.newPlot.mock.calls[0] as [
        unknown,
        Array<{ mode: string; x: number[]; y: number[]; text: string[] }>,
      ];
      const pointTrace = traces.find((t) => t.mode === "markers");

      expect(pointTrace).toBeDefined();
      expect(pointTrace?.x).toEqual([250000, 300000]);
      expect(pointTrace?.y).toEqual([500000, 800000]);
      expect(pointTrace?.text).toEqual(["State 1", "State 2"]);
    });

    it("does not include a marker trace when points array is empty", async () => {
      const onPlotError = vi.fn();
      render(
        <ThermoPlot {...DEFAULT_PROPS} points={[]} onPlotError={onPlotError} />,
      );
      await waitForSuccess(onPlotError);

      const [, traces] = plotlyMocks.newPlot.mock.calls[0] as [
        unknown,
        Array<{ mode: string }>,
      ];
      expect(traces.find((t) => t.mode === "markers")).toBeUndefined();
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  describe("error handling", () => {
    it("shows error message when fluid is empty", async () => {
      render(<ThermoPlot {...DEFAULT_PROPS} fluid="" />);
      await waitFor(() => {
        expect(
          screen.getByText("Select a fluid in settings to render a chart."),
        ).toBeInTheDocument();
      });
    });

    it("calls onPlotError(true) when buildPropertyPlot throws", async () => {
      window.CP.buildPropertyPlot = vi
        .fn()
        .mockImplementation(() => {
          throw new Error("CoolProp failure");
        });

      const onPlotError = vi.fn();
      render(<ThermoPlot {...DEFAULT_PROPS} onPlotError={onPlotError} />);
      await waitFor(() => expect(onPlotError).toHaveBeenCalledWith(true));
    });

    it("calls onPlotError(true) when Plotly.newPlot rejects", async () => {
      plotlyMocks.newPlot.mockRejectedValueOnce(new Error("Plotly failure"));

      const onPlotError = vi.fn();
      render(<ThermoPlot {...DEFAULT_PROPS} onPlotError={onPlotError} />);
      await waitFor(() => expect(onPlotError).toHaveBeenCalledWith(true));
    });

    it("shows error message when buildPropertyPlot returns empty isolines", async () => {
      window.CP.buildPropertyPlot = vi.fn().mockReturnValue({
        ...MOCK_PLOT_DATA,
        isolines: [],
      });

      render(<ThermoPlot {...DEFAULT_PROPS} />);
      await waitFor(() => {
        expect(
          screen.getByText(
            "CoolProp did not return isolines for this chart.",
          ),
        ).toBeInTheDocument();
      });
    });
  });
});
