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

export function calculateProperty(
  property: string,
  property1: string,
  value1: number,
  property2: string,
  value2: number,
  fluid: string,
) {
  checkValidProperty(property);
  checkValidInputProperty(property1);
  checkValidInputProperty(property2);
  if (!window.CP?.propsSI) {
    throw new Error("CoolProp PropsSI API is not available.");
  }
  return window.CP.propsSI(
    property,
    property1,
    value1,
    property2,
    value2,
    fluid,
  );
}

// Throws if CoolProp cannot evaluate the given (property1, property2) pair —
// useful as a precondition check before storing a state. We probe density
// because it is well-defined across single-phase and two-phase regions.
export function validateStateInputs(
  property1: string,
  value1: number,
  property2: string,
  value2: number,
  fluid: string,
): void {
  calculateProperty("D", property1, value1, property2, value2, fluid);
}

export function calculateProperties(
  property1: string,
  value1: number,
  property2: string,
  value2: number,
  fluid: string,
): Result[] {
  const propertiesToCalculate: Property[] = properties.filter(
    (property) => property.output && !property.trivial,
  );

  const result: Result[] = [];

  propertiesToCalculate.forEach((property) => {
    if (property.name === property1 || property.name === property2) {
      return;
    }
    let propertyResult: number;
    try {
      propertyResult = calculateProperty(
        property.name,
        property1,
        value1,
        property2,
        value2,
        fluid,
      );
    } catch {
      // Transport properties (Z, L, V, PRANDTL) and a few others are not
      // defined for every state — typically two-phase mixtures. Skip silently
      // so one undefined property doesn't blank out the whole row.
      return;
    }
    if (!Number.isFinite(propertyResult)) {
      return;
    }
    result.push({
      name: property.name,
      unit: property.unit,
      description: property.description,
      value: propertyResult,
    });
  });

  return result;
}

export function fluidHasPlots(fluid: string): boolean {
  if (!fluid || !window.CP?.describeFluidPlots) {
    return false;
  }
  const catalogue = window.CP.describeFluidPlots(fluid);
  return catalogue.plots.length > 0;
}

export async function getFluidsList(): Promise<string[]> {
  if (!window.CP?.getGlobalParamString) {
    throw new Error("CoolProp fluids API is not available.");
  }
  return window.CP.getGlobalParamString("fluids_list", "long")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .sort();
}

export async function getFluidDetails(fluid: string): Promise<FluidDetails> {
  if (!window.CP?.getFluidParamString) {
    throw new Error("CoolProp fluid metadata API is not available.");
  }

  const aliasesRaw = window.CP.getFluidParamString(fluid, "aliases") ?? "";
  const formulaRaw = window.CP.getFluidParamString(fluid, "formula") ?? "";

  const aliases = aliasesRaw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.toLowerCase() !== "none");

  const formula = formulaRaw.trim();
  const hasFormula = formula.length > 0 && formula.toLowerCase() !== "none";

  return {
    aliases,
    formula: hasFormula ? formula : undefined,
  };
}
