import { UNITS } from "../dsl/units";

export type UnitSystem = "celsius" | "kelvin" | "imperial";

export const DEFAULT_UNIT_SYSTEM: UnitSystem = "celsius";

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

/**
 * Each kind's unit in each system: `label` as shown, `unit` the name it
 * converts by in the script language's table (dsl/units.ts), the app's only
 * one. Dimensionless kinds have neither.
 */
const UNIT_OF: Record<
  UnitSystem,
  Record<Exclude<Kind, "dimensionless">, { label: string; unit: string }>
> = {
  celsius: {
    temperature: { label: "°C", unit: "°C" },
    pressure: { label: "kPa", unit: "kPa" },
    density: { label: "kg/m^3", unit: "kg/m^3" },
    specVolume: { label: "m^3/kg", unit: "m^3/kg" },
    specEnergy: { label: "kJ/kg", unit: "kJ/kg" },
    specHeat: { label: "kJ/(kg*K)", unit: "kJ/(kg*K)" },
    conductivity: { label: "W/(m*K)", unit: "W/(m*K)" },
    viscosity: { label: "Pa*s", unit: "Pa*s" },
    speed: { label: "m/s", unit: "m/s" },
  },
  kelvin: {
    temperature: { label: "K", unit: "K" },
    pressure: { label: "kPa", unit: "kPa" },
    density: { label: "kg/m^3", unit: "kg/m^3" },
    specVolume: { label: "m^3/kg", unit: "m^3/kg" },
    specEnergy: { label: "kJ/kg", unit: "kJ/kg" },
    specHeat: { label: "kJ/(kg*K)", unit: "kJ/(kg*K)" },
    conductivity: { label: "W/(m*K)", unit: "W/(m*K)" },
    viscosity: { label: "Pa*s", unit: "Pa*s" },
    speed: { label: "m/s", unit: "m/s" },
  },
  imperial: {
    temperature: { label: "°F", unit: "°F" },
    pressure: { label: "psi", unit: "psi" },
    density: { label: "lb/ft^3", unit: "lbm/ft^3" },
    specVolume: { label: "ft^3/lb", unit: "ft^3/lbm" },
    specEnergy: { label: "BTU/lb", unit: "BTU/lbm" },
    specHeat: { label: "BTU/(lb*°R)", unit: "BTU/(lbm*R)" },
    conductivity: { label: "BTU/(h*ft*°F)", unit: "BTU/(h*ft*R)" },
    viscosity: { label: "lb/(ft*s)", unit: "lbm/(ft*s)" },
    speed: { label: "ft/s", unit: "ft/s" },
  },
};

/** The unit of `name` in `system`; null for dimensionless quantities. */
function unitOf(name: string, system: UnitSystem) {
  const kind = KIND[name];
  return kind && kind !== "dimensionless" ? UNIT_OF[system][kind] : null;
}

/**
 * The unit `name` is shown and read in by default in `system`, by its name
 * in the script language ("kPa", "lbm/ft^3"); null for dimensionless ones.
 */
export function systemUnit(name: string, system: UnitSystem): string | null {
  return unitOf(name, system)?.unit ?? null;
}

/** Display unit of `name` in `system`; "" for dimensionless quantities. */
export function getDisplayUnit(name: string, system: UnitSystem): string {
  return unitOf(name, system)?.label ?? "";
}

/** `si` (SI) in `name`'s unit in `system`. */
export function fromSI(name: string, si: number, system: UnitSystem): number {
  const u = unitOf(name, system);
  if (!u) return si;
  const { scale, offset = 0 } = UNITS[u.unit];
  return (si - offset) / scale;
}

/** `value`, in `name`'s unit in `system`, in SI. */
export function toSI(name: string, value: number, system: UnitSystem): number {
  const u = unitOf(name, system);
  if (!u) return value;
  const { scale, offset = 0 } = UNITS[u.unit];
  return value * scale + offset;
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
