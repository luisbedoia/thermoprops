/**
 * Quantities of the script language: an SI value with its dimension, so
 * `m_dot * (1.h - 4.h)` comes out in watts and `1.P + 1.h` is an error.
 */

/** Exponents of mass, length, time and temperature. */
export type Dim = readonly [m: number, l: number, t: number, k: number];

export type Quantity = {
  /** SI. */
  value: number;
  dim: Dim;
  /**
   * The value as a linear form in absolute temperatures: the sum of their
   * coefficients. 1 for a temperature (a state's T, a literal in °C or °F),
   * shown in the unit system's scale; 0 (or absent) for anything else, a
   * difference of temperatures among them. `T1 + T4` is 2, `(T1 + T4) / 2`
   * and `(m1*T1 + m2*T2) / (m1 + m2)` are back at 1. NaN when the value is
   * not linear in them (`T1 * T2`, `T1 / T2`).
   */
  absolute?: number;
  /**
   * A literal in K or °R, alone or scaled (`300 K`, `2 * 300 K`): a
   * temperature in kelvin, not a difference. Added to a temperature it
   * weighs 0 like any difference: `T1 + 15 K` is a temperature.
   */
  kelvin?: boolean;
};

/** A temperature, shown in the unit system's scale. */
export function isAbsolute(q: Quantity): boolean {
  return Math.abs((q.absolute ?? 0) - 1) < 1e-9;
}

/**
 * A difference of temperatures, which converts without the offset. Neither
 * this nor `isAbsolute` (`T1 * (P2/P1)^0.3`, `sqrt(T1*T2)`): kelvin, shown
 * as such and converted as a temperature.
 */
export function isDifference(q: Quantity): boolean {
  return !q.kelvin && Math.abs(q.absolute ?? 0) < 1e-9;
}

export const NONE: Dim = [0, 0, 0, 0];
const TEMPERATURE: Dim = [0, 0, 0, 1];
const PRESSURE: Dim = [1, -1, -2, 0];
const DENSITY: Dim = [1, -3, 0, 0];
const SPEC_VOLUME: Dim = [-1, 3, 0, 0];
const SPEC_ENERGY: Dim = [0, 2, -2, 0];
const SPEC_ENTROPY: Dim = [0, 2, -2, -1];
const POWER: Dim = [1, 2, -3, 0];
const ENERGY: Dim = [1, 2, -2, 0];
const MASS_FLOW: Dim = [1, 0, -1, 0];
const MASS: Dim = [1, 0, 0, 0];
const SPEED: Dim = [0, 1, -1, 0];
const VISCOSITY: Dim = [1, -1, -1, 0];
const CONDUCTIVITY: Dim = [1, 1, -3, -1];
const LENGTH: Dim = [0, 1, 0, 0];
const AREA: Dim = [0, 2, 0, 0];
const VOLUME: Dim = [0, 3, 0, 0];
/** UA, m·cp: power per kelvin. */
const CONDUCTANCE: Dim = [1, 2, -3, -1];
/** A heat transfer coefficient: power per area and kelvin. */
const HEAT_COEFFICIENT: Dim = [1, 0, -3, -1];

export function dimEq(a: Dim, b: Dim): boolean {
  return a.every((e, i) => e === b[i]);
}

export function dimMul(a: Dim, b: Dim, sign = 1): Dim {
  return a.map((e, i) => e + sign * b[i]) as unknown as Dim;
}

export function dimPow(a: Dim, n: number): Dim {
  return a.map((e) => e * n) as unknown as Dim;
}

export function isDimensionless(d: Dim): boolean {
  return dimEq(d, NONE);
}

type UnitDef = { dim: Dim; scale: number; offset?: number; absolute?: true };

const R_PER_K = 9 / 5;
/** 0 °C in kelvin. */
const ZERO_C = 273.15;
const FT = 0.3048;
const LB = 0.45359237;
const BTU = 1055.05585262;
const PSI = 6894.757293168361;
/** BTU/lbm and BTU/(lbm·R) as the steam tables define them (IT). */
const BTU_PER_LB = 2326;
const BTU_PER_LB_R = 4186.8;

