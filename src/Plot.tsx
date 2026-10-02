import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { DiagramInfo, InputName } from "@luisbedoia/coolprop-rs-wasm";
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
import { propertyLabel, propertyToPlain } from "./lib/unitsFormat";
import { loadPlotly, type PlotlyLike } from "./lib/plotly";
import { resolveUnitSystem } from "./lib/units";
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
  isolinePoints?: number;
  units?: string;
};

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
  isolinePoints = 120,
  units,
}: ThermoPlotProps) {
  const unitSystem: UnitSystem = resolveUnitSystem(units);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const legendPlacement = useLegendPlacement(wrapperRef);

  useEffect(() => {
    let isMounted = true;
    let plotlyInstance: PlotlyLike | null = null;

    if (!fluid) {
      setStatus("error");
      setError("Select a fluid in settings to render a chart.");
      return () => { /* noop */ };
    }

    const targetElement = containerRef.current;
    const wrapperElement = wrapperRef.current;

    if (!targetElement || !wrapperElement) {
      setStatus("error");
      setError("Plot container element was not found.");
      return () => { /* noop */ };
    }

    const renderPlot = async () => {
      setStatus("loading");
      setError(null);

      try {
        const fluidApi = coolprop().fluid(fluid);
        const data = fluidApi.diagram({
          diagram: diagram.id,
          isolines: [{ kind: isolineKind, count: isolineCount }],
          points: isolinePoints,
        });
        const { x, y } = data;

        const traces = [
          ...buildDomeTraces(data.dome, x.property, y.property, unitSystem),
          ...buildIsolineTraces(data.isolines, x.property, y.property, unitSystem),
        ];
        const pointTrace = buildPointTrace(points, x.property, y.property, unitSystem);
        if (pointTrace) traces.push(pointTrace);

        const tc = fluidApi.critical.temperature;
        const layout = buildPlotLayout(
          `${fluidApi.name} - ${diagramLabel(diagram)}`,
          x,
          y,
          legendPlacement,
          viewRange(x, tc),
          viewRange(y, tc),
          unitSystem,
        );

        const plotly = await loadPlotly();

        if (!isMounted) return;

        plotlyInstance = plotly;
        await plotly.newPlot(targetElement, traces, layout, {
          responsive: true,
          displaylogo: false,
          displayModeBar: true,
          modeBarButtonsToRemove: ["lasso2d", "select2d"],
          toImageButtonOptions: {
            format: "png",
            scale: 3,
          },
        });

        const observer = new ResizeObserver(() => {
          if (plotlyInstance?.Plots?.resize) {
            plotlyInstance.Plots.resize(targetElement);
          }
        });
        observer.observe(wrapperElement);
        resizeObserverRef.current = observer;

        requestAnimationFrame(() => {
          if (!isMounted) return;
          if (plotlyInstance?.Plots?.resize) {
            plotlyInstance.Plots.resize(targetElement);
          }
        });

        if (!isMounted) return;
        setStatus("ready");
        setError(null);
        onPlotError?.(false);
      } catch (err) {
        console.error("Error generating plot", err);
        if (!isMounted) return;
        setStatus("error");
        setError("The plot could not be generated for the current settings.");
        onPlotError?.(true);
      }
    };

    void renderPlot();

    return () => {
      isMounted = false;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      if (plotlyInstance && targetElement) {
        plotlyInstance.purge?.(targetElement);
      }
    };
  }, [
    fluid,
    diagram,
    isolineKind,
    isolineCount,
    isolinePoints,
    points,
    legendPlacement,
    onPlotError,
    unitSystem,
  ]);

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
            {diagram.isolines.map((kind) => (
              <option key={kind} value={kind}>
                {`${propertyLabel(kind) ?? kind} (${propertyToPlain(kind)})`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        ref={wrapperRef}
        className={`plot-wrapper${status === "ready" ? " is-ready" : ""}`}
      >
        {status === "error" && error ? (
          <div className="plot-message error">{error}</div>
        ) : null}
        {status === "loading" && (
          <div className="plot-message">Preparing plot...</div>
        )}
        {/* Always mounted, so a re-render after an error still finds it. */}
        <div
          ref={containerRef}
          className="plot-container"
          aria-live="polite"
          hidden={status === "error"}
        />
      </div>
    </div>
  );
}
