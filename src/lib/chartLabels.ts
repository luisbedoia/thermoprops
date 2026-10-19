/**
 * Labels written on a chart, as the textbooks do: each state's name beside
 * its point, each isoline's value along its line. They are placed for the
 * view on screen (in pixels), so after a zoom or a pan they are placed again:
 * states that sit together share one label ("1, 2"), every label takes the
 * free side of what it names, and an isoline's label that would cover
 * anything is left out rather than drawn over it.
 */
import type { IsolineCurve, PlotProperty } from "@luisbedoia/coolprop-rs-wasm";
import { fromSI, getDisplayUnit, type UnitSystem } from "./units";
import { quantityInfo, type Quantity } from "./quantities";
import { unitToPlain } from "./unitsFormat";
import type { AxisView, PlotPath, PlotPoint } from "./plotUtils";

type Curve = { x: (number | null)[]; y: (number | null)[] };

export type LabelInput = {
  points: PlotPoint[];
  paths: PlotPath[];
  isolines: IsolineCurve[];
  dome: { liquid: Curve; vapor: Curve };
  xProperty: PlotProperty;
  yProperty: PlotProperty;
  unitSystem: UnitSystem;
  scales: { x: string; y: string };
  /** The visible ranges, in axis units (log10 on a log axis). */
  view: AxisView;
  /** The plot area, in pixels. */
  size: { w: number; h: number };
  colors: { text: string; isoline: string };
  font: string;
  /** The paths' arrows, as their traces hold them (shown values; the tip
   *  is the second point); labels keep clear of them. */
  arrows?: { x: number[]; y: number[] }[];
};

/** Points closer than this, in pixels, share one label. */
const GROUP_PX = 12;
/** A label's gap from its point. */
const OFFSET_PX = 7;
const STATE_FONT = 13;
const ISOLINE_FONT = 11;

/**
 * A label's extent on screen: its centre, size and angle (radians,
 * clockwise). Collisions are tested against the rotated rectangle itself,
 * not the upright box around it, which for a steep label is far larger
 * (and would leave no room beside a steep line).
 */
type Rect = { cx: number; cy: number; w: number; h: number; angle: number };
type Px = { x: number; y: number };

