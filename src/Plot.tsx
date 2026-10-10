import { useEffect, useMemo, useRef, useState } from "react";
import { ImageDown } from "lucide-react";
import { Button } from "./components/Button";
import { fileName } from "./lib/exportFiles";
import type { RefObject } from "react";
import type { DiagramData, DiagramInfo, InputName } from "@luisbedoia/coolprop-rs-wasm";
import "./Plot.css";
import { coolprop } from "./coolprop";
import {
  buildDomeTraces,
  buildIsolineTraces,
  buildPlotLayout,
  buildPointTrace,
  diagramLabel,
  viewRange,
} from "./lib/plotUtils";
import { loadPlotly, type PlotlyLike } from "./lib/plotly";
import { displayUnit, resolveUnitSystem } from "./lib/units";
import type { UnitSystem } from "./lib/units";

export type { PlotPoint } from "./lib/plotUtils";
import type { PlotPoint } from "./lib/plotUtils";

type ThermoPlotProps = {
  fluid: string;
  diagram: DiagramInfo;
  isolineKind: InputName;
  onDiagramChange?: (id: string) => void;
  onIsolineChange?: (kind: InputName) => void;
  onPlotError?: (hasError: boolean) => void;
  points: PlotPoint[];
  isolineCount?: number;
  /** States per isoline. */
  isolinePoints?: number;
  /** States per branch of the saturation dome. */
  domePoints?: number;
  units?: string;
};

const PLOT_FAILED = "The plot could not be generated for the current settings.";

