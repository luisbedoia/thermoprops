/**
 * Test double of the coolprop-rs module. Its catalogs (inputs, pairs,
 * properties, phases, diagrams, fluids) are the real ones, dumped from
 * coolprop-rs into coolprop-schema.json; only solving is faked.
 */
import { vi } from "vitest";
import type {
  CoolProp,
  CriticalPoint,
  DiagramData,
  DiagramRequest,
  FluidData,
  State,
} from "@luisbedoia/coolprop-rs-wasm";
import { CoolPropError } from "@luisbedoia/coolprop-rs-wasm";
import fixture from "./coolprop-schema.json";

/** Water at 101 325 Pa and 300 K, as coolprop-rs solves it. */
export const LIQUID_WATER: State = {
  pressure: 101325,
  temperature: 300,
  density: 996.5569,
  enthalpy: 112654.9,
  entropy: 393.06,
  internal_energy: 112553.2,
  quality: null,
  phase: "liquid",
  cp: 4180.6,
  cv: 4130.0,
  viscosity: 8.5e-4,
  conductivity: 0.61,
  prandtl: 5.8,
  gibbs: -5265.0,
  compressibility: 7.3e-4,
  speed_of_sound: 1501.4,
};

/** Water at 101 325 Pa, x = 0.5: transport properties are undefined. */
export const TWO_PHASE_WATER: State = {
  ...LIQUID_WATER,
  temperature: 373.124,
  density: 1.1946,
  enthalpy: 1547293.5,
  entropy: 4330.7,
  internal_energy: 1462472.1,
  quality: 0.5,
  phase: "two_phase",
  cp: null,
  cv: null,
  viscosity: null,
  conductivity: null,
  prandtl: null,
  compressibility: null,
  speed_of_sound: null,
};

const CRITICAL: CriticalPoint = {
  temperature: 647.096,
  pressure: 22.064e6,
  density: 322,
};

/** A small diagram with the requested isolines, values in SI. */
export function fakeDiagram(request: DiagramRequest): DiagramData {
  const info = fixture.schema.diagrams.find((d) => d.id === request.diagram);
  if (!info) {
    throw new CoolPropError({
      kind: "invalid_input",
      message: `unknown diagram: ${request.diagram}`,
    });
  }
  const curve = (x: (number | null)[], y: (number | null)[]) => ({ x, y });
  return {
    id: info.id,
    x: { ...info.x, range: [0, 3e6] },
    y: { ...info.y, range: [600, 50e6] },
    limits: { t_min: 275.9, t_max: 1455.9, p_min: 617.8, p_max: 49.6e6 },
    dome: {
      liquid: curve([1e5, 1.5e6, 2.08e6], [700, 4e6, 22.06e6]),
      vapor: curve([2.5e6, 2.6e6, 2.08e6], [700, 4e6, 22.06e6]),
    },
    isolines: (request.isolines ?? []).map((spec, i) => ({
      kind: spec.kind,
      value: spec.values?.[0] ?? 300 + 50 * i,
      ...curve([1e5, null, 2e6], [1e4, null, 1e6]),
    })),
  } as DiagramData;
}

export function fakeCoolProp() {
  const fluids = new Map<string, ReturnType<typeof makeFluid>>();
  function makeFluid(data: FluidData) {
    return {
      name: data.name,
      data,
      critical: CRITICAL,
      state: vi.fn((): State => LIQUID_WATER),
      states: vi.fn(),
      diagram: vi.fn(fakeDiagram),
    };
  }
  const fluid = vi.fn((name: string) => {
    const data = (fixture.catalog as FluidData[]).find(
      (f) => f.name === name || f.aliases.includes(name),
    );
    if (!data) {
      throw new CoolPropError({
        kind: "unknown_fluid",
        message: `unknown fluid: ${name}`,
      });
    }
    if (!fluids.has(data.name)) fluids.set(data.name, makeFluid(data));
    return fluids.get(data.name)!;
  });
  const cp = {
    version: () => fixture.version,
    catalog: () => fixture.catalog,
    inputs: () => fixture.schema.inputs,
    pairs: () => fixture.schema.pairs,
    properties: () => fixture.schema.properties,
    phases: () => fixture.schema.phases,
    plotProperties: () => fixture.schema.plot_properties,
    diagrams: () => fixture.schema.diagrams,
    fluid,
  } as unknown as CoolProp;
  return { cp, fluid };
}