/** Plotly annotations for the state and isoline labels of this view. */
export function buildChartLabels(input: LabelInput): Record<string, unknown>[] {
  const { view, size, scales } = input;
  const [x0, x1] = view.x;
  const [y0, y1] = view.y;
  const toAxis = (scale: string, v: number) =>
    scale === "log" ? (v > 0 ? Math.log10(v) : NaN) : v;
  // SI on an axis → shown value → axis unit → pixel.
  const ax = (v: number | null, p: PlotProperty, scale: string) =>
    v === null ? NaN : toAxis(scale, fromSI(p, v, input.unitSystem));
  const px = (axX: number, axY: number): Px => ({
    x: ((axX - x0) / (x1 - x0)) * size.w,
    y: (1 - (axY - y0) / (y1 - y0)) * size.h,
  });
  const curvePx = (xs: (number | null)[], ys: (number | null)[]) =>
    xs.map((v, i) =>
      px(
        ax(v, input.xProperty, scales.x),
        ax(ys[i], input.yProperty, scales.y),
      ),
    );
  const inside = (p: Px) =>
    p.x >= 0 && p.x <= size.w && p.y >= 0 && p.y <= size.h;
  const fromPx = (p: Px) => ({
    x: x0 + (p.x / size.w) * (x1 - x0),
    y: y0 + (1 - p.y / size.h) * (y1 - y0),
  });

  // What labels must not cover: lines (sampled every few pixels) and points.
  const obstacles: Px[] = [];
  const addLine = (line: Px[]) => obstacles.push(...densify(line, size));
  input.paths.forEach((p) => addLine(curvePx(p.x, p.y)));
  addLine(curvePx(input.dome.liquid.x, input.dome.liquid.y));
  addLine(curvePx(input.dome.vapor.x, input.dome.vapor.y));
  const isolineLines = input.isolines.map((iso) => curvePx(iso.x, iso.y));
  // Kept per isoline: its own samples are not obstacles to its label.
  const isolineSamples = isolineLines.map((line) => densify(line, size));
  isolineSamples.forEach((samples) => obstacles.push(...samples));

  const statePx = input.points
    .map((p) => ({
      label: p.label,
      at: px(
        ax(p.x, input.xProperty, scales.x),
        ax(p.y, input.yProperty, scales.y),
      ),
    }))
    .filter((p) => inside(p.at));
  for (const p of statePx)
    for (const [dx, dy] of [
      [0, 0],
      [4, 0],
      [-4, 0],
      [0, 4],
      [0, -4],
    ])
      obstacles.push({ x: p.at.x + dx, y: p.at.y + dy });

  // The arrows' tips, as small squares.
  for (const a of input.arrows ?? []) {
    if (a.x.length < 2) continue;
    const tip = px(toAxis(scales.x, a.x[1]), toAxis(scales.y, a.y[1]));
    for (let dx = -6; dx <= 6; dx += 3)
      for (let dy = -6; dy <= 6; dy += 3)
        obstacles.push({ x: tip.x + dx, y: tip.y + dy });
  }

  const placed: Rect[] = [];
  const annotations: Record<string, unknown>[] = [];
  const score = (rect: Rect) =>
    scoreExcept(rect, placed, obstacles, new Set(), size);

  // States first: each group gets a label, on its freest side.
  for (const group of groupStates(statePx)) {
    const text = group.map((g) => g.label).join(", ");
    const c = {
      x: group.reduce((s, g) => s + g.at.x, 0) / group.length,
      y: group.reduce((s, g) => s + g.at.y, 0) / group.length,
    };
    const w = textWidth(text, STATE_FONT);
    const h = STATE_FONT + 4;
    const mine = new Set(group.map((g) => g.label));
    const others = statePx.filter((p) => !mine.has(p.label)).map((p) => p.at);
    const sides = [
      { xa: "left", ya: "bottom", dx: 1, dy: -1 },
      { xa: "right", ya: "bottom", dx: -1, dy: -1 },
      { xa: "left", ya: "top", dx: 1, dy: 1 },
      { xa: "right", ya: "top", dx: -1, dy: 1 },
    ].map((side) => {
      const left = side.dx > 0 ? c.x + OFFSET_PX : c.x - OFFSET_PX - w;
      const top = side.dy < 0 ? c.y - OFFSET_PX - h : c.y + OFFSET_PX;
      const rect = { cx: left + w / 2, cy: top + h / 2, w, h, angle: 0 };
      return { side, rect, s: score(rect) + misread(rect, c, others) };
    });
    const best = sides.reduce((a, b) => (b.s < a.s ? b : a));
    placed.push(best.rect);
    const at = fromPx(c);
    annotations.push({
      x: at.x,
      y: at.y,
      text,
      showarrow: false,
      xanchor: best.side.xa,
      yanchor: best.side.ya,
      xshift: best.side.dx * OFFSET_PX,
      yshift: -best.side.dy * OFFSET_PX,
      font: { family: input.font, size: STATE_FONT, color: input.colors.text },
    });
  }

  // Then each isoline's value, along its visible line, nearest the edge
  // where it leaves the view; left out where it would cover anything.
  input.isolines.forEach((iso, k) => {
    const line = isolineLines[k];
    const run = longestVisible(line, size);
    if (run.length < 2) return;
    const text = isolineText(iso.kind as Quantity, iso.value, input.unitSystem);
    const w = textWidth(text, ISOLINE_FONT) + 4;
    const h = ISOLINE_FONT + 4;
    const own = new Set(isolineSamples[k]);
    // On the line first (the label cuts it, as in a book), nearest the edge
    // where it leaves the view; then beside it, parallel, for a line that
    // runs along the cycle itself.
    const fractions = Array.from({ length: 37 }, (_, i) => 0.95 - i * 0.025);
    const gap = h / 2 + 3;
    for (const offset of [0, gap, -gap, 1.8 * gap, -1.8 * gap]) {
      for (const t of fractions) {
        const { at: onLine, angle } = alongRun(run, t);
        // Beside the line: along its normal, on screen.
        const at = {
          x: onLine.x - Math.sin(angle) * offset,
          y: onLine.y + Math.cos(angle) * offset,
        };
        const rect = { cx: at.x, cy: at.y, w, h, angle };
        // Its own line may run under it on the line, never beside it.
        const s = scoreExcept(
          rect,
          placed,
          obstacles,
          offset === 0 ? own : new Set(),
          size,
        );
        if (s === 0) {
          placed.push(rect);
          const p = fromPx(at);
          annotations.push({
            x: p.x,
            y: p.y,
            text,
            showarrow: false,
            xanchor: "center",
            yanchor: "middle",
            textangle: (angle * 180) / Math.PI,
            // On the line it cuts it; beside it, nothing to cut.
            ...(offset === 0 && { bgcolor: "#ffffff", borderpad: 1 }),
            font: {
              family: input.font,
              size: ISOLINE_FONT,
              color: input.colors.isoline,
            },
          });
          return;
        }
      }
    }
  });

  return annotations;
}

