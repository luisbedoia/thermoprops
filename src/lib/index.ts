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
    (prop) => prop.name === name && prop.input
  );

  if (!isValidInputProperty) {
    throw new Error(`Invalid input property: ${name}.`);
  }
}

export async function calculateProperty(
  property: string,
  property1: string,
  value1: number,
  property2: string,
  value2: number,
  fluid: string
) {
  await loadLibrary();
  checkValidProperty(property);
  checkValidInputProperty(property1);
  checkValidInputProperty(property2);
  return window.Module!.PropsSI!(
    property,
    property1,
    value1,
    property2,
    value2,
    fluid
  );
}

export async function calculateProperties(
  property1: string,
  value1: number,
  property2: string,
  value2: number,
  fluid: string
): Promise<Result[]> {
  const propertiesToCalculate: Property[] = properties.filter(
    (property) => property.output && !property.trivial
  );

  let result: Result[] = [];

  await Promise.all(
    propertiesToCalculate.map(async (property) => {
      const propertyResult = await calculateProperty(
        property.name,
        property1,
        value1,
        property2,
        value2,
        fluid
      );
      result.push({
        name: property.name,
        unit: property.unit,
        description: property.description,
        value: propertyResult,
      });
    })
  );

  return result;
}

export async function getFluidsList(): Promise<string[]> {
  await loadLibrary();
  return window.Module!.get_global_param_string!("fluids_list")
    .split(",")
    .sort();
}

async function loadLibrary(): Promise<void> {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (window.Module) {
        clearInterval(interval);
        resolve();
      }
    }, 50);
  });
}
