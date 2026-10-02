import type {
  InputName,
  Phase,
  State,
  StateInputs,
} from "@luisbedoia/coolprop-rs-wasm";

export interface Property {
  name: string;
  unit: string;
  description: string;
  input: boolean;
  output: boolean;
  trivial: boolean;
}

export interface Result {
  name: string;
  unit: string;
  description: string;
  value: number;
}

export interface FluidDetails {
  aliases: string[];
  formula?: string;
}

// Re-exportar utilidades de plots
export * from "./plotUtils";
export * from "./units";
export * from "./unitsFormat";

export const properties: Property[] = [
  {
    name: "T",
    unit: "K",
    description: "Temperature",
    input: true,
    output: true,
    trivial: false,
  },
  {
    name: "P",
    unit: "Pa",
    description: "Pressure",
    input: true,
    output: true,
    trivial: false,
  },
  {
    name: "D",
    unit: "kg/m^3",
    description: "Mass density",
    input: true,
    output: true,
    trivial: false,
  },
  {
    name: "H",
    unit: "J/kg",
    description: "Mass specific enthalpy",
    input: true,
    output: true,
    trivial: false,
  },
  {
    name: "S",
    unit: "J/(kg*K)",
    description: "Mass specific entropy",
    input: true,
    output: true,
    trivial: false,
  },
  {
    name: "U",
    unit: "J/kg",
    description: "Mass specific internal energy",
    input: true,
    output: true,
    trivial: false,
  },
  {
    name: "Q",
    unit: "mol/mol",
    description: "Molar vapor quality",
    input: true,
    output: true,
    trivial: false,
  },
  {
    name: "SPECVOL",
    unit: "m^3/kg",
    description: "Mass specific volume",
    input: false,
    output: true,
    trivial: false,
  },
  {
    name: "CPMASS",
    unit: "J/(kg*K)",
    description: "Mass specific constant pressure specific heat",
    input: false,
    output: true,
    trivial: false,
  },
  {
    name: "CVMASS",
    unit: "J/(kg*K)",
    description: "Mass specific constant volume specific heat",
    input: false,
    output: true,
    trivial: false,
  },
  {
    name: "TMIN",
    unit: "K",
    description: "Minimum temperature",
    input: false,
    output: true,
    trivial: true,
  },
  {
    name: "TMAX",
    unit: "K",
    description: "Maximum temperature",
    input: false,
    output: true,
    trivial: true,
  },
  {
    name: "PMIN",
    unit: "Pa",
    description: "Minimum pressure",
    input: false,
    output: true,
    trivial: true,
  },
  {
    name: "PMAX",
    unit: "Pa",
    description: "Maximum pressure",
    input: false,
    output: true,
    trivial: true,
  },
  {
    name: "PHASE",
    unit: "",
    description: "Phase",
    input: false,
    output: true,
    trivial: false,
  },
  {
    name: "G",
    unit: "J/kg",
    description: "Mass specific Gibbs free energy",
    input: false,
    output: true,
    trivial: false,
  },
  {
    name: "Z",
    unit: "",
    description: "Compressibility factor",
    input: false,
    output: true,
    trivial: false,
  },
  {
    name: "L",
    unit: "W/(m*K)",
    description: "Thermal conductivity",
    input: false,
    output: true,
    trivial: false,
  },
  {
    name: "V",
    unit: "Pa*s",
    description: "Dynamic viscosity",
    input: false,
    output: true,
    trivial: false,
  },
  {
    name: "PRANDTL",
    unit: "",
    description: "Prandtl number",
    input: false,
    output: true,
    trivial: false,
  },
];

export function checkValidProperty(name: string) {
  const isValidProperty = properties.some((prop) => prop.name === name);
  if (!isValidProperty) {
    throw new Error(`Invalid property: ${name}.`);
  }
  return isValidProperty;
}

export function checkValidInputProperty(name: string) {
  const isValidInputProperty = properties.some(
    (prop) => prop.name === name && prop.input,
  );

  if (!isValidInputProperty) {
    throw new Error(`Invalid input property: ${name}.`);
  }
}

export function getPropertyDefinition(name: string) {
  return properties.find((prop) => prop.name === name);
}

// The app keeps CoolProp's short property names (they are stored in shared
// URLs); coolprop-rs uses descriptive names. These maps translate between them.

/** App input name → coolprop-rs input name. */
const RS_INPUT: Record<string, InputName> = {
  T: "temperature",
  P: "pressure",
  D: "density",
  H: "enthalpy",
  S: "entropy",
  U: "internal_energy",
  Q: "quality",
};

