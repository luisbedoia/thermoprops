import type { IsolineCurve, PlotProperty } from "@luisbedoia/coolprop-rs-wasm";
import { buildChartLabels } from "../lib/chartLabels";
import { viewRange } from "../lib/plotUtils";
import { fromSI, getDisplayUnit } from "../lib/units";
import { unitToPlain } from "../lib/unitsFormat";
import type { FluidChart as Chart } from "./data";

const W = 640;
const H = 420;
const M = { left: 64, right: 18, top: 16, bottom: 46 };

const SYMBOL: Record<PlotProperty, string> = {
  pressure: "p",
  temperature: "T",
  density: "ρ",
  specific_volume: "v",
  enthalpy: "h",
  entropy: "s",
  internal_energy: "u",
};

type Axis = Chart["x"];

/** An axis in display units (°C, kPa, kJ/kg), mapped onto [from, to] px. */
function scaler(axis: Axis, from: number, to: number) {
  const show = (si: number) => fromSI(axis.property, si, "celsius");
  const log = axis.scale === "log";
  const t = (v: number) => (log ? Math.log10(v) : v);
  const [lo, hi] = axis.range.map(show).map(t);
  const at = (si: number) => {
    const v = show(si);
    if (log && !(v > 0)) return NaN;
    return from + ((t(v) - lo) / (hi - lo)) * (to - from);
  };
  const ticks = log
    ? logTicks(10 ** lo, 10 ** hi)
    : linearTicks(Math.min(lo, hi), Math.max(lo, hi));
  // Ticks in display units, placed like SI values would be.
  const tick = (v: number) => from + ((t(v) - lo) / (hi - lo)) * (to - from);
  return { at, ticks, tick };
}

function linearTicks(lo: number, hi: number): number[] {
  const raw = (hi - lo) / 5;
  const decade = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * decade).find((s) => s >= raw)!;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step / 1e6; v += step)
    out.push(Number(v.toPrecision(6)));
  return out;
}

function logTicks(lo: number, hi: number): number[] {
  const out: number[] = [];
  const few = Math.log10(hi / lo) < 3;
  for (let k = Math.floor(Math.log10(lo)); 10 ** k <= hi; k++)
    for (const m of few ? [1, 2, 5] : [1])
      if (m * 10 ** k >= lo && m * 10 ** k <= hi) out.push(m * 10 ** k);
  return out;
}

