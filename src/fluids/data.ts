/**
 * What a fluid's page shows, worked out with CoolProp: its constants, a
 * saturation table and two diagrams. The build works it out for every
 * fluid (scripts/postbuild.mjs) and writes it into the page; a page opened
 * within the app works it out in the browser. Values are SI; the page
 * converts them for display.
 */
import type {
  CriticalPoint,
  DiagramData,
  DiagramRequest,
  FluidData,
  PlotProperty,
  Scale,
  State,
  StateInputs,
} from "@luisbedoia/coolprop-rs-wasm";
import { displayUnit } from "../lib/units";

/** A fluid, solved now (the build's module) or later (the app's worker). */
type Solver = {
  catalog(): readonly FluidData[];
  fluid(name: string): Promise<SolverFluid> | SolverFluid;
};

type SolverFluid = {
  readonly data: FluidData;
  readonly critical: CriticalPoint;
  state(inputs: StateInputs): Promise<State> | State;
  diagram(request: DiagramRequest): Promise<DiagramData> | DiagramData;
};

/** One temperature of the saturation table: liquid (f) and vapor (g). */
export type SaturationRow = {
  /** K */
  T: number;
  /** Pa: the liquid's (bubble); the vapor's (dew) differs for mixtures. */
  pf: number;
  pg: number;
  /** kg/m³ */
  rhof: number;
  rhog: number;
  /** J/kg */
  hf: number;
  hg: number;
  /** J/(kg·K) */
  sf: number;
  sg: number;
};

/** One pressure of the saturation table: liquid (f) and vapor (g). */
export type SaturationPressureRow = {
  /** Pa */
  P: number;
  /** K: the liquid's (bubble); the vapor's (dew) differs for mixtures. */
  Tf: number;
  Tg: number;
  /** kg/m³ */
  rhof: number;
  rhog: number;
  /** J/kg */
  hf: number;
  hg: number;
  /** J/(kg·K) */
  sf: number;
  sg: number;
};

/** A state of the superheated vapor table, in SI. */
export type SuperheatedRow = {
  /** K */
  T: number;
  /** kg/m³ */
  rho: number;
  /** J/kg */
  u: number;
  h: number;
  /** J/(kg·K) */
  s: number;
};

/** One pressure of the superheated vapor table: its saturated vapor, then round temperatures above it. */
export type SuperheatedBlock = {
  /** Pa */
  P: number;
  sat: SuperheatedRow;
  rows: SuperheatedRow[];
};

/** A diagram as drawn: axes, dome and isolines, in SI (null: a break). */
export type FluidChart = {
  id: string;
  x: { property: PlotProperty; scale: Scale; range: [number, number] };
  y: { property: PlotProperty; scale: Scale; range: [number, number] };
  dome: { x: (number | null)[]; y: (number | null)[] }[];
  isolines: {
    kind: string;
    value: number;
    x: (number | null)[];
    y: (number | null)[];
  }[];
};

/** A fluid of the catalog, as the index and the other pages list it. */
export type FluidSummary = {
  name: string;
  slug: string;
  /** Its display name in each language. */
  display: { en: string; es: string };
  formula: string;
  /** K, Pa */
  tc: number;
  pc: number;
  /** kg/mol */
  molarMass: number;
};

export type FluidPage = {
  fluid: FluidSummary;
  data: FluidData;
  critical: CriticalPoint;
  saturation: SaturationRow[];
  saturationByPressure: SaturationPressureRow[];
  superheated: SuperheatedBlock[];
  /**
   * K: where it boils at 1 atm, as liquid (bubble) and vapor (dew), which
   * differ for mixtures; null when it cannot be liquid at 1 atm (CO₂).
   */
  boiling: { bubble: number; dew: number } | null;
  charts: FluidChart[];
  /** Every fluid, for the links to the others. */
  fluids: FluidSummary[];
};

/** "r134a", "carbondioxide", "r1234ze-e": a fluid's address, in every language. */
export function fluidSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Six significant digits: enough for any table, and a page half the size. */
const round = (v: number) => Number(v.toPrecision(6));
const roundAll = (vs: (number | null)[]) =>
  vs.map((v) => (v === null ? null : round(v)));