/** App output name → how to read it from a solved coolprop-rs `State`. */
const RS_OUTPUT: Record<string, (s: State) => number | null> = {
  T: (s) => s.temperature,
  P: (s) => s.pressure,
  D: (s) => s.density,
  H: (s) => s.enthalpy,
  S: (s) => s.entropy,
  U: (s) => s.internal_energy,
  Q: (s) => s.quality,
  SPECVOL: (s) => 1 / s.density,
  CPMASS: (s) => s.cp,
  CVMASS: (s) => s.cv,
  PHASE: (s) => (s.phase === null ? null : PHASE_CODE[s.phase]),
  G: (s) => s.gibbs,
  Z: (s) => s.compressibility,
  L: (s) => s.conductivity,
  V: (s) => s.viscosity,
  PRANDTL: (s) => s.prandtl,
};

/** coolprop-rs phase → CoolProp's numeric `iphase_*` code (see phaseLabel). */
const PHASE_CODE: Record<Phase, number> = {
  liquid: 0,
  supercritical: 1,
  supercritical_gas: 2,
  supercritical_liquid: 3,
  critical_point: 4,
  gas: 5,
  two_phase: 6,
};

function coolprop() {
  if (!window.CPRS) {
    throw new Error("CoolProp module is not loaded.");
  }
  return window.CPRS;
}

/**
 * Whether two inputs can fix a state together. Only the pairs CoolProp can
 * actually solve are accepted (e.g. T with H is not).
 */
export function areCompatibleInputs(a: string, b: string): boolean {
  const ra = RS_INPUT[a];
  const rb = RS_INPUT[b];
  if (!ra || !rb || ra === rb) return false;
  return coolprop()
    .pairs()
    .some(([x, y]) => (x === ra && y === rb) || (x === rb && y === ra));
}

/** Solves the full state fixed by two inputs. Throws if CoolProp cannot. */
function solveState(
  property1: string,
  value1: number,
  property2: string,
  value2: number,
  fluid: string,
): State {
  checkValidInputProperty(property1);
  checkValidInputProperty(property2);
  // The names come from runtime data (URL, form), so the pair cannot be
  // checked by TypeScript; the module rejects unsupported pairs at runtime.
  const inputs = {
    [RS_INPUT[property1]]: value1,
    [RS_INPUT[property2]]: value2,
  };
  return coolprop()
    .fluid(fluid)
    .state(inputs as unknown as StateInputs);
}

export function calculateProperty(
  property: string,
  property1: string,
  value1: number,
  property2: string,
  value2: number,
  fluid: string,
) {
  checkValidProperty(property);
  const read = RS_OUTPUT[property];
  if (!read) {
    throw new Error(`Property ${property} is not available.`);
  }
  const value = read(solveState(property1, value1, property2, value2, fluid));
  if (value === null) {
    throw new Error(`Property ${property} is undefined for this state.`);
  }
  return value;
}

// Throws if CoolProp cannot evaluate the given (property1, property2) pair —
// useful as a precondition check before storing a state.
export function validateStateInputs(
  property1: string,
  value1: number,
  property2: string,
  value2: number,
  fluid: string,
): void {
  solveState(property1, value1, property2, value2, fluid);
}

export function calculateProperties(
  property1: string,
  value1: number,
  property2: string,
  value2: number,
  fluid: string,
): Result[] {
  // One solve gives every property; the inputs themselves are not repeated.
  const state = solveState(property1, value1, property2, value2, fluid);
  return properties
    .filter((p) => p.output && !p.trivial)
    .filter((p) => p.name !== property1 && p.name !== property2)
    .flatMap((p) => {
      // Properties undefined for this state (e.g. transport properties
      // inside the two-phase region) come back as null and are skipped.
      const value = RS_OUTPUT[p.name]?.(state) ?? null;
      if (value === null || !Number.isFinite(value)) return [];
      return [
        { name: p.name, unit: p.unit, description: p.description, value },
      ];
    });
}

export function fluidHasPlots(fluid: string): boolean {
  if (!fluid || !window.CP?.describeFluidPlots) {
    return false;
  }
  const catalogue = window.CP.describeFluidPlots(fluid);
  return catalogue.plots.length > 0;
}

export async function getFluidsList(): Promise<string[]> {
  return coolprop()
    .catalog()
    .map((f) => f.name)
    .sort();
}

export async function getFluidDetails(fluid: string): Promise<FluidDetails> {
  const data = coolprop().fluid(fluid).data;
  return {
    aliases: data.aliases,
    formula: data.formula || undefined,
  };
}
