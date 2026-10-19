import type {
  AxisData,
  Curve,
  DiagramInfo,
  IsolineCurve,
  PlotProperty,
} from "@luisbedoia/coolprop-rs-wasm";
import { DEFAULT_UNIT_SYSTEM, fromSI, getDisplayUnit } from "./units";
import type { UnitSystem } from "./units";
import { quantityInfo } from "./quantities";
import type { Quantity } from "./quantities";
import { unitToPlain } from "./unitsFormat";

export type PlotPoint = {
  id: string;
  label: string;
  /** SI, on the diagram's x axis. */
  x: number;
  /** SI, on the diagram's y axis. */
  y: number;
};

/** Converts SI values for display; `null` (a break in the curve) is kept. */
function convertArray(
  values: (number | null)[],
  name: string,
  units: UnitSystem,
): (number | null)[] {
  return values.map((v) => (v === null ? null : fromSI(name, v, units)));
}

/** "T (°C)", or just the symbol for dimensionless quantities. */
export function buildAxisTitle(
  property: Quantity,
  unitSystem: UnitSystem = DEFAULT_UNIT_SYSTEM,
): string {
  const { symbol } = quantityInfo(property);
  const unit = unitToPlain(getDisplayUnit(property, unitSystem));
  return unit ? `${symbol} (${unit})` : symbol;
}

/** "T 100 °C": the symbol, the value in display units and the unit. */
export function buildIsolineLabel(
  kind: Quantity,
  value: number,
  unitSystem: UnitSystem = DEFAULT_UNIT_SYSTEM,
): string {
  const formatted = new Intl.NumberFormat(undefined, {
    maximumSignificantDigits: 4,
  }).format(fromSI(kind, value, unitSystem));
  const unit = unitToPlain(getDisplayUnit(kind, unitSystem));
  return [quantityInfo(kind).symbol, formatted, unit].filter(Boolean).join(" ");
}

/** "Pressure – Specific enthalpy (p–h)". */
export function diagramLabel(diagram: DiagramInfo): string {
  const y = quantityInfo(diagram.y.property);
  const x = quantityInfo(diagram.x.property);
  return `${y.description} – ${x.description} (${y.symbol}–${x.symbol})`;
}

/**
 * The diagram as a select option, symbols first like the property selects
 * ("p · kPa — Pressure"), so a narrow select cuts the description, not them.
 */
/** The diagram by its axes' symbols: "p–h". */
export function diagramSymbols(diagram: DiagramInfo): string {
  return `${quantityInfo(diagram.y.property).symbol}–${quantityInfo(diagram.x.property).symbol}`;
}

export function diagramOptionLabel(diagram: DiagramInfo): string {
  const y = quantityInfo(diagram.y.property);
  const x = quantityInfo(diagram.x.property);
  return `${y.symbol}–${x.symbol} · ${y.description} – ${x.description}`;
}

const ISOLINE_PALETTE = [
  "#1d4ed8",
  "#0f766e",
  "#9333ea",
  "#f97316",
  "#0369a1",
  "#b45309",
  "#15803d",
];

const DOME_COLOR = "#dc2626";

/**
 * How a chart is drawn. The app's look colours each isoline and draws the
 * dome red; the Script screen's (PlayStation's system) keeps every
 * reference line neutral and puts its one hue, PlayStation Blue, on the
 * data: the cycle's paths and states, which are labelled by name.
 */
export type ChartLook = {
  dome: string;
  isoline: (index: number) => string;
  path: string;
  point: string;
  /** Write each state's name beside its point. */
  pointLabels: boolean;
  /**
   * Label states and isolines on the chart itself, placed for each view
   * (see chartLabels.ts), instead of naming isolines in the legend.
   */
  inlineLabels: boolean;
  grid: string;
  paper: string;
  text: string;
  font: string;
  /** The legend's box edge; none for a flat legend. */
  legendBorder: string | null;
  /** The legend in the chart's header, above the plot, at every width. */
  legendOnTop: boolean;
  /** A title of the fluid and the axes' symbols ("R134a · p–h"), for a
   *  screen whose controls already name the chart in full. */
  shortTitle: boolean;
};

const FONT = '"Inter Variable", Inter, system-ui, sans-serif';

export const APP_LOOK: ChartLook = {
  dome: DOME_COLOR,
  isoline: (i) => ISOLINE_PALETTE[i % ISOLINE_PALETTE.length],
  path: "#111827",
  point: "#111827",
  pointLabels: false,
  inlineLabels: false,
  grid: "#e2e8f0",
  paper: "#f8fafc",
  text: "#1f2937",
  font: FONT,
  legendBorder: "#dbe4f3",
  legendOnTop: false,
  shortTitle: false,
};