function useLegendPlacement(wrapperRef: RefObject<HTMLDivElement | null>): "bottom" | "right" {
  const [legendPlacement, setLegendPlacement] = useState<"bottom" | "right">(
    () =>
      typeof window !== "undefined" && window.innerWidth >= 768
        ? "right"
        : "bottom",
  );

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;

    const handleResize = () => {
      setLegendPlacement(element.clientWidth < 768 ? "bottom" : "right");
    };

    handleResize();
    const observer = new ResizeObserver(() => {
      handleResize();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
    // wrapperRef is a stable ref object — safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return legendPlacement;
}

export function ThermoPlot({
  fluid,
  diagram,
  isolineKind,
  onDiagramChange,
  onIsolineChange,
  onPlotError,
  points,
  isolineCount = 7,
  // Kept low for low-end devices: computed on the main thread. In desktop
  // Chromium, over every fluid, diagram and family, 120 points per isoline
  // take ~15 ms per diagram (median), ~50 ms at the 95th percentile and
  // ~0.15 s for the slowest fluid; the dome adds ~3 ms.
  isolinePoints = 120,
  domePoints = 120,
  units,
}: ThermoPlotProps) {
  const unitSystem: UnitSystem = resolveUnitSystem(units);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // Of drawing with Plotly; failures known before drawing are setupError.
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  // The Plotly that drew the current chart, to export it.
  const plotlyRef = useRef<PlotlyLike | null>(null);
  const [error, setError] = useState<string | null>(null);
  const legendPlacement = useLegendPlacement(wrapperRef);

  // The diagram itself: dome and isolines. It depends on the fluid, the
  // diagram, the isoline family, the resolution and the units, not on the
  // tracked states, so adding or removing a state does not recompute it.
  const computed = useMemo((): { data: DiagramData } | { error: unknown } | null => {
    if (!fluid) return null;
    try {
      return {
        data: coolprop()
          .fluid(fluid)
          .diagram({
            diagram: diagram.id,
            isolines: [
              {
                kind: isolineKind,
                count: isolineCount,
                unit: displayUnit(isolineKind, unitSystem),
              },
            ],
            points: isolinePoints,
            dome_points: domePoints,
          }),
      };
    } catch (error) {
      return { error };
    }
  }, [fluid, diagram.id, isolineKind, isolineCount, isolinePoints, domePoints, unitSystem]);

  const setupError = !fluid
    ? "Select a fluid in settings to render a chart."
    : !computed || "error" in computed
      ? PLOT_FAILED
      : null;
  const shownStatus = setupError ? "error" : status;
  const shownError = setupError ?? error;

  // Resize with the container, and release Plotly when the chart goes away.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      plotlyRef.current?.Plots?.resize?.(element);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      plotlyRef.current?.purge?.(element);
    };
  }, []);

  // Draw, or update in place: Plotly.react keeps the chart (and the user's
  // zoom, through uirevision) when only the tracked states change.
  useEffect(() => {
    let isMounted = true;

    if (!fluid) return;
    if (!computed || "error" in computed) {
      console.error("Error generating plot", computed && computed.error);
      onPlotError?.(true);
      return;
    }
    // Always mounted (see below), so set once the effect runs.
    const element = containerRef.current;
    if (!element) return;

    const { data } = computed;
    const { x, y } = data;
    const traces = [
      ...buildDomeTraces(data.dome, x.property, y.property, unitSystem),
      ...buildIsolineTraces(data.isolines, x.property, y.property, unitSystem),
    ];
    const pointTrace = buildPointTrace(points, x.property, y.property, unitSystem);
    if (pointTrace) traces.push(pointTrace);

    const { liquid, vapor } = data.dome;
    const layout = {
      ...buildPlotLayout(
        `${coolprop().fluid(fluid).name} - ${diagramLabel(diagram)}`,
        x,
        y,
        legendPlacement,
        viewRange(x, [...liquid.x, ...vapor.x]),
        viewRange(y, [...liquid.y, ...vapor.y]),
        unitSystem,
      ),
      // Zoom and pan survive updates until the axes change meaning.
      uirevision: `${fluid}|${diagram.id}|${unitSystem}`,
    };

    const draw = async () => {
      if (!plotlyRef.current) setStatus("loading");
      try {
        const plotly = await loadPlotly();
        if (!isMounted) return;
        plotlyRef.current = plotly;
        await plotly.react(element, traces, layout, {
          responsive: true,
          displaylogo: false,
          displayModeBar: true,
          modeBarButtonsToRemove: ["lasso2d", "select2d"],
          // Plotly 4 shows it by default: it uploads the chart to Plotly's cloud.
          showSendToCloud: false,
          toImageButtonOptions: {
            format: "png",
            scale: 3,
          },
        });
        if (!isMounted) return;
        setStatus("ready");
        setError(null);
        onPlotError?.(false);
      } catch (err) {
        console.error("Error drawing plot", err);
        if (!isMounted) return;
        setStatus("error");
        setError(PLOT_FAILED);
        onPlotError?.(true);
      }
    };
    void draw();

    return () => {
      isMounted = false;
    };
  }, [computed, fluid, diagram, points, legendPlacement, onPlotError, unitSystem]);

  return (
    <div className="plot-card">
      <div className="plot-controls">
        <div className="control">
          <label htmlFor="plot-type">Chart type</label>
          <select
            id="plot-type"
            name="plot-type"
            value={diagram.id}
            onChange={(event) => onDiagramChange?.(event.target.value)}
          >
            {coolprop()
              .diagrams()
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {diagramLabel(d)}
                </option>
              ))}
          </select>
        </div>
        <div className="control">
          <label htmlFor="isolines">Isolines</label>
          <select
            id="isolines"
            name="isolines"
            value={isolineKind}
            onChange={(event) => onIsolineChange?.(event.target.value as InputName)}
          >
            {coolprop()
              .inputs()
              .filter((input) => diagram.isolines.includes(input.name))
              .map((input) => (
                <option key={input.name} value={input.name}>
                  {`${input.description} (${input.symbol})`}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="plot-actions">
        <Button
          variant="ghost"
          size="sm"
          disabled={shownStatus !== "ready"}
          onClick={() => {
            const element = containerRef.current;
            if (!element) return;
            void plotlyRef.current?.downloadImage?.(element, {
              format: "png",
              filename: fileName(fluid, diagram.id),
              scale: 3,
            });
          }}
        >
          <ImageDown />
          Download PNG
        </Button>
      </div>

      <div
        ref={wrapperRef}
        className={`plot-wrapper${shownStatus === "ready" ? " is-ready" : ""}`}
      >
        {shownStatus === "error" && shownError ? (
          <div className="plot-message error">{shownError}</div>
        ) : null}
        {shownStatus === "loading" && (
          <div className="plot-message">Preparing plot...</div>
        )}
        {/* Always mounted, so a re-render after an error still finds it. */}
        <div
          ref={containerRef}
          className="plot-container"
          aria-live="polite"
          hidden={shownStatus === "error"}
        />
      </div>
    </div>
  );
}
