// Pretty-printing helpers for unit strings and property symbols.
//
// Property symbols follow Çengel's "Thermodynamics: An Engineering Approach"
// nomenclature (ρ, h, s, u, x, g, c_p, c_v, …) so the same letter shows up
// everywhere — chips, metric labels, modal dropdown, plot axes — instead of
// CoolProp's API names (D, H, S, U, Q, G, CPMASS, CVMASS, Hmass, …).
//
// Unit and property formatters each come in two flavors:
//   - *ToMath: LaTeX, suitable for KaTeX (<MathText/>).
//   - *ToPlain: Unicode-only, suitable for <option>, Plotly axis titles,
//     hover templates — anywhere HTML/LaTeX cannot be embedded.
//
// A small fixed table covers every string the app emits today. A regex-based
// fallback handles anything else (e.g. legacy SI strings or future additions)
// without crashing.

import { normalizePropertyName } from "./units";

const UNIT_MATH: Record<string, string> = {
  "": "",
  "-": "",
  K: "\\mathrm{K}",
  Pa: "\\mathrm{Pa}",
  kPa: "\\mathrm{kPa}",
  psi: "\\mathrm{psi}",
  "°C": "{}^{\\circ}\\mathrm{C}",
  "°F": "{}^{\\circ}\\mathrm{F}",
  "°R": "{}^{\\circ}\\mathrm{R}",
  "kg/m^3": "\\mathrm{kg}/\\mathrm{m}^{3}",
  "lb/ft^3": "\\mathrm{lb}/\\mathrm{ft}^{3}",
  "J/kg": "\\mathrm{J}/\\mathrm{kg}",
  "kJ/kg": "\\mathrm{kJ}/\\mathrm{kg}",
  "BTU/lb": "\\mathrm{BTU}/\\mathrm{lb}",
  "J/(kg*K)": "\\mathrm{J}/(\\mathrm{kg}\\cdot\\mathrm{K})",
  "kJ/(kg*K)": "\\mathrm{kJ}/(\\mathrm{kg}\\cdot\\mathrm{K})",
  "BTU/(lb*°R)": "\\mathrm{BTU}/(\\mathrm{lb}\\cdot{}^{\\circ}\\mathrm{R})",
  "W/(m*K)": "\\mathrm{W}/(\\mathrm{m}\\cdot\\mathrm{K})",
  "Pa*s": "\\mathrm{Pa}\\cdot\\mathrm{s}",
  "BTU/(h*ft*°F)":
    "\\mathrm{BTU}/(\\mathrm{h}\\cdot\\mathrm{ft}\\cdot{}^{\\circ}\\mathrm{F})",
  "lb/(ft*s)": "\\mathrm{lb}/(\\mathrm{ft}\\cdot\\mathrm{s})",
  "mol/mol": "",
};

const UNIT_PLAIN: Record<string, string> = {
  "": "",
  "-": "",
  K: "K",
  Pa: "Pa",
  kPa: "kPa",
  psi: "psi",
  "°C": "°C",
  "°F": "°F",
  "°R": "°R",
  "kg/m^3": "kg/m³",
  "lb/ft^3": "lb/ft³",
  "J/kg": "J/kg",
  "kJ/kg": "kJ/kg",
  "BTU/lb": "BTU/lb",
  "J/(kg*K)": "J/(kg·K)",
  "kJ/(kg*K)": "kJ/(kg·K)",
  "BTU/(lb*°R)": "BTU/(lb·°R)",
  "W/(m*K)": "W/(m·K)",
  "Pa*s": "Pa·s",
  "BTU/(h*ft*°F)": "BTU/(h·ft·°F)",
  "lb/(ft*s)": "lb/(ft·s)",
  "mol/mol": "",
};

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

function fallbackPlain(unit: string): string {
  return unit
    .replace(/\*/g, "·")
    .replace(/\^(-?\d+)/g, (_, exp: string) =>
      exp
        .split("")
        .map((c) => (c === "-" ? "⁻" : (SUPERSCRIPT_DIGITS[c] ?? c)))
        .join(""),
    );
}