export const SCRIPT_LOOK: ChartLook = {
  dome: "#3d3d3d",
  isoline: () => "#a8a8a8",
  path: "#0070d1",
  point: "#0070d1",
  pointLabels: true,
  inlineLabels: true,
  grid: "#ececec",
  paper: "#ffffff",
  text: "#000000",
  font: FONT,
  legendBorder: null,
  legendOnTop: true,
  shortTitle: true,
};

function hoverTemplate(
  xProperty: PlotProperty,
  yProperty: PlotProperty,
  unitSystem: UnitSystem,
  label: string,
): string {
  return [
    `${buildAxisTitle(xProperty, unitSystem)}: %{x:.3s}`,
    `${buildAxisTitle(yProperty, unitSystem)}: %{y:.3s}`,
    label,
    "<extra></extra>",
  ].join("<br>");
}

function sameCurve(a: Curve, b: Curve): boolean {
  const close = (u: number | null, v: number | null) =>
    u === v ||
    (u !== null && v !== null && Math.abs(u - v) <= 1e-9 * Math.abs(v));
  return (
    a.x.length === b.x.length &&
    a.x.every((v, i) => close(v, b.x[i]) && close(a.y[i], b.y[i]))
  );
}

/**
 * The saturated-liquid and saturated-vapor branches of the dome, or a single
 * saturation curve where they coincide (P–T of a pure fluid).
 */
export function buildDomeTraces(
  dome: { liquid: Curve; vapor: Curve },
  xProperty: PlotProperty,
  yProperty: PlotProperty,
  unitSystem: UnitSystem = DEFAULT_UNIT_SYSTEM,
  look: ChartLook = APP_LOOK,
): Record<string, unknown>[] {
  const branches: [string, Curve][] = sameCurve(dome.liquid, dome.vapor)
    ? [["Saturation curve", dome.liquid]]
    : [
        ["Saturated liquid", dome.liquid],
        ["Saturated vapor", dome.vapor],
      ];
  // Both branches share one red line, so they share one legend entry (which
  // toggles them together); hovering still names the branch.
  return branches.map(([name, curve], index) => ({
    type: "scatter",
    mode: "lines",
    x: convertArray(curve.x, xProperty, unitSystem),
    y: convertArray(curve.y, yProperty, unitSystem),
    name: branches.length > 1 ? "Saturation dome" : name,
    legendgroup: "dome",
    line: { width: 2, color: look.dome },
    showlegend: index === 0,
    hoverlabel: { bgcolor: "#0f172a", font: { color: "#f8fafc" } },
    hovertemplate: hoverTemplate(xProperty, yProperty, unitSystem, name),
  }));
}

export function buildIsolineTraces(
  isolines: IsolineCurve[],
  xProperty: PlotProperty,
  yProperty: PlotProperty,
  unitSystem: UnitSystem = DEFAULT_UNIT_SYSTEM,
  look: ChartLook = APP_LOOK,
): Record<string, unknown>[] {
  return isolines.map((isoline, index) => {
    const label = buildIsolineLabel(isoline.kind, isoline.value, unitSystem);
    return {
      type: "scatter",
      mode: "lines",
      x: convertArray(isoline.x, xProperty, unitSystem),
      y: convertArray(isoline.y, yProperty, unitSystem),
      name: label,
      line: {
        width: 1.5,
        color: look.isoline(index),
        dash: "dash",
      },
      // Labelled on their lines instead, when the look does.
      showlegend: !look.inlineLabels,
      hoverlabel: { bgcolor: "#0f172a", font: { color: "#f8fafc" } },
      hovertemplate: hoverTemplate(xProperty, yProperty, unitSystem, label),
    };
  });
}

/** A line through states, in SI on the diagram's axes. */
export type PlotPath = {
  label: string;
  /** "line": a straight segment, for a leg whose real path is unknown. */
  kind: "process" | "line";
  x: number[];
  y: number[];
};

/**
 * A chart's visible ranges in axis units: Plotly's, so log10 of the shown
 * values on a log axis.
 */
export type AxisView = { x: [number, number]; y: [number, number] };

type AxisScales = { x: string; y: string };

/**
 * Process legs drawn between tracked states, one legend entry for all, then
 * one arrow trace per leg (see {@link buildPathArrows}), drawn for `view` or,
 * without it, for all the legs.
 */