/**
 * A label that sits nearer another point than its own reads as that one's
 * ("1" above the 2): costly, but less than covering something.
 */
function misread(rect: Rect, own: Px, others: Px[]): number {
  const d = (p: Px) => Math.hypot(p.x - rect.cx, p.y - rect.cy);
  const mine = d(own);
  return others.some((p) => d(p) < mine) ? 500 : 0;
}

function scoreExcept(
  rect: Rect,
  placed: Rect[],
  obstacles: Px[],
  own: Set<Px>,
  size: { w: number; h: number },
): number {
  if (
    corners(rect).some(
      (c) => c.x < 0 || c.y < 0 || c.x > size.w || c.y > size.h,
    )
  )
    return Infinity;
  let s = 0;
  for (const r of placed) if (overlaps(rect, r)) s += 1000;
  // Only obstacles near it can be in it: a cheap bound first.
  const reach = (rect.w + rect.h) / 2;
  for (const o of obstacles)
    if (
      !own.has(o) &&
      Math.abs(o.x - rect.cx) <= reach &&
      Math.abs(o.y - rect.cy) <= reach &&
      contains(rect, o)
    )
      s += 10;
  return s;
}

/** Whether p lies in the rotated rectangle. */
function contains(r: Rect, p: Px): boolean {
  const [dx, dy] = [p.x - r.cx, p.y - r.cy];
  const [cos, sin] = [Math.cos(r.angle), Math.sin(r.angle)];
  return (
    Math.abs(dx * cos + dy * sin) <= r.w / 2 &&
    Math.abs(-dx * sin + dy * cos) <= r.h / 2
  );
}

function corners(r: Rect): Px[] {
  const [cos, sin] = [Math.cos(r.angle), Math.sin(r.angle)];
  const [hw, hh] = [r.w / 2, r.h / 2];
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([u, v]) => ({
    x: r.cx + u * cos - v * sin,
    y: r.cy + u * sin + v * cos,
  }));
}

/** Two rotated rectangles overlap unless an edge's axis separates them. */
function overlaps(a: Rect, b: Rect): boolean {
  const [ca, cb] = [corners(a), corners(b)];
  for (const r of [a, b]) {
    const [cos, sin] = [Math.cos(r.angle), Math.sin(r.angle)];
    for (const [ax, ay] of [
      [cos, sin],
      [-sin, cos],
    ]) {
      const project = (ps: Px[]) => ps.map((p) => p.x * ax + p.y * ay);
      const [pa, pb] = [project(ca), project(cb)];
      if (
        Math.max(...pa) <= Math.min(...pb) ||
        Math.max(...pb) <= Math.min(...pa)
      )
        return false;
    }
  }
  return true;
}

/** "10 kPa", "1200 kPa", "x = 0.8794": no thousands separator. */
export function isolineText(
  kind: Quantity,
  value: number,
  unitSystem: UnitSystem,
): string {
  const shown = new Intl.NumberFormat("en-US", {
    maximumSignificantDigits: 4,
    useGrouping: false,
  }).format(fromSI(kind, value, unitSystem));
  const unit = unitToPlain(getDisplayUnit(kind, unitSystem));
  return unit ? `${shown} ${unit}` : `${quantityInfo(kind).symbol} = ${shown}`;
}

