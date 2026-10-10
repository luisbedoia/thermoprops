// Pretty-printing of the app's display units (see units.ts) and of
// coolprop-rs catalog symbols. Symbols and descriptions themselves come from
// the coolprop-rs catalogs; only their rendering lives here.
//
// Unit formatters come in two flavors:
//   - unitToMath: LaTeX, suitable for KaTeX (<MathText/>).
//   - unitToPlain: Unicode-only, suitable for <option>, Plotly axis titles,
//     hover templates — anywhere HTML/LaTeX cannot be embedded.
//
// A small fixed table covers every unit the app emits. A regex-based fallback
// handles anything else without crashing.

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
  return unit.replace(/\*/g, "·").replace(/\^(-?\d+)/g, (_, exp: string) =>
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

// ── Property symbols ─────────────────────────────────────────────────────────

/**
 * A coolprop-rs catalog symbol as KaTeX: multi-letter symbols ("cp", "Pr")
 * are one italic name, not a product of variables.
 */
export function symbolToMath(symbol: string): string {
  return /^[A-Za-z]{2,}$/.test(symbol) ? `\\mathit{${symbol}}` : symbol;
}