export function buildPathTraces(
  paths: PlotPath[],
  xProperty: PlotProperty,
  yProperty: PlotProperty,
  unitSystem: UnitSystem = DEFAULT_UNIT_SYSTEM,
  scales: AxisScales = { x: "linear", y: "linear" },
  view?: AxisView,
  look: ChartLook = APP_LOOK,
): Record<string, unknown>[] {
  // The legend shows a solid leg when there is one.
  const shown = Math.max(
    paths.findIndex((p) => p.kind === "process"),
    0,
  );
  const lines = paths.map((path, index) => ({
    type: "scatter",
    mode: "lines",
    x: path.x.map((v) => fromSI(xProperty, v, unitSystem)),
    y: path.y.map((v) => fromSI(yProperty, v, unitSystem)),
    name: "Processes",
    legendgroup: "paths",
    showlegend: index === shown,
    line: {
      width: 2.5,
      color: look.path,
      dash: path.kind === "line" ? "dot" : "solid",
    },
    hoverinfo: "text",
    text: path.label,
  }));
  const arrows = buildPathArrows(
    paths,
    xProperty,
    yProperty,
    unitSystem,
    scales,
    view,
  );
  return [
    ...lines,
    ...arrows.map((a) => ({
      type: "scatter",
      mode: "markers",
      x: a.x,
      y: a.y,
      marker: {
        symbol: "arrow",
        angleref: "previous",
        // Only the second point shows: the arrow, aimed from the first.
        size: [0, 13],
        color: look.path,
        line: { width: 0 },
      },
      legendgroup: "paths",
      showlegend: false,
      hoverinfo: "skip",
    })),
  ];
}

/**
 * Each leg's arrow, as the two points of its trace (shown values; empty for
 * none): halfway along the part of the leg inside `view`, aimed the way the
 * leg goes. A leg whose visible part is too short to see gets none, so
 * zooming in on a short one (a pump on T–s) brings its arrow back.
 * Without `view`, all the legs are in view.
 */
export function buildPathArrows(
  paths: PlotPath[],
  xProperty: PlotProperty,
  yProperty: PlotProperty,
  unitSystem: UnitSystem = DEFAULT_UNIT_SYSTEM,
  scales: AxisScales = { x: "linear", y: "linear" },
  view?: AxisView,
): { x: number[]; y: number[] }[] {
  const toAxis = (scale: string) => (v: number) =>
    scale === "log" ? (v > 0 ? Math.log10(v) : NaN) : v;
  const fromAxis = (scale: string, v: number) =>
    scale === "log" ? 10 ** v : v;
  const ax = paths.map((p) =>
    p.x.map((v) => toAxis(scales.x)(fromSI(xProperty, v, unitSystem))),
  );
  const ay = paths.map((p) =>
    p.y.map((v) => toAxis(scales.y)(fromSI(yProperty, v, unitSystem))),
  );
  const box = view ?? {
    x: bounds(ax.flat()),
    y: bounds(ay.flat()),
  };
  const [x0, x1] = box.x;
  const [y0, y1] = box.y;
  const [w, h] = [x1 - x0 || 1, y1 - y0 || 1];
  return paths.map((_, k) => {
    // In the view's unit square: what is visible is in [0, 1]².
    const run = longestVisibleRun(
      ax[k].map((v) => (v - x0) / w),
      ay[k].map((v) => (v - y0) / h),
    );
    if (!run || run.length < MIN_ARROW_LEG) return { x: [], y: [] };
    const tip = run.at(0.5);
    // Aimed along the chord of the middle third: on a curve that is the
    // tangent; on a near-straight leg it is not thrown off by the noise of
    // close solved points (a pump on T–s rises 0.04 K at constant s).
    const [a, b] = [run.at(0.35), run.at(0.65)];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(d > 0)) return { x: [], y: [] };
    const tail = [
      tip[0] - ((b[0] - a[0]) / d) * 0.01,
      tip[1] - ((b[1] - a[1]) / d) * 0.01,
    ];
    const shown = (p: number[]) => [
      fromAxis(scales.x, x0 + p[0] * w),
      fromAxis(scales.y, y0 + p[1] * h),
    ];
    const [t, p] = [shown(tail), shown(tip)];
    return { x: [t[0], p[0]], y: [t[1], p[1]] };
  });
}

/** Shortest visible leg with an arrow, as a share of the view. */
const MIN_ARROW_LEG = 0.05;

function bounds(values: number[]): [number, number] {
  const finite = values.filter(Number.isFinite);
  return finite.length ? [Math.min(...finite), Math.max(...finite)] : [0, 1];
}

type Run = { length: number; at(fraction: number): number[] };

/**
 * The longest stretch of a polyline inside the unit square, its segments
 * clipped to it (an unsolved point breaks the line), with a way to find the
 * point a fraction of the way along it.
 */
