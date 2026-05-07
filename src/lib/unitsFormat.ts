// Pretty-printing helpers for unit strings.
//
// Two output flavors:
//   - unitToMath: LaTeX, suitable for KaTeX (<MathText/>).
//   - unitToPlain: Unicode-only, suitable for <option>, Plotly axis titles,
//     hover templates, etc.
//
// A small fixed table covers every unit string the app actually emits today.
// A regex-based fallback handles anything else (e.g. legacy SI strings or
// future additions) without crashing.

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
  "mol/mol": "\\mathrm{mol}/\\mathrm{mol}",
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
  "mol/mol": "mol/mol",
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
