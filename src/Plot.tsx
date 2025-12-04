import { useEffect, useRef, useState, useMemo } from "react";
import "./Plot.css";
import {
  buildAxisTitle,
  buildIsolineLabel,
  scaleToPlotlyType,
  isSaturationCurve,
  getSaturationLabel,
} from "./lib/plotUtils";

// Importar tipos globales
type FluidPlotCatalogue = {
  fluid: string;
  plots: Array<{
    id: string;
    label: string;
    xAxis: {
      parameter: number;
      scale: 0 | 1;
      range: { min: number; max: number };
    };
    yAxis: {
      parameter: number;
      scale: 0 | 1;
      range: { min: number; max: number };
    };
    isolineOptions: Array<{
      parameter: number;
      range: { min: number; max: number };
    }>;
  }>;
};

type PlotRequest = {
  fluid: string;
  plotId: string;
  isolines: Array<{
    parameter: number;
    values?: number[];
    valueCount?: number;
    points?: number;
    useCustomRange?: boolean;
    customRange?: { min: number; max: number };
  }>;
  includeSaturationCurves?: boolean;
  defaultPointsPerIsoline?: number;
};

export type PlotPoint = {
  id: string;
  label: string;
  x: number;
  y: number;
};

type ThermoPlotProps = {
  fluid: string;
  onPlotChange?: (plotId: string) => void;
  onIsolineParameterChange?: (parameter: number) => void;
  points: PlotPoint[];
  // Configuración de la gráfica
  plotId?: string;
  isolineParameter?: number;
  isolineCount?: number;
  isolinePoints?: number;
  includeSaturation?: boolean;
};