function fallbackMath(unit: string): string {
  // Best-effort: tokenize alphabetic runs as \mathrm{} and rewrite operators.
  return unit
    .replace(/\*/g, "\\cdot ")
    .replace(/\^(-?\d+)/g, "^{$1}")
    .replace(/[A-Za-z]+/g, (token) => `\\mathrm{${token}}`);
}

export function unitToMath(unit: string): string {
  if (unit in UNIT_MATH) return UNIT_MATH[unit];
  return fallbackMath(unit);
}

export function unitToPlain(unit: string): string {
  if (unit in UNIT_PLAIN) return UNIT_PLAIN[unit];
  return fallbackPlain(unit);
}

// ── Property symbols (Çengel nomenclature) ───────────────────────────────────

const PROPERTY_MATH: Record<string, string> = {
  T: "T",
  P: "P",
  D: "\\rho",
  H: "h",
  S: "s",
  U: "u",
  Q: "x",
  G: "g",
  CPMASS: "c_p",
  CVMASS: "c_v",
  Z: "Z",
  L: "k",
  V: "\\mu",
  PRANDTL: "\\mathit{Pr}",
  // PHASE is CoolProp's enum identifier (not a thermodynamic symbol). Rendered
  // as italic "phase" via \mathit so it visually matches the other symbols.
  PHASE: "\\mathit{phase}",
  TMIN: "T_{\\min}",
  TMAX: "T_{\\max}",
  PMIN: "P_{\\min}",
  PMAX: "P_{\\max}",
};

const PROPERTY_PLAIN: Record<string, string> = {
  T: "T",
  P: "P",
  D: "ρ",
  H: "h",
  S: "s",
  U: "u",
  Q: "x",
  G: "g",
  CPMASS: "cₚ",
  CVMASS: "cᵥ",
  Z: "Z",
  L: "k",
  V: "μ",
  PRANDTL: "Pr",
  PHASE: "phase",
  TMIN: "Tmin",
  TMAX: "Tmax",
  PMIN: "Pmin",
  PMAX: "Pmax",
};

// CoolProp phase enum (matches iphase_* values in CoolProp.h).
const PHASE_LABELS: Record<number, string> = {
  0: "liquid",
  1: "supercritical",
  2: "supercritical gas",
  3: "supercritical liquid",
  4: "critical point",
  5: "gas",
  6: "two-phase",
  7: "unknown",
  8: "not imposed",
};

export function phaseLabel(code: number): string {
  if (!Number.isFinite(code)) return "unknown";
  return PHASE_LABELS[Math.round(code)] ?? "unknown";
}

const PROPERTY_LABEL: Record<string, string> = {
  T: "Temperature",
  P: "Pressure",
  D: "Density",
  H: "Specific enthalpy",
  S: "Specific entropy",
  U: "Specific internal energy",
  Q: "Vapor quality",
  G: "Specific Gibbs free energy",
  CPMASS: "Specific heat at constant pressure",
  CVMASS: "Specific heat at constant volume",
  Z: "Compressibility factor",
  L: "Thermal conductivity",
  V: "Dynamic viscosity",
  PRANDTL: "Prandtl number",
  PHASE: "Phase at current state",
  TMIN: "Minimum temperature",
  TMAX: "Maximum temperature",
  PMIN: "Minimum pressure",
  PMAX: "Maximum pressure",
};

export function propertyToMath(name: string): string {
  const canonical = normalizePropertyName(name);
  return PROPERTY_MATH[canonical] ?? canonical;
}

export function propertyToPlain(name: string): string {
  const canonical = normalizePropertyName(name);
  return PROPERTY_PLAIN[canonical] ?? canonical;
}

export function propertyLabel(name: string): string | undefined {
  const canonical = normalizePropertyName(name);
  return PROPERTY_LABEL[canonical];
}
