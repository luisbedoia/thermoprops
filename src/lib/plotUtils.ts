import {
  DEFAULT_UNIT_SYSTEM,
  fromSI,
  getDisplayUnit,
  normalizePropertyName,
} from "./units";
import type { UnitSystem } from "./units";
import { propertyToPlain, unitToPlain } from "./unitsFormat";

export function getParameterInfo(
  parameter: number,
  infoType: "IO" | "short" | "units" | "long",
): string {
  try {
    return window.CP.getParameterInformation(parameter, infoType);
  } catch (error) {
    console.error(`Error obteniendo info del parámetro ${parameter}:`, error);
    return "";
  }
}

function paramName(parameter: number): string {
  return normalizePropertyName(getParameterInfo(parameter, "short"));
}

function convertArray(values: number[], name: string, units: UnitSystem): number[] {
  return values.map((v) => fromSI(name, v, units));
}

export function scaleToPlotlyType(scale: 0 | 1): "linear" | "log" {
  return scale === 1 ? "log" : "linear";
}

export function buildIsolineLabel(
  parameter: number,
  value: number,
  unitSystem: UnitSystem = DEFAULT_UNIT_SYSTEM,
): string {
  const short = getParameterInfo(parameter, "short");
  const name = normalizePropertyName(short);
  const displayValue = fromSI(name, value, unitSystem);
  const unitLabel = unitToPlain(getDisplayUnit(name, unitSystem));
  const symbol = propertyToPlain(name);

  const formatted = new Intl.NumberFormat(undefined, {
    maximumSignificantDigits: 4,
  }).format(displayValue);

  const parts = [symbol, formatted];
  if (unitLabel && unitLabel !== "-") {
    parts.push(unitLabel);
  }

  return parts.join(" ");
}

export function buildAxisTitle(
  parameter: number,
  unitSystem: UnitSystem = DEFAULT_UNIT_SYSTEM,
): string {
  const short = getParameterInfo(parameter, "short");
  const name = normalizePropertyName(short);
  const symbol = propertyToPlain(name);
  const unitLabel = unitToPlain(getDisplayUnit(name, unitSystem));

  if (unitLabel && unitLabel !== "-") {
    return `${symbol} (${unitLabel})`;
  }

  return symbol;
}

export function isSaturationCurve(parameter: number, value: number): boolean {
  return parameter === 21 && (value === 0 || value === 1);
}

export function getSaturationLabel(value: number): string {
  if (value === 0) return "Saturated Liquid";
  if (value === 1) return "Saturated Vapor";
  return "";
}

export function computeSaturationDomeRange(
  parameterShort: string,
  fluid: string,
): { min: number; max: number } | null {
  try {
    const tCrit = window.CP.propsSI("Tcrit", "", 0, "", 0, fluid);
    const tTriple = window.CP.propsSI("Ttriple", "", 0, "", 0, fluid);
    if (!isFinite(tCrit) || !isFinite(tTriple)) return null;

    const tStart = tTriple * 1.001;
    const tEnd = tCrit * 0.999;

    if (parameterShort === "T") {
      return { min: tStart, max: tEnd };
    }

    const steps = 15;
    const values: number[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = tStart + ((tEnd - tStart) * i) / steps;
      const liq = window.CP.propsSI(parameterShort, "Q", 0, "T", t, fluid);
      const vap = window.CP.propsSI(parameterShort, "Q", 1, "T", t, fluid);
      if (isFinite(liq)) values.push(liq);
      if (isFinite(vap)) values.push(vap);
    }

    if (values.length < 2) return null;
    return { min: Math.min(...values), max: Math.max(...values) };
  } catch {
    return null;
  }
}

export function generateEvenlySpacedValues(
  min: number,
  max: number,
  count: number,
): number[] {
  if (count <= 1) return [min];

  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + i * step);
}

// ── Trace & layout builders ──────────────────────────────────────────────────

export type PlotPoint = {
  id: string;
  label: string;
  x: number;
  y: number;
};

const ISOLINE_PALETTE = [
  "#1d4ed8",
  "#0f766e",
  "#9333ea",
  "#f97316",
  "#0369a1",
  "#b45309",
  "#15803d",
];

