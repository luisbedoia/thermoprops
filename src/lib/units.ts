export type UnitSystem = "celsius" | "kelvin" | "imperial";

export const DEFAULT_UNIT_SYSTEM: UnitSystem = "celsius";

const C_TO_K = 273.15;
const PA_PER_KPA = 1000;
const J_PER_KJ = 1000;
const PA_PER_PSI = 6894.757293168361;
const KG_M3_PER_LB_FT3 = 16.018463373960142;
const J_KG_PER_BTU_LB = 2326;
const J_KG_K_PER_BTU_LB_R = 4186.8;
// 1 BTU/(h·ft·°F) = 1.730734666 W/(m·K)
const W_M_K_PER_BTU_H_FT_F = 1.730734666;
// 1 lb/(ft·s) = 1.488163944 Pa·s
const PA_S_PER_LB_FT_S = 1.488163944;
const M_PER_FT = 0.3048;

type Kind =
  | "temperature"
  | "pressure"
  | "density"
  | "specVolume"
  | "specEnergy"
  | "specHeat"
  | "conductivity"
  | "viscosity"
  | "speed"
  | "dimensionless";

export function isUnitSystem(value: unknown): value is UnitSystem {
  return value === "celsius" || value === "kelvin" || value === "imperial";
}

export function resolveUnitSystem(value: unknown): UnitSystem {
  return isUnitSystem(value) ? value : DEFAULT_UNIT_SYSTEM;
}

/**
 * What each quantity measures, by its coolprop-rs name (state properties,
 * inputs and diagram axes share names, e.g. "temperature").
 */
const KIND: Record<string, Kind> = {
  temperature: "temperature",
  pressure: "pressure",
  density: "density",
  specific_volume: "specVolume",
  enthalpy: "specEnergy",
  internal_energy: "specEnergy",
  gibbs: "specEnergy",
  entropy: "specHeat",
  cp: "specHeat",
  cv: "specHeat",
  conductivity: "conductivity",
  viscosity: "viscosity",
  speed_of_sound: "speed",
  quality: "dimensionless",
  prandtl: "dimensionless",
  compressibility: "dimensionless",
};

function kindOf(name: string): Kind | null {
  return KIND[name] ?? null;
}

const LABELS: Record<UnitSystem, Record<Kind, string>> = {
  celsius: {
    temperature: "°C",
    pressure: "kPa",
    density: "kg/m^3",
    specVolume: "m^3/kg",
    specEnergy: "kJ/kg",
    specHeat: "kJ/(kg*K)",
    conductivity: "W/(m*K)",
    viscosity: "Pa*s",
    speed: "m/s",
    dimensionless: "",
  },
  kelvin: {
    temperature: "K",
    pressure: "kPa",
    density: "kg/m^3",
    specVolume: "m^3/kg",
    specEnergy: "kJ/kg",
    specHeat: "kJ/(kg*K)",
    conductivity: "W/(m*K)",
    viscosity: "Pa*s",
    speed: "m/s",
    dimensionless: "",
  },
  imperial: {
    temperature: "°F",
    pressure: "psi",
    density: "lb/ft^3",
    specVolume: "ft^3/lb",
    specEnergy: "BTU/lb",
    specHeat: "BTU/(lb*°R)",
    conductivity: "BTU/(h*ft*°F)",
    viscosity: "lb/(ft*s)",
    speed: "ft/s",
    dimensionless: "",
  },
};

/** Display unit of `name` in `system`; "" for dimensionless quantities. */
export function getDisplayUnit(name: string, system: UnitSystem): string {
  const kind = kindOf(name);
  if (kind == null || kind === "dimensionless") return "";
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
  name: string,
  value: number,
  system: UnitSystem,
): number {
  const kind = kindOf(name);
  switch (kind) {
    case "temperature":
      return fromSITemperature(value, system);
    case "pressure":
      return system === "imperial" ? value / PA_PER_PSI : value / PA_PER_KPA;
    case "density":
      return system === "imperial" ? value / KG_M3_PER_LB_FT3 : value;
    case "specVolume":
      // v = 1/ρ; conversion factor inverts the density factor.
      return system === "imperial" ? value * KG_M3_PER_LB_FT3 : value;
    case "specEnergy":
      return system === "imperial" ? value / J_KG_PER_BTU_LB : value / J_PER_KJ;
    case "specHeat":
      return system === "imperial"
        ? value / J_KG_K_PER_BTU_LB_R
        : value / J_PER_KJ;
    case "conductivity":
      return system === "imperial" ? value / W_M_K_PER_BTU_H_FT_F : value;
    case "viscosity":
      return system === "imperial" ? value / PA_S_PER_LB_FT_S : value;
    case "speed":
      return system === "imperial" ? value / M_PER_FT : value;
    case "dimensionless":
    case null:
    default:
      return value;
  }
}

/**
 * `fromSI` for `name` as an affine map, `shown = si * scale + offset`: how
 * coolprop-rs is told which unit to make isoline values round in.
 */
export function displayUnit(
  name: string,
  system: UnitSystem,
): { scale: number; offset: number } {
  const offset = fromSI(name, 0, system);
  return { scale: fromSI(name, 1, system) - offset, offset };
}

export function toSI(name: string, value: number, system: UnitSystem): number {
  const kind = kindOf(name);
  switch (kind) {
    case "temperature":
      return toSITemperature(value, system);
    case "pressure":
      return system === "imperial" ? value * PA_PER_PSI : value * PA_PER_KPA;
    case "density":
      return system === "imperial" ? value * KG_M3_PER_LB_FT3 : value;
    case "specVolume":
      return system === "imperial" ? value / KG_M3_PER_LB_FT3 : value;
    case "specEnergy":
      return system === "imperial" ? value * J_KG_PER_BTU_LB : value * J_PER_KJ;
    case "specHeat":
      return system === "imperial"
        ? value * J_KG_K_PER_BTU_LB_R
        : value * J_PER_KJ;
    case "conductivity":
      return system === "imperial" ? value * W_M_K_PER_BTU_H_FT_F : value;
    case "viscosity":
      return system === "imperial" ? value * PA_S_PER_LB_FT_S : value;
    case "speed":
      return system === "imperial" ? value * M_PER_FT : value;
    case "dimensionless":
    case null:
    default:
      return value;
  }
}