function longestVisibleRun(x: number[], y: number[]): Run | null {
  const runs: number[][][] = [];
  let current: number[][] = [];
  const close = () => {
    if (current.length > 1) runs.push(current);
    current = [];
  };
  for (let i = 1; i < x.length; i++) {
    const p = [x[i - 1], y[i - 1]];
    const q = [x[i], y[i]];
    const clipped = [...p, ...q].every(Number.isFinite) ? clip(p, q) : null;
    if (!clipped) {
      close();
      continue;
    }
    const [c0, c1] = clipped;
    const last = current[current.length - 1];
    if (!last || last[0] !== c0[0] || last[1] !== c0[1]) {
      close();
      current.push(c0);
    }
    current.push(c1);
  }
  close();
  let best: Run | null = null;
  for (const pts of runs) {
    const run = runOf(pts);
    if (!best || run.length > best.length) best = run;
  }
  return best;
}

function runOf(pts: number[][]): Run {
  const lengths = pts
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const length = lengths.reduce((a, b) => a + b, 0);
  return {
    length,
    at(fraction) {
      let left = length * fraction;
      for (let i = 0; i < lengths.length; i++) {
        if (left <= lengths[i] || i === lengths.length - 1) {
          const t = lengths[i] > 0 ? Math.min(left / lengths[i], 1) : 0;
          return [
            pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t,
            pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t,
          ];
        }
        left -= lengths[i];
      }
      return pts[pts.length - 1];
    },
  };
}

