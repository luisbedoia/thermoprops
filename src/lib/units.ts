import { getPropertyDefinition } from "./index";

export type UnitSystem = "celsius" | "kelvin" | "imperial";

export const DEFAULT_UNIT_SYSTEM: UnitSystem = "celsius";

const C_TO_K = 273.15;
const PA_PER_KPA = 1000;
const J_PER_KJ = 1000;
const PA_PER_PSI = 6894.757293168361;
const KG_M3_PER_LB_FT3 = 16.018463373960142;
const J_KG_PER_BTU_LB = 2326;
const J_KG_K_PER_BTU_LB_R = 4186.8;

type Kind =
  | "temperature"
  | "pressure"
  | "density"
  | "specEnergy"
  | "specHeat"
  | "dimensionless";

const COOLPROP_SHORT_ALIASES: Record<string, string> = {
  Hmass: "H",
  Smass: "S",
  Umass: "U",
  Dmass: "D",
  Cpmass: "CPMASS",
  Cvmass: "CVMASS",
  Gmass: "G",
};

export function normalizePropertyName(name: string): string {
  return COOLPROP_SHORT_ALIASES[name] ?? name;
}

const UNIT_SYSTEM_ALIASES: Record<string, UnitSystem> = {
  celsius: "celsius",
  kelvin: "kelvin",
  imperial: "imperial",
  // Legacy aliases — keep so old URLs keep working.
  default: "celsius",
  si: "kelvin",
};

export function isUnitSystem(value: unknown): value is UnitSystem {
  return value === "celsius" || value === "kelvin" || value === "imperial";
}

export function resolveUnitSystem(value: unknown): UnitSystem {
  if (typeof value === "string" && value in UNIT_SYSTEM_ALIASES) {
    return UNIT_SYSTEM_ALIASES[value];
  }
  return DEFAULT_UNIT_SYSTEM;
}

function kindOf(propertyName: string): Kind | null {
  const def = getPropertyDefinition(normalizePropertyName(propertyName));
  if (!def) return null;
  switch (def.unit) {
    case "K":
      return "temperature";
    case "Pa":
      return "pressure";
    case "kg/m^3":
      return "density";
    case "J/kg":
      return "specEnergy";
    case "J/(kg*K)":
      return "specHeat";
    case "":
    case "mol/mol":
      return "dimensionless";
    default:
      return null;
  }
}

const LABELS: Record<UnitSystem, Record<Kind, string>> = {
  celsius: {
    temperature: "°C",
    pressure: "kPa",
    density: "kg/m^3",
    specEnergy: "kJ/kg",
    specHeat: "kJ/(kg*K)",
    dimensionless: "",
  },
  kelvin: {
    temperature: "K",
    pressure: "kPa",
    density: "kg/m^3",
    specEnergy: "kJ/kg",
    specHeat: "kJ/(kg*K)",
    dimensionless: "",
  },
  imperial: {
    temperature: "°F",
    pressure: "psi",
    density: "lb/ft^3",
    specEnergy: "BTU/lb",
    specHeat: "BTU/(lb*°R)",
    dimensionless: "",
  },
};

export function getDisplayUnit(
  propertyName: string,
  system: UnitSystem,
): string {
  const def = getPropertyDefinition(normalizePropertyName(propertyName));
  if (!def) return "";
  const kind = kindOf(propertyName);
  if (kind == null) return def.unit;
  if (kind === "dimensionless") return def.unit;
  return LABELS[system][kind];
}

function fromSITemperature(value: number, system: UnitSystem): number {
  switch (system) {
    case "celsius":
      return value - C_TO_K;
    case "kelvin":
      return value;
    case "imperial":
      return ((value - C_TO_K) * 9) / 5 + 32;
  }
}

function toSITemperature(value: number, system: UnitSystem): number {
  switch (system) {
    case "celsius":
      return value + C_TO_K;
    case "kelvin":
      return value;
    case "imperial":
      return ((value - 32) * 5) / 9 + C_TO_K;
  }
}

export function fromSI(
  propertyName: string,
  value: number,
  system: UnitSystem,
): number {
  const kind = kindOf(propertyName);
  switch (kind) {
    case "temperature":
      return fromSITemperature(value, system);
    case "pressure":
      return system === "imperial" ? value / PA_PER_PSI : value / PA_PER_KPA;
    case "density":
      return system === "imperial" ? value / KG_M3_PER_LB_FT3 : value;
    case "specEnergy":
      return system === "imperial" ? value / J_KG_PER_BTU_LB : value / J_PER_KJ;
    case "specHeat":
      return system === "imperial"
        ? value / J_KG_K_PER_BTU_LB_R
        : value / J_PER_KJ;
    case "dimensionless":
    case null:
    default:
      return value;
  }
}

export function toSI(
  propertyName: string,
  value: number,
  system: UnitSystem,
): number {
  const kind = kindOf(propertyName);
  switch (kind) {
    case "temperature":
      return toSITemperature(value, system);
    case "pressure":
      return system === "imperial" ? value * PA_PER_PSI : value * PA_PER_KPA;
    case "density":
      return system === "imperial" ? value * KG_M3_PER_LB_FT3 : value;
    case "specEnergy":
      return system === "imperial" ? value * J_KG_PER_BTU_LB : value * J_PER_KJ;
    case "specHeat":
      return system === "imperial"
        ? value * J_KG_K_PER_BTU_LB_R
        : value * J_PER_KJ;
    case "dimensionless":
    case null:
    default:
      return value;
  }
}
