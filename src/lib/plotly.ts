/** The slice of Plotly the chart uses. */
export type PlotlyLike = {
  /** Draws the chart, or updates the one already in `element` in place. */
  react: (
    element: HTMLElement,
    data: unknown[],
    layout?: unknown,
    config?: unknown,
  ) => Promise<unknown> | void;
  purge?: (element: HTMLElement) => void;
  /** Changes the layout, e.g. `{ annotations: [...] }`. */
  relayout?: (
    element: HTMLElement,
    update: Record<string, unknown>,
  ) => Promise<unknown> | void;
  /** Changes some traces' attributes, e.g. `{ x: [[...], [...]] }` for two. */
  restyle?: (
    element: HTMLElement,
    update: Record<string, unknown>,
    traces: number[],
  ) => Promise<unknown> | void;
  Plots?: { resize?: (element: HTMLElement) => Promise<unknown> | void };
  downloadImage?: (
    element: HTMLElement,
    options: {
      format: "png";
      filename: string;
      scale?: number;
      width?: number;
      height?: number;
    },
  ) => Promise<unknown>;
};

/** Loads Plotly on demand (it is large and only the chart view needs it). */
export async function loadPlotly(): Promise<PlotlyLike> {
  const plotlyModule =
    (await import("plotly.js-basic-dist-min")) as unknown as PlotlyLike & {
      default?: PlotlyLike;
    };
  return plotlyModule.default ?? plotlyModule;
}