/**
 * Units a literal can carry, `si = value * scale + offset`. Matched longest
 * first, so "kJ/(kg*K)" wins over "kJ/kg" and "kJ". No "h", "s", "J" or
 * "R": they read as names (`1.h`, `s = 1.s`, a gas constant R).
 *
 * The app's only conversion table: the unit systems' display units
 * (lib/units.ts) convert with it too.
 */
export const UNITS: Record<string, UnitDef> = {
  K: { dim: TEMPERATURE, scale: 1 },
  "°C": { dim: TEMPERATURE, scale: 1, offset: ZERO_C, absolute: true },
  degC: { dim: TEMPERATURE, scale: 1, offset: ZERO_C, absolute: true },
  "°F": {
    dim: TEMPERATURE,
    scale: 1 / R_PER_K,
    offset: ZERO_C - 32 / R_PER_K,
    absolute: true,
  },
  degF: {
    dim: TEMPERATURE,
    scale: 1 / R_PER_K,
    offset: ZERO_C - 32 / R_PER_K,
    absolute: true,
  },
  Pa: { dim: PRESSURE, scale: 1 },
  kPa: { dim: PRESSURE, scale: 1e3 },
  MPa: { dim: PRESSURE, scale: 1e6 },
  bar: { dim: PRESSURE, scale: 1e5 },
  atm: { dim: PRESSURE, scale: 101325 },
  psi: { dim: PRESSURE, scale: PSI },
  "kg/m^3": { dim: DENSITY, scale: 1 },
  "kg/m3": { dim: DENSITY, scale: 1 },
  "m^3/kg": { dim: SPEC_VOLUME, scale: 1 },
  "m3/kg": { dim: SPEC_VOLUME, scale: 1 },
  "J/kg": { dim: SPEC_ENERGY, scale: 1 },
  "kJ/kg": { dim: SPEC_ENERGY, scale: 1e3 },
  "BTU/lb": { dim: SPEC_ENERGY, scale: BTU_PER_LB },
  "J/(kg*K)": { dim: SPEC_ENTROPY, scale: 1 },
  "kJ/(kg*K)": { dim: SPEC_ENTROPY, scale: 1e3 },
  "kJ/kgK": { dim: SPEC_ENTROPY, scale: 1e3 },
  W: { dim: POWER, scale: 1 },
  kW: { dim: POWER, scale: 1e3 },
  MW: { dim: POWER, scale: 1e6 },
  kJ: { dim: ENERGY, scale: 1e3 },
  "kg/s": { dim: MASS_FLOW, scale: 1 },
  "kg/h": { dim: MASS_FLOW, scale: 1 / 3600 },
  kg: { dim: MASS, scale: 1 },
  "m/s": { dim: SPEED, scale: 1 },
  "%": { dim: NONE, scale: 0.01 },
  m: { dim: LENGTH, scale: 1 },
  mm: { dim: LENGTH, scale: 1e-3 },
  cm: { dim: LENGTH, scale: 1e-2 },
  "m^2": { dim: AREA, scale: 1 },
  m2: { dim: AREA, scale: 1 },
  "m^3": { dim: VOLUME, scale: 1 },
  m3: { dim: VOLUME, scale: 1 },
  "W/K": { dim: CONDUCTANCE, scale: 1 },
  "kW/K": { dim: CONDUCTANCE, scale: 1e3 },
  "W/(m^2*K)": { dim: HEAT_COEFFICIENT, scale: 1 },
  "kW/(m^2*K)": { dim: HEAT_COEFFICIENT, scale: 1e3 },
  "W/(m*K)": { dim: CONDUCTIVITY, scale: 1 },
  "Pa*s": { dim: VISCOSITY, scale: 1 },
  // US customary.
  "°R": { dim: TEMPERATURE, scale: 1 / R_PER_K },
  psia: { dim: PRESSURE, scale: PSI },
  ft: { dim: LENGTH, scale: FT },
  "ft^2": { dim: AREA, scale: FT ** 2 },
  "ft^3": { dim: VOLUME, scale: FT ** 3 },
  "ft/s": { dim: SPEED, scale: FT },
  lbm: { dim: MASS, scale: LB },
  "lbm/s": { dim: MASS_FLOW, scale: LB },
  "lbm/h": { dim: MASS_FLOW, scale: LB / 3600 },
  "lbm/ft^3": { dim: DENSITY, scale: LB / FT ** 3 },
  "ft^3/lbm": { dim: SPEC_VOLUME, scale: FT ** 3 / LB },
  BTU: { dim: ENERGY, scale: BTU },
  "BTU/lbm": { dim: SPEC_ENERGY, scale: BTU_PER_LB },
  "BTU/(lbm*R)": { dim: SPEC_ENTROPY, scale: BTU_PER_LB_R },
  "lbm/(ft*s)": { dim: VISCOSITY, scale: LB / FT },
  "BTU/(h*ft*R)": { dim: CONDUCTIVITY, scale: ((BTU / 3600) * R_PER_K) / FT },
  "BTU/s": { dim: POWER, scale: BTU },
  "BTU/h": { dim: POWER, scale: BTU / 3600 },
  "BTU/(h*R)": { dim: CONDUCTANCE, scale: (BTU / 3600) * R_PER_K },
  "BTU/(h*ft^2*R)": {
    dim: HEAT_COEFFICIENT,
    scale: ((BTU / 3600) * R_PER_K) / FT ** 2,
  },
  hp: { dim: POWER, scale: 745.69987158227 },
  // Other spellings: symbols a keyboard offers, and the imperial units as
  // lib/units.ts labels them.
  "℃": { dim: TEMPERATURE, scale: 1, offset: ZERO_C, absolute: true },
  "℉": {
    dim: TEMPERATURE,
    scale: 1 / R_PER_K,
    offset: ZERO_C - 32 / R_PER_K,
    absolute: true,
  },
  "°K": { dim: TEMPERATURE, scale: 1 },
  "lb/ft^3": { dim: DENSITY, scale: LB / FT ** 3 },
  "ft^3/lb": { dim: SPEC_VOLUME, scale: FT ** 3 / LB },
  "BTU/(lb*°R)": { dim: SPEC_ENTROPY, scale: BTU_PER_LB_R },
  "lb/(ft*s)": { dim: VISCOSITY, scale: LB / FT },
  "BTU/(h*ft*°F)": {
    dim: CONDUCTIVITY,
    scale: ((BTU / 3600) * R_PER_K) / FT,
  },
};