/** The part of segment p–q inside the unit square (Liang–Barsky), or null. */
function clip(p: number[], q: number[]): [number[], number[]] | null {
  let [t0, t1] = [0, 1];
  const d = [q[0] - p[0], q[1] - p[1]];
  for (const [num, den] of [
    [p[0], -d[0]],
    [1 - p[0], d[0]],
    [p[1], -d[1]],
    [1 - p[1], d[1]],
  ]) {
    if (den === 0) {
      if (num < 0) return null;
    } else {
      const t = num / den;
      if (den < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
  }
  if (t0 > t1) return null;
  const at = (t: number) => [p[0] + d[0] * t, p[1] + d[1] * t];
  return [at(t0), at(t1)];
}

export function buildPointTrace(
  points: PlotPoint[],
  xProperty: PlotProperty,
  yProperty: PlotProperty,
  unitSystem: UnitSystem = DEFAULT_UNIT_SYSTEM,
  look: ChartLook = APP_LOOK,
): Record<string, unknown> | null {
  if (points.length === 0) return null;
  return {
    type: "scatter",
    // Inline labels are placed for each view, apart from the trace.
    mode: look.pointLabels && !look.inlineLabels ? "markers+text" : "markers",
    x: points.map((p) => fromSI(xProperty, p.x, unitSystem)),
    y: points.map((p) => fromSI(yProperty, p.y, unitSystem)),
    name: "Tracked states",
    text: points.map((p) => p.label),
    textposition: "top right",
    textfont: { family: look.font, size: 13, color: look.text },
    cliponaxis: false,
    marker: {
      size: 10,
      color: look.point,
      symbol: "circle",
      line: { width: 1.5, color: "#ffffff" },
    },
    hovertemplate: [
      "%{text}",
      `${buildAxisTitle(xProperty, unitSystem)}: %{x:.3s}`,
      `${buildAxisTitle(yProperty, unitSystem)}: %{y:.3s}`,
      "<extra></extra>",
    ].join("<br>"),
  };
}

/** Share of each axis the dome spans in the initial view. */
const DOME_FILL = 0.7;

/**
 * The span shown on an axis (SI): centered on the dome, which fills
 * `DOME_FILL` of it. It may reach past the computed range (below the triple
 * point, say), which keeps the dome off the edges. Falls back to the full
 * range when the dome has no extent on this axis.
 */
export function viewRange(
  axis: AxisData,
  domeValues: (number | null)[],
  /** Values that must be in view too: the states and their paths. */
  shown: readonly number[] = [],
): [number, number] | null {
  const log = axis.scale === "log";
  const to = (v: number) => (log ? Math.log10(v) : v);
  const from = (v: number) => (log ? 10 ** v : v);
  const usable = (v: number | null): v is number =>
    v !== null && Number.isFinite(v) && (!log || v > 0);
  const dome = domeValues.filter(usable);
  let range: [number, number] | null = null;
  if (dome.length > 0) {
    const lo = to(Math.min(...dome));
    const hi = to(Math.max(...dome));
    if (hi > lo) {
      const half = (hi - lo) / DOME_FILL / 2;
      const mid = (lo + hi) / 2;
      range = [mid - half, mid + half];
    }
  }
  const points = shown.filter(usable).map(to);
  if (points.length > 0) {
    const lo = Math.min(...points);
    const hi = Math.max(...points);
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.12;
    range = range
      ? [Math.min(range[0], lo - pad), Math.max(range[1], hi + pad)]
      : [lo - pad, hi + pad];
  }
  if (!range) return axis.range;
  return [from(range[0]), from(range[1])];
}

export function buildPlotLayout(
  title: string,
  x: AxisData,
  y: AxisData,
  legendPlacement: "bottom" | "right",
  xRange: [number, number] | null,
  yRange: [number, number] | null,
  unitSystem: UnitSystem = DEFAULT_UNIT_SYSTEM,
  look: ChartLook = APP_LOOK,
): Record<string, unknown> {
  const plotlyRange = (axis: AxisData, range: [number, number] | null) => {
    if (!range) return undefined;
    // Display units may flip the order (e.g. nothing today, but be safe).
    const a = fromSI(axis.property, range[0], unitSystem);
    const b = fromSI(axis.property, range[1], unitSystem);
    const [lo, hi] = [Math.min(a, b), Math.max(a, b)];
    return axis.scale === "log" ? [Math.log10(lo), Math.log10(hi)] : [lo, hi];
  };
  const axisLayout = (axis: AxisData, range: [number, number] | null) => {
    const r = plotlyRange(axis, range);
    return {
      title: { text: buildAxisTitle(axis.property, unitSystem), standoff: 10 },
      type: axis.scale,
      // Label 2 and 5 between decades in full ("200", not "2"); over a few
      // decades Plotly would label every digit, so keep to 2 and 5.
      ...(axis.scale === "log" && {
        minorloglabels: "complete",
        ...(r && r[1] - r[0] <= 3 && { dtick: "D2" }),
      }),
      gridcolor: look.grid,
      zeroline: false,
      automargin: true,
      ...(r && { range: r }),
    };
  };
  const legendRight = {
    // The dome's legend group must not switch the legend to grouped order.
    traceorder: "normal",
    orientation: "v",
    x: 1.05,
    xanchor: "left",
    y: 0.5,
    yanchor: "middle",
    bgcolor: look.legendBorder ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0)",
    bordercolor: look.legendBorder ?? "rgba(0,0,0,0)",
    borderwidth: look.legendBorder ? 1 : 0,
    font: { size: 12 },
  };
  const legendBottom = {
    traceorder: "normal",
    orientation: "h",
    // Two columns: otherwise a narrow screen gives each entry its own row.
    entrywidth: 0.5,
    entrywidthmode: "fraction",
    x: 0,
    xanchor: "left",
    y: -0.35,
    yanchor: "top",
    bgcolor: look.legendBorder ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0)",
    bordercolor: look.legendBorder ?? "rgba(0,0,0,0)",
    borderwidth: look.legendBorder ? 1 : 0,
    font: { size: 11 },
  };

  const legendTop = {
    traceorder: "normal",
    orientation: "h",
    x: 0,
    xanchor: "left",
    y: 1.02,
    yanchor: "bottom",
    bgcolor: "rgba(0,0,0,0)",
    borderwidth: 0,
    font: { size: 12, color: "#5c5c5c" },
  };
  if (look.legendOnTop) {
    return {
      title: {
        text: title,
        font: { size: 12, color: "#6b6b6b" },
        x: 0,
        xanchor: "left",
        y: 0.995,
        yanchor: "top",
      },
      paper_bgcolor: look.paper,
      plot_bgcolor: "#ffffff",
      font: { family: look.font, color: look.text },
      xaxis: axisLayout(x, xRange),
      yaxis: axisLayout(y, yRange),
      hovermode: "closest",
      showlegend: true,
      legend: legendTop,
      margin: { l: 5, r: 10, t: 96, b: 40 },
      dragmode: "pan",
    };
  }

  return {
    title: { text: title, font: { size: 12 } },
    paper_bgcolor: look.paper,
    plot_bgcolor: "#ffffff",
    font: { family: look.font, color: look.text },
    xaxis: axisLayout(x, xRange),
    yaxis: axisLayout(y, yRange),
    hovermode: "closest",
    showlegend: true,
    legend: legendPlacement === "right" ? legendRight : legendBottom,
    margin:
      legendPlacement === "right"
        ? { l: 80, r: 160, t: 70, b: 80 }
        : { l: 5, r: 5, t: 70, b: 100 },
    dragmode: "pan",
  };
}
