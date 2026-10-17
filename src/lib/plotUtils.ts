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
    line: { width: 2, color: DOME_COLOR },
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
        color: ISOLINE_PALETTE[index % ISOLINE_PALETTE.length],
        dash: "dash",
      },
      showlegend: true,
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

/** Process legs drawn between tracked states, one legend entry for all. */
export function buildPathTraces(
  paths: PlotPath[],
  xProperty: PlotProperty,
  yProperty: PlotProperty,
  unitSystem: UnitSystem = DEFAULT_UNIT_SYSTEM,
): Record<string, unknown>[] {
  // The legend shows a solid leg when there is one.
  const shown = Math.max(
    paths.findIndex((p) => p.kind === "process"),
    0,
  );
  return paths.map((path, index) => ({
    type: "scatter",
    mode: "lines",
    x: path.x.map((v) => fromSI(xProperty, v, unitSystem)),
    y: path.y.map((v) => fromSI(yProperty, v, unitSystem)),
    name: "Processes",
    legendgroup: "paths",
    showlegend: index === shown,
    line: {
      width: 2.5,
      color: "#111827",
      dash: path.kind === "line" ? "dot" : "solid",
    },
    hoverinfo: "text",
    text: path.label,
  }));
}

export function buildPointTrace(
  points: PlotPoint[],
  xProperty: PlotProperty,
  yProperty: PlotProperty,
  unitSystem: UnitSystem = DEFAULT_UNIT_SYSTEM,
): Record<string, unknown> | null {
  if (points.length === 0) return null;
  return {
    type: "scatter",
    mode: "markers",
    x: points.map((p) => fromSI(xProperty, p.x, unitSystem)),
    y: points.map((p) => fromSI(yProperty, p.y, unitSystem)),
    name: "Tracked states",
    text: points.map((p) => p.label),
    marker: {
      size: 10,
      color: "#111827",
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
): [number, number] | null {
  const log = axis.scale === "log";
  const to = (v: number) => (log ? Math.log10(v) : v);
  const from = (v: number) => (log ? 10 ** v : v);
  const dome = domeValues.filter(
    (v): v is number => v !== null && Number.isFinite(v) && (!log || v > 0),
  );
  if (dome.length === 0) return axis.range;
  const lo = to(Math.min(...dome));
  const hi = to(Math.max(...dome));
  if (!(hi > lo)) return axis.range;
  const half = (hi - lo) / DOME_FILL / 2;
  const mid = (lo + hi) / 2;
  return [from(mid - half), from(mid + half)];
}

export function buildPlotLayout(
  title: string,
  x: AxisData,
  y: AxisData,
  legendPlacement: "bottom" | "right",
  xRange: [number, number] | null,
  yRange: [number, number] | null,
  unitSystem: UnitSystem = DEFAULT_UNIT_SYSTEM,
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
      gridcolor: "#e2e8f0",
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
    bgcolor: "rgba(255,255,255,0.95)",
    bordercolor: "#dbe4f3",
    borderwidth: 1,
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
    bgcolor: "rgba(255,255,255,0.95)",
    bordercolor: "#dbe4f3",
    borderwidth: 1,
    font: { size: 11 },
  };

  return {
    title: { text: title, font: { size: 12 } },
    paper_bgcolor: "#f8fafc",
    plot_bgcolor: "#ffffff",
    font: { family: "Inter, system-ui, sans-serif", color: "#1f2937" },
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
