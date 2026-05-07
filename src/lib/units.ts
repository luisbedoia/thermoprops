import { getPropertyDefinition } from "./index";

export type UnitSystem = "si" | "imperial";

const C_TO_K = 273.15;
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

const IMPERIAL_LABELS: Record<Kind, string> = {
  temperature: "°F",
  pressure: "psi",
  density: "lb/ft^3",
  specEnergy: "BTU/lb",
  specHeat: "BTU/(lb*°R)",
  dimensionless: "",
};

export function isUnitSystem(value: unknown): value is UnitSystem {
  return value === "si" || value === "imperial";
}

export function getDisplayUnit(
  propertyName: string,
  system: UnitSystem,
): string {
  const def = getPropertyDefinition(normalizePropertyName(propertyName));
  if (!def) return "";
  if (system === "si") return def.unit;
  const kind = kindOf(propertyName);
  if (kind == null) return def.unit;
  if (kind === "dimensionless") return def.unit;
  return IMPERIAL_LABELS[kind];
}

export function toSI(
  propertyName: string,
  value: number,
  system: UnitSystem,
): number {
  if (system === "si") return value;
  const kind = kindOf(propertyName);
  switch (kind) {
    case "temperature":
      return ((value - 32) * 5) / 9 + C_TO_K;
    case "pressure":
      return value * PA_PER_PSI;
    case "density":
      return value * KG_M3_PER_LB_FT3;
    case "specEnergy":
      return value * J_KG_PER_BTU_LB;
    case "specHeat":
      return value * J_KG_K_PER_BTU_LB_R;
    case "dimensionless":
    case null:
    default:
      return value;
  }
}

export function fromSI(
  propertyName: string,
  value: number,
  system: UnitSystem,
): number {
  if (system === "si") return value;
  const kind = kindOf(propertyName);
  switch (kind) {
    case "temperature":
      return ((value - C_TO_K) * 9) / 5 + 32;
    case "pressure":
      return value / PA_PER_PSI;
    case "density":
      return value / KG_M3_PER_LB_FT3;
    case "specEnergy":
      return value / J_KG_PER_BTU_LB;
    case "specHeat":
      return value / J_KG_K_PER_BTU_LB_R;
    case "dimensionless":
    case null:
    default:
      return value;
  }
}