export function buildIsolineTraces(
  isolines: Array<{ parameter: number; value: number; x: number[]; y: number[] }>,
  xAxisParameter: number,
  yAxisParameter: number,
  unitSystem: UnitSystem = DEFAULT_UNIT_SYSTEM,
): Record<string, unknown>[] {
  const xName = paramName(xAxisParameter);
  const yName = paramName(yAxisParameter);
  return isolines.map((isoline, index) => {
    const isSaturation = isSaturationCurve(isoline.parameter, isoline.value);
    const label = isSaturation
      ? getSaturationLabel(isoline.value)
      : buildIsolineLabel(isoline.parameter, isoline.value, unitSystem);

    return {
      type: "scatter",
      mode: "lines",
      x: convertArray(isoline.x, xName, unitSystem),
      y: convertArray(isoline.y, yName, unitSystem),
      name: label,
      line: {
        width: isSaturation ? 2 : 1.5,
        color: isSaturation ? "#dc2626" : ISOLINE_PALETTE[index % ISOLINE_PALETTE.length],
        dash: isSaturation ? "solid" : "dash",
      },
      showlegend: true,
      hoverlabel: { bgcolor: "#0f172a", font: { color: "#f8fafc" } },
      hovertemplate: [
        `${buildAxisTitle(xAxisParameter, unitSystem)}: %{x:.3s}`,
        `${buildAxisTitle(yAxisParameter, unitSystem)}: %{y:.3s}`,
        label,
        "<extra></extra>",
      ].join("<br>"),
    };
  });
}

export function buildPointTrace(
  points: PlotPoint[],
  xAxisParameter: number,
  yAxisParameter: number,
  unitSystem: UnitSystem = DEFAULT_UNIT_SYSTEM,
): Record<string, unknown> | null {
  if (points.length === 0) return null;
  const xName = paramName(xAxisParameter);
  const yName = paramName(yAxisParameter);
  return {
    type: "scatter",
    mode: "markers",
    x: points.map((p) => fromSI(xName, p.x, unitSystem)),
    y: points.map((p) => fromSI(yName, p.y, unitSystem)),
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
      `${buildAxisTitle(xAxisParameter, unitSystem)}: %{x:.3s}`,
      `${buildAxisTitle(yAxisParameter, unitSystem)}: %{y:.3s}`,
      "<extra></extra>",
    ].join("<br>"),
  };
}

export function computeTemperatureViewMax(
  fluid: string,
  originalMax: number,
): number {
  try {
    const tCrit = window.CP.propsSI("Tcrit", "", 0, "", 0, fluid);
    if (!isFinite(tCrit)) return originalMax;
    return Math.min(originalMax, tCrit * 1.5);
  } catch {
    return originalMax;
  }
}

export function buildPlotLayout(
  fluid: string,
  plotLabel: string,
  xAxisParameter: number,
  yAxisParameter: number,
  xAxisScale: 0 | 1,
  yAxisScale: 0 | 1,
  legendPlacement: "bottom" | "right",
  xAxisRange?: { min: number; max: number },
  yAxisRange?: { min: number; max: number },
  unitSystem: UnitSystem = DEFAULT_UNIT_SYSTEM,
): Record<string, unknown> {
  const xName = paramName(xAxisParameter);
  const yName = paramName(yAxisParameter);
  const convertRange = (
    name: string,
    range?: { min: number; max: number },
  ): { min: number; max: number } | undefined => {
    if (!range) return range;
    const a = fromSI(name, range.min, unitSystem);
    const b = fromSI(name, range.max, unitSystem);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  };
  const convertedXRange = convertRange(xName, xAxisRange);
  const convertedYRange = convertRange(yName, yAxisRange);
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

  const axisRangeFor = (
    scale: 0 | 1,
    range?: { min: number; max: number },
  ): [number, number] | undefined => {
    if (!range) return undefined;
    return scale === 1
      ? [Math.log10(range.min), Math.log10(range.max)]
      : [range.min, range.max];
  };

  return {
    title: { text: `${fluid} - ${plotLabel}`, font: { size: 12 } },
    paper_bgcolor: "#f8fafc",
    plot_bgcolor: "#ffffff",
    font: { family: "Inter, system-ui, sans-serif", color: "#1f2937" },
    xaxis: {
      title: { text: buildAxisTitle(xAxisParameter, unitSystem), standoff: 10 },
      type: scaleToPlotlyType(xAxisScale),
      tickformat: ".2s",
      gridcolor: "#e2e8f0",
      zeroline: false,
      automargin: true,
      ...(axisRangeFor(xAxisScale, convertedXRange) && {
        range: axisRangeFor(xAxisScale, convertedXRange),
      }),
    },
    yaxis: {
      title: { text: buildAxisTitle(yAxisParameter, unitSystem), standoff: 10 },
      type: scaleToPlotlyType(yAxisScale),
      tickformat: ".2s",
      gridcolor: "#e2e8f0",
      zeroline: false,
      automargin: true,
      ...(axisRangeFor(yAxisScale, convertedYRange) && {
        range: axisRangeFor(yAxisScale, convertedYRange),
      }),
    },
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
