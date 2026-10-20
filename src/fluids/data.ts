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

/**
 * Round temperatures (K) from the triple point to just below the critical
 * one, about 15 of them, in a step of 1, 2, 2.5 or 5 × 10ⁿ °C.
 */
export function saturationTemperatures(tTriple: number, tc: number): number[] {
  const lo = tTriple - 273.15;
  const hi = tc - 273.15;
  const raw = (hi - lo) / 15;
  const decade = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * decade).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t < hi - step / 10; t += step)
    out.push(round(t) + 273.15);
  return out;
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
    charts,
    fluids,
  };
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