/** States within GROUP_PX of a group's first one join it. */
function groupStates(
  states: { label: string; at: Px }[],
): { label: string; at: Px }[][] {
  const groups: { label: string; at: Px }[][] = [];
  for (const s of states) {
    const g = groups.find(
      (g) => Math.hypot(g[0].at.x - s.at.x, g[0].at.y - s.at.y) < GROUP_PX,
    );
    if (g) {
      if (!g.some((x) => x.label === s.label)) g.push(s);
    } else groups.push([s]);
  }
  return groups;
}

/** The width of a line of text in the chart's face, near enough to place it. */
function textWidth(text: string, size: number): number {
  return Math.ceil(text.length * size * 0.56) + 4;
}

/** Points every 4px along the visible part of a polyline, unsolved points
 *  breaking it. */
function densify(line: Px[], size: { w: number; h: number }): Px[] {
  const out: Px[] = [];
  for (let i = 1; i < line.length; i++) {
    const [a0, b0] = [line[i - 1], line[i]];
    if (![a0.x, a0.y, b0.x, b0.y].every(Number.isFinite)) continue;
    // Only what is on screen can be covered: the segment clipped to it
    // (after a strong zoom, both ends lie off it).
    const cut = clipToView(a0, b0, size);
    if (!cut) continue;
    const [a, b] = cut;
    const n = Math.min(
      400,
      Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4)),
    );
    for (let j = 0; j <= n; j++)
      out.push({
        x: a.x + ((b.x - a.x) * j) / n,
        y: a.y + ((b.y - a.y) * j) / n,
      });
  }
  return out;
}

/**
 * The longest stretch of a polyline inside the view, each segment clipped
 * to its edges: after a strong zoom a line crosses the screen between two
 * solved points that both lie off it.
 */
function longestVisible(line: Px[], size: { w: number; h: number }): Px[] {
  let best: Px[] = [];
  let run: Px[] = [];
  const close = () => {
    if (pathLength(run) > pathLength(best)) best = run;
    run = [];
  };
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]];
    const cut = [a.x, a.y, b.x, b.y].every(Number.isFinite)
      ? clipToView(a, b, size)
      : null;
    if (!cut) {
      close();
      continue;
    }
    const last = run[run.length - 1];
    if (!last || last.x !== cut[0].x || last.y !== cut[0].y) {
      close();
      run.push(cut[0]);
    }
    run.push(cut[1]);
  }
  close();
  return best;
}

/** The part of segment a–b inside the view (Liang–Barsky), or null. */
function clipToView(
  a: Px,
  b: Px,
  size: { w: number; h: number },
): [Px, Px] | null {
  let [t0, t1] = [0, 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  for (const [num, den] of [
    [a.x, -dx],
    [size.w - a.x, dx],
    [a.y, -dy],
    [size.h - a.y, dy],
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
  const at = (t: number) => ({ x: a.x + dx * t, y: a.y + dy * t });
  return [at(t0), at(t1)];
}

function pathLength(run: Px[]): number {
  let s = 0;
  for (let i = 1; i < run.length; i++)
    s += Math.hypot(run[i].x - run[i - 1].x, run[i].y - run[i - 1].y);
  return s;
}

/**
 * The point `t` of the way along a run and the line's direction there, as
 * an angle Plotly reads (clockwise; the text never upside down, and on a
 * near-vertical line read from the bottom up).
 */
function alongRun(run: Px[], t: number): { at: Px; angle: number } {
  const total = pathLength(run);
  let left = total * t;
  for (let i = 1; i < run.length; i++) {
    const [a, b] = [run[i - 1], run[i]];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= len || i === run.length - 1) {
      const f = len > 0 ? Math.min(left / len, 1) : 0;
      // Text reads left to right, and a steep line's bottom to top.
      let angle = Math.atan2(b.y - a.y, b.x - a.x);
      if (angle > Math.PI / 2) angle -= Math.PI;
      if (angle < -Math.PI / 2) angle += Math.PI;
      if (angle > (4 * Math.PI) / 9) angle -= Math.PI;
      return {
        at: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f },
        angle,
      };
    }
    left -= len;
  }
  return { at: run[run.length - 1], angle: 0 };
}