/** Unit names, longest first, for the lexer. */
export const UNIT_NAMES = Object.keys(UNITS).sort(
  (a, b) => b.length - a.length,
);

/**
 * Each unit as a pattern that also takes how the app shows it ("kJ/(kg·K)",
 * "m³"), the × of a phone keyboard and the ordinal sign of a Spanish one
 * ("25 ºC").
 */
const UNIT_PATTERNS = UNIT_NAMES.map((name) => {
  const source = name
    .replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")
    .replace(/\\\*/g, "[*·⋅×]")
    .replace(/\\\^2/g, "(?:\\^2|²)")
    .replace(/\\\^3/g, "(?:\\^3|³)")
    .replace(/°/g, "[°º]");
  return { name, pattern: new RegExp(`^${source}(?![A-Za-z0-9_])`) };
});

/**
 * The unit starting `text`, if a whole one does ("kPa" but not "kPax"): its
 * name in UNITS and how many characters it takes.
 */
export function unitAt(
  text: string,
): { name: string; length: number } | undefined {
  for (const { name, pattern } of UNIT_PATTERNS) {
    const m = pattern.exec(text);
    if (m) return { name, length: m[0].length };
  }
  return undefined;
}

/**
 * A unit glued to its number ("1.2MPa" after "1.2"), not a state named like
 * one ("1m:", "3m.h", "1m [Water]:").
 */
