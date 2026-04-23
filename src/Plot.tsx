import { useEffect, useRef, useState, useMemo } from "react";
import type { RefObject } from "react";
import "./Plot.css";
import {
  getParameterInfo,
  computeSaturationDomeRange,
  computeTemperatureViewMax,
  buildIsolineLabel,
  buildIsolineTraces,
  buildPointTrace,
  buildPlotLayout,
} from "./lib/plotUtils";

export type { PlotPoint } from "./lib/plotUtils";
import type { PlotPoint } from "./lib/plotUtils";

type PlotlyLike = {
  newPlot: (
    element: HTMLElement,
    data: unknown[],
    layout?: unknown,
    config?: unknown,
  ) => Promise<unknown> | void;
  purge?: (element: HTMLElement) => void;
  Plots?: { resize?: (element: HTMLElement) => Promise<unknown> | void };
};

type ThermoPlotProps = {
  fluid: string;
  onPlotChange?: (plotId: string) => void;
  onIsolineParameterChange?: (parameter: number) => void;
  onPlotError?: (hasError: boolean) => void;
  points: PlotPoint[];
  plotId?: string;
  isolineParameter?: number;
  isolineCount?: number;
  isolinePoints?: number;
  includeSaturation?: boolean;
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
  onPlotChange,
  onIsolineParameterChange,
  onPlotError,
  points,
  plotId: selectedPlotId,
  isolineParameter: selectedIsolineParameter,
  isolineCount = 7,
  isolinePoints = 200,
  includeSaturation = true,
}: ThermoPlotProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const legendPlacement = useLegendPlacement(wrapperRef);

  const [catalogue, setCatalogue] = useState<FluidPlotCatalogue | null>(null);

  useEffect(() => {
    if (!fluid || !window.CP?.describeFluidPlots) {
      setCatalogue(null);
      return;
    }
    setCatalogue(window.CP.describeFluidPlots(fluid));
  }, [fluid]);

  const currentPlotId = useMemo(() => {
    if (!catalogue || catalogue.plots.length === 0) return selectedPlotId;
    if (selectedPlotId && catalogue.plots.some((p) => p.id === selectedPlotId)) {
      return selectedPlotId;
    }
    return catalogue.plots[0]?.id;
  }, [selectedPlotId, catalogue]);

  useEffect(() => {
    if (currentPlotId && currentPlotId !== selectedPlotId) {
      onPlotChange?.(currentPlotId);
    }
  }, [currentPlotId, selectedPlotId, onPlotChange]);

  const currentPlotDef = useMemo(() => {
    if (!catalogue || !currentPlotId) return null;
    return catalogue.plots.find((p) => p.id === currentPlotId) ?? null;
  }, [catalogue, currentPlotId]);

  const currentIsolineParameter = useMemo(() => {
    if (!currentPlotDef) return selectedIsolineParameter;
    if (
      selectedIsolineParameter !== undefined &&
      currentPlotDef.isolineOptions.some((opt) => opt.parameter === selectedIsolineParameter)
    ) {
      return selectedIsolineParameter;
    }
    return currentPlotDef.isolineOptions[0]?.parameter;
  }, [selectedIsolineParameter, currentPlotDef]);

  useEffect(() => {
    if (currentIsolineParameter !== undefined && currentIsolineParameter !== selectedIsolineParameter) {
      onIsolineParameterChange?.(currentIsolineParameter);
    }
  }, [currentIsolineParameter, selectedIsolineParameter, onIsolineParameterChange]);

  const currentIsolineOption = useMemo(() => {
    if (!currentPlotDef || currentIsolineParameter === undefined) return null;
    return (
      currentPlotDef.isolineOptions.find(
        (opt) => opt.parameter === currentIsolineParameter,
      ) ?? null
    );
  }, [currentPlotDef, currentIsolineParameter]);

  useEffect(() => {
    let isMounted = true;
    let plotlyInstance: PlotlyLike | null = null;

    if (!fluid) {
      setStatus("error");
      setError("Select a fluid in settings to render a chart.");
      return () => { /* noop */ };
    }

    if (!window.CP?.buildPropertyPlot || !window.CP?.describeFluidPlots) {
      setStatus("error");
      setError("CoolProp plot API is not available.");
      return () => { /* noop */ };
    }

    const targetElement = containerRef.current;
    const wrapperElement = wrapperRef.current;

    if (!targetElement || !wrapperElement) {
      setStatus("error");
      setError("Plot container element was not found.");
      return () => { /* noop */ };
    }

    if (
      !currentPlotId ||
      !currentPlotDef ||
      currentIsolineParameter === undefined ||
      !currentIsolineOption
    ) {
      setStatus("loading");
      return () => { /* noop */ };
    }

    const renderPlot = async () => {
      setStatus("loading");
      setError(null);

      try {
        let isolineRange = currentIsolineOption.range;
        const parameterShort = getParameterInfo(currentIsolineParameter, "short");
        const domeRange = computeSaturationDomeRange(parameterShort, fluid);
        if (domeRange) {
          isolineRange = {
            min: Math.max(isolineRange.min, domeRange.min),
            max: Math.min(isolineRange.max, domeRange.max),
          };
        }

        const plotData = window.CP.buildPropertyPlot({
          fluid,
          plotId: currentPlotId,
          isolines: [
            {
              parameter: currentIsolineParameter,
              valueCount: isolineCount,
              points: isolinePoints,
              useCustomRange: true,
              customRange: isolineRange,
            },
          ],
          includeSaturationCurves: includeSaturation,
          defaultPointsPerIsoline: isolinePoints,
        });

        if (!plotData.isolines || plotData.isolines.length === 0) {
          setStatus("error");
          setError("CoolProp did not return isolines for this chart.");
          return;
        }

        const isolineTraces = buildIsolineTraces(
          plotData.isolines,
          plotData.xAxis.parameter,
          plotData.yAxis.parameter,
        );
        const pointTrace = buildPointTrace(
          points,
          plotData.xAxis.parameter,
          plotData.yAxis.parameter,
        );
        const traces = pointTrace
          ? [...isolineTraces, pointTrace]
          : isolineTraces;

        const xAxisShort = getParameterInfo(plotData.xAxis.parameter, "short");
        const yAxisShort = getParameterInfo(plotData.yAxis.parameter, "short");
        const xAxisRange = xAxisShort === "T"
          ? { min: plotData.xAxis.range.min, max: computeTemperatureViewMax(fluid, plotData.xAxis.range.max) }
          : undefined;
        const yAxisRange = yAxisShort === "T"
          ? { min: plotData.yAxis.range.min, max: computeTemperatureViewMax(fluid, plotData.yAxis.range.max) }
          : undefined;

        const layout = buildPlotLayout(
          plotData.fluid,
          currentPlotDef.label,
          plotData.xAxis.parameter,
          plotData.yAxis.parameter,
          plotData.xAxis.scale,
          plotData.yAxis.scale,
          legendPlacement,
          xAxisRange,
          yAxisRange,
        );

        const plotlyModule = (await import(
          "plotly.js-dist-min"
        )) as unknown as PlotlyLike & { default?: PlotlyLike };
        const plotly = plotlyModule.default ?? plotlyModule;

        if (!isMounted) return;

        plotlyInstance = plotly;
        await plotly.newPlot(targetElement, traces, layout, {
          responsive: true,
          displaylogo: false,
          displayModeBar: true,
          modeBarButtonsToRemove: ["lasso2d", "select2d"],
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
    currentPlotId,
    currentPlotDef,
    currentIsolineParameter,
    currentIsolineOption,
    isolineCount,
    isolinePoints,
    includeSaturation,
    points,
    legendPlacement,
    onPlotError,
  ]);

  return (
    <div className="plot-card">
      <div className="plot-controls">
        <div className="control">
          <label htmlFor="plot-type">Chart type</label>
          <select
            id="plot-type"
            name="plot-type"
            value={currentPlotId || ""}
            onChange={(event) => onPlotChange?.(event.target.value)}
            disabled={!catalogue || catalogue.plots.length === 0}
          >
            {catalogue?.plots.map((plot) => (
              <option key={plot.id} value={plot.id}>
                {plot.label}
              </option>
            ))}
          </select>
        </div>
        <div className="control">
          <label htmlFor="isolines">Isoline parameter</label>
          <select
            id="isolines"
            name="isolines"
            value={currentIsolineParameter ?? ""}
            onChange={(event) =>
              onIsolineParameterChange?.(Number(event.target.value))
            }
            disabled={
              !currentPlotDef || currentPlotDef.isolineOptions.length === 0
            }
          >
            {currentPlotDef?.isolineOptions.map((option) => (
              <option key={option.parameter} value={option.parameter}>
                {buildIsolineLabel(option.parameter, option.range.min)}
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
        ) : (
          <>
            {status === "loading" && (
              <div className="plot-message">Preparing plot...</div>
            )}
            <div
              ref={containerRef}
              className="plot-container"
              aria-live="polite"
            />
          </>
        )}
      </div>
    </div>
  );
}
