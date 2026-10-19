/**
 * The landing's live example: the refrigeration worksheet, with the
 * evaporator temperature the visitor sets, and its T–s chart.
 */
import type { ScriptResult } from "../dsl/evaluate";
import snapshot from "./cycle.json";

/** s in kJ/(kg·K), T in °C: the chart's axes. */
export type Point = [s: number, t: number];

export type Cycle = {
  cop: number | null;
  states: { name: string; at: Point }[];
  paths: { from: string; to: string; points: Point[] }[];
};

export type Dome = { liquid: Point[]; vapor: Point[] };

/** The temperature the page opens with, and how far it may go. */
export const T1 = { initial: -10, min: -30, max: 10 };

export function cycleSource(t1: number): string {
  return [
    "fluid R134a",
    `1: T = ${t1} °C, sat vapor`,
    "2: from 1, compressed to P = 1.2 MPa, eta = 80%",
    "3: P = P2, sat liquid",
    "4: from 3, throttled to P = P1",
    "draw 1 -> 2 -> 3 -> 4 -> 1",
    "COP = (h1 - h4) / (h2 - h1)",
    "",
  ].join("\n");
}

const round = (v: number) => Math.round(v * 1e4) / 1e4;
const point = (s: number, t: number): Point => [
  round(s / 1000),
  round(t - 273.15),
];

/** Every few states of a path: enough for a 360px chart. */
function thin<T>(items: T[], most = 40): T[] {
  if (items.length <= most) return items;
  const step = (items.length - 1) / (most - 1);
  return Array.from({ length: most }, (_, i) => items[Math.round(i * step)]);
}

/** The chart's part of a worksheet's result. */
export function cycleOf(result: ScriptResult): Cycle {
  const cop = result.values.find((v) => v.name === "COP")?.value?.value;
  return {
    cop: cop === undefined ? null : round(cop),
    states: result.states.flatMap((s) =>
      s.state
        ? [{ name: s.name, at: point(s.state.entropy, s.state.temperature) }]
        : [],
    ),
    paths: result.paths.map((p) => ({
      from: p.from,
      to: p.to,
      points: thin(p.states).map((s) => point(s.entropy, s.temperature)),
    })),
  };
}

/** A dome branch, in the chart's units, from a diagram's curve (SI). */
export function domeBranch(curve: {
  x: (number | null)[];
  y: (number | null)[];
}): Point[] {
  return curve.x.flatMap((s, i) => {
    const t = curve.y[i];
    return s === null || t === null ? [] : [point(s, t)];
  });
}

/**
 * Solved by CoolProp ahead of time (src/landing/__tests__/cycle.test.ts
 * checks it, and writes it again with UPDATE_LANDING=1): the dome and the
 * opening cycle, so the page draws them before CoolProp has loaded.
 */
export const SNAPSHOT = snapshot as { dome: Dome; cycle: Cycle };
