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

export function scaleToPlotlyType(scale: 0 | 1): "linear" | "log" {
  return scale === 1 ? "log" : "linear";
}

export function buildIsolineLabel(parameter: number, value: number): string {
  const short = getParameterInfo(parameter, "short");
  const units = getParameterInfo(parameter, "units");

  const formatted = new Intl.NumberFormat(undefined, {
    maximumSignificantDigits: 4,
  }).format(value);

  const parts = [short, formatted];
  if (units && units !== "-") {
    parts.push(units);
  }

  return parts.join(" ");
}

export function buildAxisTitle(parameter: number): string {
  const short = getParameterInfo(parameter, "short");
  const units = getParameterInfo(parameter, "units");

  if (units && units !== "-") {
    return `${short} (${units})`;
  }

  return short;
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

    if (parameterShort === "T") {
      return { min: tTriple, max: tCrit };
    }

    const tStart = tTriple * 1.001;
    const tEnd = tCrit * 0.999;
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
): Record<string, unknown>[] {
  return isolines.map((isoline, index) => {
    const isSaturation = isSaturationCurve(isoline.parameter, isoline.value);
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
        color: isSaturation ? "#dc2626" : ISOLINE_PALETTE[index % ISOLINE_PALETTE.length],
        dash: isSaturation ? "solid" : "dash",
      },
      showlegend: true,
      hoverlabel: { bgcolor: "#0f172a", font: { color: "#f8fafc" } },
      hovertemplate: [
        `${buildAxisTitle(xAxisParameter)}: %{x:.3s}`,
        `${buildAxisTitle(yAxisParameter)}: %{y:.3s}`,
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
): Record<string, unknown> | null {
  if (points.length === 0) return null;
  return {
    type: "scatter",
    mode: "markers",
    x: points.map((p) => p.x),
    y: points.map((p) => p.y),
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
      `${buildAxisTitle(xAxisParameter)}: %{x:.3s}`,
      `${buildAxisTitle(yAxisParameter)}: %{y:.3s}`,
      "<extra></extra>",
    ].join("<br>"),
  };
}

export function buildPlotLayout(
  fluid: string,
  plotLabel: string,
  xAxisParameter: number,
  yAxisParameter: number,
  xAxisScale: 0 | 1,
  yAxisScale: 0 | 1,
  legendPlacement: "bottom" | "right",
): Record<string, unknown> {
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
    title: { text: `${fluid} - ${plotLabel}`, font: { size: 12 } },
    paper_bgcolor: "#f8fafc",
    plot_bgcolor: "#ffffff",
    font: { family: "Inter, system-ui, sans-serif", color: "#1f2937" },
    xaxis: {
      title: { text: buildAxisTitle(xAxisParameter), standoff: 10 },
      type: scaleToPlotlyType(xAxisScale),
      tickformat: ".2s",
      gridcolor: "#e2e8f0",
      zeroline: false,
      automargin: true,
    },
    yaxis: {
      title: { text: buildAxisTitle(yAxisParameter), standoff: 10 },
      type: scaleToPlotlyType(yAxisScale),
      tickformat: ".2s",
      gridcolor: "#e2e8f0",
      zeroline: false,
      automargin: true,
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
