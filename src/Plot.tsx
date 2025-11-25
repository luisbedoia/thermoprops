import { useEffect, useRef, useState } from "react";

import "./index.css";
import "./Plot.css";

type AxisDefinition = {
	symbol: string;
	units?: string;
	scale?: "linear" | "log";
};

type PropertyPlotResponse = {
	fluid: string;
	chart: string;
	axis: {
		x: AxisDefinition;
		y: AxisDefinition;
	};
	isolines: Array<{
		parameter?: AxisDefinition;
		label?: string;
		lines: Array<{
			value: number;
			x: number[];
			y: number[];
		}>;
	}>;
};

function buildIsolineLabel(
	value: number,
	symbol?: string,
	units?: string
) {
	const formatted = new Intl.NumberFormat(undefined, {
		maximumSignificantDigits: 4,
	}).format(value);

	const parts = [symbol, formatted, units].filter(Boolean);
	return parts.join(" ");
}

function buildAxisTitle(axis?: AxisDefinition) {
	if (!axis) {
		return undefined;
	}

	return axis.units ? `${axis.symbol} (${axis.units})` : axis.symbol;
}

function toLogType(scale?: string) {
	return scale === "log" ? "log" : "linear";
}

export function PlotView() {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const resizeObserverRef = useRef<ResizeObserver | null>(null);
	const plotWrapperRef = useRef<HTMLDivElement | null>(null);
	const [status, setStatus] = useState<"loading" | "ready" | "error">(
		"loading"
	);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	useEffect(() => {
		let isMounted = true;
		type PlotlyLike = {
			newPlot: (
				element: HTMLElement,
				data: unknown[],
				layout?: unknown,
				config?: unknown
			) => Promise<unknown> | void;
			purge?: (element: HTMLElement) => void;
			Plots?: {
				resize?: (element: HTMLElement) => Promise<unknown> | void;
			};
		};
		let plotlyInstance: PlotlyLike | null = null;
		const targetElement = containerRef.current;
		const wrapperElement = plotWrapperRef.current;

		if (!targetElement || !wrapperElement) {
			setErrorMessage("No se encontró el contenedor del gráfico.");
			setStatus("error");
			return () => {
				/* nothing to clean */
			};
		}

		const renderPlot = async () => {
			if (!window.CP) {
				setErrorMessage("CoolProp aún no está disponible.");
				setStatus("error");
				return;
			}

			setStatus("loading");

			try {
				const response = window.CP.compute_property_plot({
					fluid: "Ammonia",
					chart: "p-h",
					tpLimits: "Achp",
					isolines: {
						key: "T",
						num: 7,
						points: 120,
					},
				}) as PropertyPlotResponse;

				const isolineGroup = response.isolines?.[0];

				if (!isolineGroup || isolineGroup.lines.length === 0) {
					setErrorMessage("No se encontraron líneas para graficar.");
					setStatus("error");
					return;
				}

				const isolineSymbol = isolineGroup.label ?? isolineGroup.parameter?.symbol;
				const isolineUnits = isolineGroup.parameter?.units;
				const palette = [
					"#2563eb",
					"#ea580c",
					"#16a34a",
					"#dc2626",
					"#9333ea",
					"#0f766e",
					"#b45309",
				];

				const traces = isolineGroup.lines.map((line, index) => ({
					type: "scatter",
					mode: "lines",
					x: line.x,
					y: line.y,
					name: buildIsolineLabel(line.value, isolineSymbol, isolineUnits),
					line: {
						width: 2.6,
						color: palette[index % palette.length],
					},
					showlegend: true,
					hoverlabel: {
						bgcolor: "#0f172a",
						font: { color: "#f8fafc" },
					},
					hovertemplate: [
						`${response.axis?.x.symbol ?? "x"}: %{x:.3s}`,
						`${response.axis?.y.symbol ?? "y"}: %{y:.3s}`,
						buildIsolineLabel(line.value, isolineSymbol, isolineUnits),
						"<extra></extra>",
					].join("<br>"),
				}));

				const layout = {
					title: {
						text: `${response.fluid} ${response.chart.toUpperCase()} Chart`,
						font: { size: 22 },
					},
					paper_bgcolor: "#f8fafc",
					plot_bgcolor: "#ffffff",
					font: {
						family: "Inter, system-ui, sans-serif",
						color: "#1f2937",
					},
					xaxis: {
						title: {
							text: buildAxisTitle(response.axis?.x),
						},
						type: toLogType(response.axis?.x?.scale),
						tickformat: ".2s",
						gridcolor: "#e2e8f0",
						zeroline: false,
						automargin: true,
					},
					yaxis: {
						title: {
							text: buildAxisTitle(response.axis?.y),
						},
						type: toLogType(response.axis?.y?.scale),
						tickformat: ".2s",
						gridcolor: "#e2e8f0",
						zeroline: false,
						automargin: true,
					},
					hovermode: "closest",
					showlegend: true,
					legend: {
						orientation: "h",
						x: 0.5,
						xanchor: "center",
						y: -0.22,
						bgcolor: "rgba(255,255,255,0.95)",
						bordercolor: "#dbe4f3",
						borderwidth: 1,
						font: { size: 13 },
					},
					margin: { l: 90, r: 60, t: 75, b: 120 },
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

				if (!isMounted) {
					return;
				}

				setStatus("ready");
				setErrorMessage(null);
			} catch (error) {
				console.error("Error al generar el gráfico", error);
				if (!isMounted) {
					return;
				}
				setErrorMessage("No se pudo generar el gráfico.");
				setStatus("error");
			}
		};

		void renderPlot();

		return () => {
			isMounted = false;
			resizeObserverRef.current?.disconnect();
			resizeObserverRef.current = null;
			if (plotlyInstance) {
				plotlyInstance.purge?.(targetElement);
			}
		};
	}, []);

	if (status === "error") {
		return <div className="card">{errorMessage}</div>;
	}

	return (
		<div className="card plot-card">
			{status === "loading" && <div>Generando gráfico...</div>}
			<div ref={plotWrapperRef} className="plot-wrapper">
				<div ref={containerRef} className="plot-container" />
			</div>
		</div>
	);
}