/** "M x y L x y …", broken where a point is missing or off the scale. */
function path(
  xs: (number | null)[],
  ys: (number | null)[],
  x: (v: number) => number,
  y: (v: number) => number,
): string {
  let d = "";
  let pen = false;
  xs.forEach((xv, i) => {
    const yv = ys[i];
    const px = xv === null ? NaN : x(xv);
    const py = yv === null ? NaN : y(yv);
    if (!Number.isFinite(px) || !Number.isFinite(py)) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`;
    pen = true;
  });
  return d;
}

const label = (v: number) => String(Number(v.toPrecision(4)));

function axisTitle(axis: Axis) {
  const unit = unitToPlain(getDisplayUnit(axis.property, "celsius"));
  return unit ? `${SYMBOL[axis.property]} (${unit})` : SYMBOL[axis.property];
}

/**
 * A fluid's diagram as an image of the page itself: the saturation dome and
 * a few isolines, each named at its end, on axes in °C, kPa and kJ.
 */
export function FluidChart({
  chart: computed,
  title,
}: {
  chart: Chart;
  title: string;
}) {
  const chart = framed(computed);
  const x = scaler(chart.x, M.left, W - M.right);
  const y = scaler(chart.y, H - M.bottom, M.top);
  const clip = `clip-${chart.id}`;
  return (
    <svg
      className="fluid-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={title}
    >
      <defs>
        <clipPath id={clip}>
          <rect
            x={M.left}
            y={M.top}
            width={W - M.left - M.right}
            height={H - M.top - M.bottom}
          />
        </clipPath>
      </defs>
      <g className="fluid-chart__grid">
        {x.ticks.map((v) => (
          <g key={`x${v}`}>
            <line x1={x.tick(v)} x2={x.tick(v)} y1={M.top} y2={H - M.bottom} />
            <text x={x.tick(v)} y={H - M.bottom + 16} textAnchor="middle">
              {label(v)}
            </text>
          </g>
        ))}
        {y.ticks.map((v) => (
          <g key={`y${v}`}>
            <line x1={M.left} x2={W - M.right} y1={y.tick(v)} y2={y.tick(v)} />
            <text x={M.left - 6} y={y.tick(v) + 4} textAnchor="end">
              {label(v)}
            </text>
          </g>
        ))}
      </g>
      <text
        className="fluid-chart__axis"
        x={(M.left + W - M.right) / 2}
        y={H - 8}
        textAnchor="middle"
      >
        {axisTitle(chart.x)}
      </text>
      <text
        className="fluid-chart__axis"
        transform={`translate(14 ${(M.top + H - M.bottom) / 2}) rotate(-90)`}
        textAnchor="middle"
      >
        {axisTitle(chart.y)}
      </text>
      <g clipPath={`url(#${clip})`}>
        {chart.isolines.map((iso, i) => (
          <path
            key={i}
            className="fluid-chart__isoline"
            d={path(iso.x, iso.y, x.at, y.at)}
          />
        ))}
        {chart.dome.map((c, i) => (
          <path
            key={i}
            className="fluid-chart__dome"
            d={path(c.x, c.y, x.at, y.at)}
          />
        ))}
      </g>
      {isolineLabels(chart).map((l) => (
        <text
          key={l.text}
          className={`fluid-chart__label${l.onLine ? " fluid-chart__label--on" : ""}`}
          transform={`translate(${l.x.toFixed(1)} ${l.y.toFixed(1)}) rotate(${l.angle.toFixed(1)})`}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {l.text}
        </text>
      ))}
    </svg>
  );
}

/**
 * The chart on the worksheet's axes (viewRange): the dome centred, filling
 * most of each, instead of CoolProp's whole domain (up to 2.25·Tc), where
 * the dome sits in a corner under isolines of little interest.
 */
function framed(chart: Chart): Chart {
  const dome = (axis: "x" | "y") => chart.dome.flatMap((c) => c[axis]);
  const range = (axis: "x" | "y") =>
    viewRange(chart[axis], dome(axis)) ?? chart[axis].range;
  return {
    ...chart,
    x: { ...chart.x, range: range("x") },
    y: { ...chart.y, range: range("y") },
  };
}

/**
 * Each isoline's value along its line, placed as the worksheet's chart
 * places them (chartLabels.ts): on the line, at its slope, clear of the
 * dome and the other isolines; left out where there is no room.
 */
function isolineLabels(chart: Chart) {
  const w = W - M.left - M.right;
  const h = H - M.top - M.bottom;
  // The axes' spans as chartLabels reads them: shown units, log10 on a log axis.
  const span = (axis: Axis) =>
    axis.range
      .map((v) => fromSI(axis.property, v, "celsius"))
      .map((v) => (axis.scale === "log" ? Math.log10(v) : v)) as [
      number,
      number,
    ];
  const view = { x: span(chart.x), y: span(chart.y) };
  const [liquid, vapor] = chart.dome;
  const annotations = buildChartLabels({
    points: [],
    paths: [],
    isolines: chart.isolines as IsolineCurve[],
    dome: { liquid, vapor },
    xProperty: chart.x.property,
    yProperty: chart.y.property,
    unitSystem: "celsius",
    scales: { x: chart.x.scale, y: chart.y.scale },
    view,
    size: { w, h },
    // Styled by the page's CSS.
    colors: { text: "", isoline: "" },
    font: "",
  }) as { x: number; y: number; text: string; textangle: number }[];
  return annotations.map((a) => ({
    x: M.left + ((a.x - view.x[0]) / (view.x[1] - view.x[0])) * w,
    y: M.top + (1 - (a.y - view.y[0]) / (view.y[1] - view.y[0])) * h,
    angle: a.textangle,
    text: a.text,
    // On its line it cuts it (a backdrop); beside it, nothing to cut.
    onLine: "bgcolor" in a,
  }));
}
