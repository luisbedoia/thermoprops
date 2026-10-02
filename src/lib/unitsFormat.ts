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

import type { Phase } from "@luisbedoia/coolprop-rs-wasm";

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
  "m^3/kg": "\\mathrm{m}^{3}/\\mathrm{kg}",
  "ft^3/lb": "\\mathrm{ft}^{3}/\\mathrm{lb}",
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
  "m/s": "\\mathrm{m}/\\mathrm{s}",
  "ft/s": "\\mathrm{ft}/\\mathrm{s}",
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
  "m^3/kg": "m³/kg",
  "ft^3/lb": "ft³/lb",
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
  "m/s": "m/s",
  "ft/s": "ft/s",
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
//
// Keyed by coolprop-rs names: state properties, inputs and diagram axes share
// them (e.g. "temperature", "specific_volume").

const PROPERTY_MATH: Record<string, string> = {
  temperature: "T",
  pressure: "P",
  density: "\\rho",
  specific_volume: "v",
  enthalpy: "h",
  entropy: "s",
  internal_energy: "u",
  quality: "x",
  gibbs: "g",
  cp: "c_p",
  cv: "c_v",
  compressibility: "Z",
  conductivity: "k",
  viscosity: "\\mu",
  prandtl: "\\mathit{Pr}",
  speed_of_sound: "c",
  phase: "\\mathit{phase}",
};

const PROPERTY_PLAIN: Record<string, string> = {
  temperature: "T",
  pressure: "P",
  density: "ρ",
  specific_volume: "v",
  enthalpy: "h",
  entropy: "s",
  internal_energy: "u",
  quality: "x",
  gibbs: "g",
  cp: "cₚ",
  cv: "cᵥ",
  compressibility: "Z",
  conductivity: "k",
  viscosity: "μ",
  prandtl: "Pr",
  speed_of_sound: "c",
  phase: "phase",
};

const PROPERTY_LABEL: Record<string, string> = {
  temperature: "Temperature",
  pressure: "Pressure",
  density: "Density",
  specific_volume: "Specific volume",
  enthalpy: "Specific enthalpy",
  entropy: "Specific entropy",
  internal_energy: "Specific internal energy",
  quality: "Vapor quality",
  gibbs: "Specific Gibbs free energy",
  cp: "Specific heat at constant pressure",
  cv: "Specific heat at constant volume",
  compressibility: "Compressibility factor",
  conductivity: "Thermal conductivity",
  viscosity: "Dynamic viscosity",
  prandtl: "Prandtl number",
  speed_of_sound: "Speed of sound",
  phase: "Phase at current state",
};

const PHASE_LABELS: Record<Phase, string> = {
  liquid: "liquid",
  supercritical: "supercritical",
  supercritical_gas: "supercritical gas",
  supercritical_liquid: "supercritical liquid",
  critical_point: "critical point",
  gas: "gas",
  two_phase: "two-phase",
};

export function phaseLabel(phase: Phase | null): string {
  return phase ? PHASE_LABELS[phase] : "unknown";
}

export function propertyToMath(name: string): string {
  return PROPERTY_MATH[name] ?? name;
}

export function propertyToPlain(name: string): string {
  return PROPERTY_PLAIN[name] ?? name;
}

export function propertyLabel(name: string): string | undefined {
  return PROPERTY_LABEL[name];
}
