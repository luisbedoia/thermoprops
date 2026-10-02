import type {
  AxisData,
  Curve,
  DiagramInfo,
  IsolineCurve,
  PlotProperty,
} from "@luisbedoia/coolprop-rs-wasm";
import { DEFAULT_UNIT_SYSTEM, fromSI, getDisplayUnit } from "./units";
import type { UnitSystem } from "./units";
import { propertyLabel, propertyToPlain, unitToPlain } from "./unitsFormat";

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
  property: string,
  unitSystem: UnitSystem = DEFAULT_UNIT_SYSTEM,
): string {
  const symbol = propertyToPlain(property);
  const unit = unitToPlain(getDisplayUnit(property, unitSystem));
  return unit ? `${symbol} (${unit})` : symbol;
}

/** "T 100 °C": the symbol, the value in display units and the unit. */
export function buildIsolineLabel(
  kind: string,
  value: number,
  unitSystem: UnitSystem = DEFAULT_UNIT_SYSTEM,
): string {
  const formatted = new Intl.NumberFormat(undefined, {
    maximumSignificantDigits: 4,
  }).format(fromSI(kind, value, unitSystem));
  const unit = unitToPlain(getDisplayUnit(kind, unitSystem));
  return [propertyToPlain(kind), formatted, unit].filter(Boolean).join(" ");
}

/** "Pressure – Enthalpy (P–h)". */
export function diagramLabel(diagram: DiagramInfo): string {
  const { x, y } = diagram;
  const names = `${propertyLabel(y.property) ?? y.property} – ${
    propertyLabel(x.property) ?? x.property
  }`;
  return `${names} (${propertyToPlain(y.property)}–${propertyToPlain(x.property)})`;
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

/** The saturated-liquid and saturated-vapor branches of the dome. */
export function buildDomeTraces(
  dome: { liquid: Curve; vapor: Curve },
  xProperty: PlotProperty,
  yProperty: PlotProperty,
  unitSystem: UnitSystem = DEFAULT_UNIT_SYSTEM,
): Record<string, unknown>[] {
  return [
    ["Saturated liquid", dome.liquid],
    ["Saturated vapor", dome.vapor],
  ].map(([name, curve]) => {
    const c = curve as Curve;
    return {
      type: "scatter",
      mode: "lines",
      x: convertArray(c.x, xProperty, unitSystem),
      y: convertArray(c.y, yProperty, unitSystem),
      name,
      line: { width: 2, color: DOME_COLOR },
      showlegend: true,
      hoverlabel: { bgcolor: "#0f172a", font: { color: "#f8fafc" } },
      hovertemplate: hoverTemplate(xProperty, yProperty, unitSystem, name as string),
    };
  });
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

/**
 * The span shown on an axis: the diagram's range, with temperature capped at
 * 1.5·Tc (beyond it the plot is mostly empty superheated gas).
 */
export function viewRange(
  axis: AxisData,
  criticalTemperature: number,
): [number, number] | null {
  if (!axis.range) return null;
  const [min, max] = axis.range;
  return axis.property === "temperature"
    ? [min, Math.min(max, 1.5 * criticalTemperature)]
    : [min, max];
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
      tickformat: ".2s",
      gridcolor: "#e2e8f0",
      zeroline: false,
      automargin: true,
      ...(r && { range: r }),
    };
  };
  const legendRight = {
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
    orientation: "h",
    x: 0.5,
    xanchor: "center",
    y: -0.35,
    yanchor: "top",
    bgcolor: "rgba(255,255,255,0.95)",
    bordercolor: "#dbe4f3",
    borderwidth: 1,
    font: { size: 12 },
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