export function ThermoPlot({
  fluid,
  onPlotChange,
  onIsolineParameterChange,
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
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [legendPlacement, setLegendPlacement] = useState<"bottom" | "right">(
    () =>
      typeof window !== "undefined" && window.innerWidth >= 768
        ? "right"
        : "bottom",
  );

  // Estado para el catálogo de gráficas disponibles
  const [catalogue, setCatalogue] = useState<FluidPlotCatalogue | null>(null);

  // Obtener catálogo cuando cambia el fluido
  useEffect(() => {
    if (!fluid || !window.CP?.describeFluidPlots) {
      setCatalogue(null);
      return;
    }

    try {
      const cat = window.CP.describeFluidPlots(fluid);
      setCatalogue(cat);
    } catch (err) {
      console.error("Error obteniendo catálogo de gráficas:", err);
      setCatalogue(null);
    }
  }, [fluid]);

  // Seleccionar automáticamente el primer plot si no hay uno seleccionado
  const currentPlotId = useMemo(() => {
    if (selectedPlotId) return selectedPlotId;
    return catalogue?.plots[0]?.id;
  }, [selectedPlotId, catalogue]);

  // Obtener la definición del plot actual
  const currentPlotDef = useMemo(() => {
    if (!catalogue || !currentPlotId) return null;
    return catalogue.plots.find((p) => p.id === currentPlotId);
  }, [catalogue, currentPlotId]);

  // Seleccionar automáticamente el primer parámetro de isolínea si no hay uno
  const currentIsolineParameter = useMemo(() => {
    if (selectedIsolineParameter !== undefined) return selectedIsolineParameter;
    return currentPlotDef?.isolineOptions[0]?.parameter;
  }, [selectedIsolineParameter, currentPlotDef]);

  // Obtener la opción de isolínea actual
  const currentIsolineOption = useMemo(() => {
    if (!currentPlotDef || currentIsolineParameter === undefined) return null;
    return currentPlotDef.isolineOptions.find(
      (opt) => opt.parameter === currentIsolineParameter,
    );
  }, [currentPlotDef, currentIsolineParameter]);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) {
      return;
    }

    const handleResize = () => {
      const width = element.clientWidth;
      setLegendPlacement(width < 768 ? "bottom" : "right");
    };

    handleResize();

    const observer = new ResizeObserver(() => {
      handleResize();
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Efecto principal para renderizar la gráfica
  useEffect(() => {
    let isMounted = true;
    type PlotlyLike = {
      newPlot: (
        element: HTMLElement,
        data: unknown[],
        layout?: unknown,
        config?: unknown,
      ) => Promise<unknown> | void;
      purge?: (element: HTMLElement) => void;
      Plots?: {
        resize?: (element: HTMLElement) => Promise<unknown> | void;
      };
    };

    let plotlyInstance: PlotlyLike | null = null;
    const targetElement = containerRef.current;
    const wrapperElement = wrapperRef.current;

    if (!targetElement || !wrapperElement) {
      setStatus("error");
      setError("Plot container element was not found.");
      return () => {
        /* noop */
      };
    }

    if (!fluid) {
      setStatus("error");
      setError("Select a fluid in settings to render a chart.");
      return () => {
        /* noop */
      };
    }

    if (!window.CP?.buildPropertyPlot || !window.CP?.describeFluidPlots) {
      setStatus("error");
      setError("CoolProp plot API is not available.");
      return () => {
        /* noop */
      };
    }

    if (
      !currentPlotId ||
      !currentPlotDef ||
      currentIsolineParameter === undefined ||
      !currentIsolineOption
    ) {
      setStatus("loading");
      return () => {
        /* noop */
      };
    }

    const renderPlot = async () => {
      setStatus("loading");
      setError(null);

      try {
        // Construir la solicitud de plot
        const request: PlotRequest = {
          fluid,
          plotId: currentPlotId,
          isolines: [
            {
              parameter: currentIsolineParameter,
              valueCount: isolineCount,
              points: isolinePoints,
              useCustomRange: true,
              customRange: currentIsolineOption.range,
            },
          ],
          includeSaturationCurves: includeSaturation,
          defaultPointsPerIsoline: isolinePoints,
        };

        const plotData = window.CP.buildPropertyPlot(request);

        if (!plotData.isolines || plotData.isolines.length === 0) {
          setStatus("error");
          setError("CoolProp did not return isolines for this chart.");
          return;
        }

        // Paleta de colores
        const palette = [
          "#1d4ed8",
          "#0f766e",
          "#9333ea",
          "#f97316",
          "#0369a1",
          "#b45309",
          "#15803d",
        ];

        // Generar trazas de isolíneas
        const isolineTraces = plotData.isolines.map((isoline, index) => {
          const isSaturation = isSaturationCurve(
            isoline.parameter,
            isoline.value,
          );
          const label = isSaturation
            ? getSaturationLabel(isoline.value)
            : buildIsolineLabel(isoline.parameter, isoline.value);

          return {
            type: "scatter",
            mode: "lines",
            x: isoline.x,
            y: isoline.y,
            name: label,
            line: {
              width: isSaturation ? 2 : 1.5,
              color: isSaturation ? "#dc2626" : palette[index % palette.length],
              dash: isSaturation ? "solid" : "dash",
            },
            showlegend: true,
            hoverlabel: {
              bgcolor: "#0f172a",
              font: { color: "#f8fafc" },
            },
            hovertemplate: [
              `${buildAxisTitle(plotData.xAxis.parameter)}: %{x:.3s}`,
              `${buildAxisTitle(plotData.yAxis.parameter)}: %{y:.3s}`,
              label,
              "<extra></extra>",
            ].join("<br>"),
          };
        });

        // Generar traza de puntos
        const pointTrace =
          points.length > 0
            ? [
                {
                  type: "scatter",
                  mode: "markers",
                  x: points.map((point) => point.x),
                  y: points.map((point) => point.y),
                  name: "Tracked states",
                  text: points.map((point) => point.label),
                  marker: {
                    size: 10,
                    color: "#111827",
                    symbol: "circle",
                    line: {
                      width: 1.5,
                      color: "#ffffff",
                    },
                  },
                  hovertemplate: [
                    "%{text}",
                    `${buildAxisTitle(plotData.xAxis.parameter)}: %{x:.3s}`,
                    `${buildAxisTitle(plotData.yAxis.parameter)}: %{y:.3s}`,
                    "<extra></extra>",
                  ].join("<br>"),
                },
              ]
            : [];

        // Configurar layout
        const layout = {
          title: {
            text: `${plotData.fluid} - ${currentPlotDef.label}`,
            font: { size: 12 },
          },
          paper_bgcolor: "#f8fafc",
          plot_bgcolor: "#ffffff",
          font: {
            family: "Inter, system-ui, sans-serif",
            color: "#1f2937",
          },
          xaxis: {
            title: {
              text: buildAxisTitle(plotData.xAxis.parameter),
              standoff: 10,
            },
            type: scaleToPlotlyType(plotData.xAxis.scale),
            tickformat: ".2s",
            gridcolor: "#e2e8f0",
            zeroline: false,
            automargin: true,
          },
          yaxis: {
            title: {
              text: buildAxisTitle(plotData.yAxis.parameter),
              standoff: 10,
            },
            type: scaleToPlotlyType(plotData.yAxis.scale),
            tickformat: ".2s",
            gridcolor: "#e2e8f0",
            zeroline: false,
            automargin: true,
          },
          hovermode: "closest",
          showlegend: true,
          legend:
            legendPlacement === "right"
              ? {
                  orientation: "v",
                  x: 1.05,
                  xanchor: "left",
                  y: 0.5,
                  yanchor: "middle",
                  bgcolor: "rgba(255,255,255,0.95)",
                  bordercolor: "#dbe4f3",
                  borderwidth: 1,
                  font: { size: 12 },
                }
              : {
                  orientation: "h",
                  x: 0.5,
                  xanchor: "center",
                  y: -0.35,
                  yanchor: "top",
                  bgcolor: "rgba(255,255,255,0.95)",
                  bordercolor: "#dbe4f3",
                  borderwidth: 1,
                  font: { size: 12 },
                },
          margin:
            legendPlacement === "right"
              ? { l: 80, r: 160, t: 70, b: 80 }
              : { l: 5, r: 5, t: 70, b: 100 },
          dragmode: "pan",
        };

        const plotlyModule = (await import(
          "plotly.js-dist-min"
        )) as unknown as PlotlyLike & { default?: PlotlyLike };
        const plotly = plotlyModule.default ?? plotlyModule;

        if (!isMounted) {
          return;
        }

        plotlyInstance = plotly;

        await plotly.newPlot(
          targetElement,
          [...isolineTraces, ...pointTrace],
          layout,
          {
            responsive: true,
            displaylogo: false,
            displayModeBar: true,
            modeBarButtonsToRemove: ["lasso2d", "select2d"],
          },
        );

        const observer = new ResizeObserver(() => {
          if (plotlyInstance?.Plots?.resize) {
            plotlyInstance.Plots.resize(targetElement);
          }
        });
        observer.observe(wrapperElement);
        resizeObserverRef.current = observer;

        requestAnimationFrame(() => {
          if (!isMounted) {
            return;
          }
          if (plotlyInstance?.Plots?.resize) {
            plotlyInstance.Plots.resize(targetElement);
          }
        });

        if (!isMounted) {
          return;
        }

        setStatus("ready");
        setError(null);
      } catch (err) {
        console.error("Error generating plot", err);
        if (!isMounted) {
          return;
        }
        setStatus("error");
        setError("The plot could not be generated for the current settings.");
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