/** The first of 1, 2, 2.5, 5 or 10 × 10ⁿ at least `raw`: a table's step. */
function roundStep(raw: number): number {
  const decade = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * decade).find((s) => s >= raw) ?? raw;
}

/**
 * Round temperatures (K) from the triple point to just below the critical
 * one, about 15 of them, in a step of 1, 2, 2.5 or 5 × 10ⁿ °C.
 */
export function saturationTemperatures(tTriple: number, tc: number): number[] {
  const lo = tTriple - 273.15;
  const hi = tc - 273.15;
  const step = roundStep((hi - lo) / 15);
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t < hi - step / 10; t += step)
    out.push(round(t) + 273.15);
  return out;
}

/**
 * Round temperatures (K) above `lo` up to `hi`, `step` °C apart, leaving
 * out one too close to `lo` (a saturated state, tabulated apart).
 */
function temperaturesAbove(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  const from = lo - 273.15;
  for (let t = Math.ceil(from / step) * step; t <= hi - 273.15; t += step)
    if (t > from + step / 10) out.push(round(t) + 273.15);
  return out;
}

/** Round pressures (Pa) strictly between `lo` and `hi`: m × 10ⁿ for each m. */
function roundPressures(lo: number, hi: number, mantissas: number[]): number[] {
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(lo)); 10 ** e < hi; e++)
    for (const m of mantissas) {
      const p = round(m * 10 ** e);
      if (p > lo && p < hi) out.push(p);
    }
  return out;
}

/**
 * Round pressures (Pa) from 1 kPa, or the triple point, to just below the
 * critical one: 1, 2, 3 and 5 × 10ⁿ, or more of them over a narrow range
 * (CO₂'s, from 0.52 to 7.4 MPa).
 */
export function saturationPressures(pTriple: number, pc: number): number[] {
  const lo = Math.max(pTriple, 999);
  const hi = pc * 0.98;
  const coarse = roundPressures(lo, hi, [1, 2, 3, 5]);
  return coarse.length >= 8
    ? coarse
    : roundPressures(lo, hi, [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8]);
}

/**
 * The superheated vapor table's pressures (Pa): 1, 2 and 5 × 10ⁿ, from
 * 1/200 of the critical pressure to 4/5 of it, the range the textbooks
 * tabulate; more of them over a narrow range (CO₂'s, helium's).
 */
export function superheatedPressures(pTriple: number, pc: number): number[] {
  const lo = Math.max(pTriple, pc / 200);
  const hi = pc * 0.8;
  const coarse = roundPressures(lo, hi, [1, 2, 5]);
  return coarse.length >= 5
    ? coarse
    : roundPressures(lo, hi, [1, 1.5, 2, 3, 5]);
}

