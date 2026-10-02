/** The slice of Plotly the chart uses. */
export type PlotlyLike = {
  newPlot: (
    element: HTMLElement,
    data: unknown[],
    layout?: unknown,
    config?: unknown,
  ) => Promise<unknown> | void;
  purge?: (element: HTMLElement) => void;
  Plots?: { resize?: (element: HTMLElement) => Promise<unknown> | void };
};

/** Loads Plotly on demand (it is large and only the chart view needs it). */
export async function loadPlotly(): Promise<PlotlyLike> {
  const plotlyModule =
    (await import("plotly.js-dist-min")) as unknown as PlotlyLike & {
      default?: PlotlyLike;
    };
  return plotlyModule.default ?? plotlyModule;
}