export function gluedUnit(text: string) {
  const unit = unitAt(text);
  return unit && !/^(\.|\s*[:[])/.test(text.slice(unit.length))
    ? unit
    : undefined;
}

export function literal(value: number, unit: string | undefined): Quantity {
  if (!unit) return { value, dim: NONE };
  const u = UNITS[unit];
  return {
    value: value * u.scale + (u.offset ?? 0),
    dim: u.dim,
    absolute: u.absolute ? 1 : undefined,
    kelvin: dimEq(u.dim, TEMPERATURE) && !u.offset ? true : undefined,
  };
}

/**
 * A literal in an offset unit read as a difference: in `T1 + 10 °C`, the
 * 10 °C is ten degrees, not 283.15 K.
 */
export function literalDifference(value: number, unit: string): Quantity {
  const u = UNITS[unit];
  return { value: value * u.scale, dim: u.dim };
}

export function hasOffset(unit: string | undefined): boolean {
  return unit !== undefined && UNITS[unit]?.offset !== undefined;
}

/** Dimension of each state property the language reads, by coolprop-rs name. */
export const PROPERTY_DIM: Record<string, Dim> = {
  pressure: PRESSURE,
  temperature: TEMPERATURE,
  density: DENSITY,
  specific_volume: SPEC_VOLUME,
  enthalpy: SPEC_ENERGY,
  entropy: SPEC_ENTROPY,
  internal_energy: SPEC_ENERGY,
  gibbs: SPEC_ENERGY,
  quality: NONE,
  cp: SPEC_ENTROPY,
  cv: SPEC_ENTROPY,
  viscosity: VISCOSITY,
  conductivity: CONDUCTIVITY,
  prandtl: NONE,
  compressibility: NONE,
  speed_of_sound: SPEED,
};

function dimName(d: Dim): string | undefined {
  return Object.keys(PROPERTY_DIM).find((name) => dimEq(PROPERTY_DIM[name], d));
}

/**
 * The coolprop-rs quantity name whose display unit fits `d` (so lib/units
 * converts it), or a unit of our own for derived quantities.
 */
export function displayKind(
  d: Dim,
): { property: string } | { unit: string; scale: number } | null {
  const name = dimName(d);
  if (name) return { property: name };
  if (dimEq(d, POWER)) return { unit: "kW", scale: 1e3 };
  if (dimEq(d, ENERGY)) return { unit: "kJ", scale: 1e3 };
  if (dimEq(d, MASS_FLOW)) return { unit: "kg/s", scale: 1 };
  if (dimEq(d, MASS)) return { unit: "kg", scale: 1 };
  if (dimEq(d, CONDUCTANCE)) return { unit: "kW/K", scale: 1e3 };
  if (dimEq(d, HEAT_COEFFICIENT)) return { unit: "W/(m²·K)", scale: 1 };
  if (dimEq(d, AREA)) return { unit: "m²", scale: 1 };
  if (dimEq(d, VOLUME)) return { unit: "m³", scale: 1 };
  if (dimEq(d, LENGTH)) return { unit: "m", scale: 1 };
  return null;
}

/**
 * `q` in `unit` ("in °F"), or null when the dimensions differ. A difference
 * of temperatures converts without the offset: 15 K is 27 °F of difference.
 */
export function convertTo(q: Quantity, unit: string): number | null {
  const u = UNITS[unit];
  if (!u || !dimEq(u.dim, q.dim)) return null;
  const offset = isDifference(q) ? 0 : (u.offset ?? 0);
  return (q.value - offset) / u.scale;
}

/** "kg·m^2/s^3" for a dimension with no named unit. */
export function siUnit(d: Dim): string {
  const base = ["kg", "m", "s", "K"];
  const num: string[] = [];
  const den: string[] = [];
  d.forEach((e, i) => {
    if (e === 0) return;
    const part = Math.abs(e) === 1 ? base[i] : `${base[i]}^${Math.abs(e)}`;
    (e > 0 ? num : den).push(part);
  });
  const n = num.join("·") || "1";
  return den.length ? `${n}/${den.join("·")}` : n;
}
