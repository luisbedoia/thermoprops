import type { PlotProperty } from "@luisbedoia/coolprop-rs-wasm";
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
export function FluidChart({ chart, title }: { chart: Chart; title: string }) {
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
      {labels(chart, x.at, y.at).map((l) => (
        <text
          key={l.text}
          className="fluid-chart__label"
          x={l.x + 3}
          y={l.y - 3}
        >
          {l.text}
        </text>
      ))}
    </svg>
  );
}

/**
 * Each isoline's name where it crosses a band the isolines cross apart (low
 * on a p–h diagram, where the isotherms rise through the vapor; high on a
 * T–s one, where the isobars fan out), its rightmost crossing; none that
 * would overlap the one before.
 */
function labels(
  chart: Chart,
  x: (v: number) => number,
  y: (v: number) => number,
) {
  const top = M.top;
  const height = H - M.top - M.bottom;
  const band = top + height * (chart.id === "pressure_enthalpy" ? 0.8 : 0.22);
  const placed = chart.isolines
    .map((iso) => {
      const at = crossing(iso.x, iso.y, x, y, band);
      if (!at) return null;
      const unit = unitToPlain(getDisplayUnit(iso.kind, "celsius"));
      const text = `${label(fromSI(iso.kind, iso.value, "celsius"))}${unit ? ` ${unit}` : ""}`;
      return { x: at, y: band, text };
    })
    .filter((l) => l !== null)
    .sort((a, b) => a.x - b.x);
  const kept: typeof placed = [];
  for (const l of placed) {
    const prev = kept[kept.length - 1];
    // About 6.5 px per character at the labels' size.
    if (prev && l.x < prev.x + prev.text.length * 6.5 + 6) continue;
    if (l.x + l.text.length * 6.5 > W - M.right) continue;
    kept.push(l);
  }
  return kept;
}

/** Where a curve crosses the height `band` (px), its rightmost crossing. */
function crossing(
  xs: (number | null)[],
  ys: (number | null)[],
  x: (v: number) => number,
  y: (v: number) => number,
  band: number,
): number | null {
  let best: number | null = null;
  for (let i = 1; i < xs.length; i++) {
    const [x0, y0, x1, y1] = [xs[i - 1], ys[i - 1], xs[i], ys[i]];
    if (x0 === null || y0 === null || x1 === null || y1 === null) continue;
    const [px0, py0, px1, py1] = [x(x0), y(y0), x(x1), y(y1)];
    if (![px0, py0, px1, py1].every(Number.isFinite)) continue;
    if ((py0 - band) * (py1 - band) > 0 || py0 === py1) continue;
    const px = px0 + ((band - py0) / (py1 - py0)) * (px1 - px0);
    if (px >= M.left && px <= W - M.right && (best === null || px > best))
      best = px;
  }
  return best;
}