/** The summaries of every fluid, with their display names in both languages. */
export async function fluidSummaries(
  cp: Solver,
  names: { en: Map<string, string>; es: Map<string, string> },
): Promise<FluidSummary[]> {
  const out: FluidSummary[] = [];
  for (const data of cp.catalog()) {
    const f = await cp.fluid(data.name);
    out.push({
      name: data.name,
      slug: fluidSlug(data.name),
      display: {
        en: names.en.get(data.name) ?? data.display_name,
        es: names.es.get(data.name) ?? data.display_name,
      },
      formula: data.formula,
      tc: round(f.critical.temperature),
      pc: round(f.critical.pressure),
      molarMass: data.molar_mass,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** What `fluid`'s page shows. */
export async function fluidPage(
  cp: Solver,
  fluid: FluidSummary,
  fluids: FluidSummary[],
): Promise<FluidPage> {
  const f = await cp.fluid(fluid.name);
  const saturation: SaturationRow[] = [];
  for (const T of saturationTemperatures(
    f.data.t_triple,
    f.critical.temperature,
  )) {
    try {
      const l = await f.state({ temperature: T, quality: 0 });
      const v = await f.state({ temperature: T, quality: 1 });
      saturation.push({
        T: round(T),
        pf: round(l.pressure),
        pg: round(v.pressure),
        rhof: round(l.density),
        rhog: round(v.density),
        hf: round(l.enthalpy),
        hg: round(v.enthalpy),
        sf: round(l.entropy),
        sg: round(v.entropy),
      });
    } catch {
      // A temperature CoolProp cannot saturate at: left out.
    }
  }
  const pc = f.critical.pressure;
  const saturationByPressure: SaturationPressureRow[] = [];
  for (const P of saturationPressures(f.data.p_triple, pc)) {
    try {
      const l = await f.state({ pressure: P, quality: 0 });
      const v = await f.state({ pressure: P, quality: 1 });
      saturationByPressure.push({
        P,
        Tf: round(l.temperature),
        Tg: round(v.temperature),
        rhof: round(l.density),
        rhog: round(v.density),
        hf: round(l.enthalpy),
        hg: round(v.enthalpy),
        sf: round(l.entropy),
        sg: round(v.entropy),
      });
    } catch {
      // A pressure CoolProp cannot saturate at: left out.
    }
  }
  const charts = [
    await chart(f, "pressure_enthalpy", "temperature"),
    await chart(f, "temperature_entropy", "pressure"),
  ].filter((c) => c !== null);
  return {
    fluid,
    data: f.data,
    critical: {
      temperature: round(f.critical.temperature),
      pressure: round(f.critical.pressure),
      density: round(f.critical.density),
    },
    saturation,
    saturationByPressure,
    superheated: await superheated(f),
    boiling: await boiling(f),
    charts,
    fluids,
  };
}

const ATM = 101325;

async function boiling(f: SolverFluid): Promise<FluidPage["boiling"]> {
  if (f.data.p_triple >= ATM || f.critical.pressure <= ATM) return null;
  try {
    const l = await f.state({ pressure: ATM, quality: 0 });
    const v = await f.state({ pressure: ATM, quality: 1 });
    return { bubble: round(l.temperature), dew: round(v.temperature) };
  } catch {
    return null;
  }
}

const superheatedRow = (s: State): SuperheatedRow => ({
  T: round(s.temperature),
  rho: round(s.density),
  u: round(s.internal_energy),
  h: round(s.enthalpy),
  s: round(s.entropy),
});

/**
 * The superheated vapor table: at each pressure, its saturated vapor, then
 * the same round temperatures for every pressure, about 12 from the lowest
 * pressure's saturation up to 1.5 times the critical temperature (or the
 * equation of state's limit).
 */
async function superheated(f: SolverFluid): Promise<SuperheatedBlock[]> {
  const blocks: SuperheatedBlock[] = [];
  const top = Math.min(f.data.t_max, 1.5 * f.critical.temperature);
  let step = 0;
  for (const P of superheatedPressures(f.data.p_triple, f.critical.pressure)) {
    try {
      const sat = superheatedRow(await f.state({ pressure: P, quality: 1 }));
      // The step, set by the lowest pressure: the widest range.
      step ||= roundStep((top - sat.T) / 12);
      const rows: SuperheatedRow[] = [];
      for (const T of temperaturesAbove(sat.T, top, step)) {
        try {
          rows.push(
            superheatedRow(await f.state({ pressure: P, temperature: T })),
          );
        } catch {
          // A state CoolProp cannot solve: left out.
        }
      }
      if (rows.length) blocks.push({ P, sat, rows });
    } catch {
      // A pressure CoolProp cannot saturate at: left out.
    }
  }
  return blocks;
}

async function chart(
  f: SolverFluid,
  id: string,
  isoline: "temperature" | "pressure",
): Promise<FluidChart | null> {
  try {
    const d = await f.diagram({
      diagram: id,
      isolines: [
        { kind: isoline, count: 6, unit: displayUnit(isoline, "celsius") },
      ],
      points: 40,
      dome_points: 50,
    });
    if (!d.x.range || !d.y.range) return null;
    return {
      id,
      x: { property: d.x.property, scale: d.x.scale, range: d.x.range },
      y: { property: d.y.property, scale: d.y.scale, range: d.y.range },
      dome: [d.dome.liquid, d.dome.vapor].map((c) => ({
        x: roundAll(c.x),
        y: roundAll(c.y),
      })),
      isolines: d.isolines.map((i) => ({
        kind: i.kind,
        value: round(i.value),
        x: roundAll(i.x),
        y: roundAll(i.y),
      })),
    };
  } catch {
    return null;
  }
}
