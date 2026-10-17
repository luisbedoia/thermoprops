/**
 * What the script language knows, documented for the editor: completions,
 * hover cards and the reference. The evaluator's tables (evaluate.ts) must
 * name the same things; a test keeps them in step.
 */

export type Doc = { name: string; detail: string; info: string };

export const KEYWORDS: (Doc & { snippet: string })[] = [
  {
    name: "state",
    detail: "pair",
    info: "A state fixed by two properties.",
    snippet: "state ${1:1}: ${2:T} = ${3}, ${4:P} = ${5}",
  },
  {
    name: "state",
    detail: "process",
    info: "A state reached from another one by a process.",
    snippet: "state ${1:2} = ${2:1} -> ${3:isentropic}(${4:P} = ${5})",
  },
  {
    name: "let",
    detail: "variable",
    info: "A value computed from states and other variables.",
    snippet: "let ${1:name} = ${2}",
  },
  {
    name: "fluid",
    detail: "default fluid",
    info: "The fluid of every state that does not name another.",
    snippet: "fluid ${1:Water}",
  },
  {
    name: "units",
    detail: "unit system",
    info: "How results are shown, and how numbers without a unit are read: celsius, kelvin or imperial.",
    snippet: "units ${1:celsius}",
  },
  {
    name: "cycle",
    detail: "draw legs",
    info: "Draws the path between consecutive states on the chart.",
    snippet: "cycle ${1:1} -> ${2:2} -> ${3:1}",
  },
  {
    name: "print",
    detail: "outputs",
    info: "Shows values as results.",
    snippet: "print ${1}",
  },
];

export const STATEMENT_KEYWORDS = [
  "state",
  "let",
  "fluid",
  "units",
  "cycle",
  "print",
];

export const UNIT_SYSTEMS: Doc[] = [
  {
    name: "celsius",
    detail: "°C · kPa · kJ/kg",
    info: "SI with degrees Celsius and kilo-units.",
  },
  {
    name: "kelvin",
    detail: "K · kPa · kJ/kg",
    info: "SI with kelvin and kilo-units.",
  },
  {
    name: "imperial",
    detail: "°F · psi · BTU/lb",
    info: "US customary units.",
  },
];

export const PROCESSES: (Doc & { snippet: string })[] = [
  {
    name: "isentropic",
    detail: "s = const",
    info: "Ideal compression or expansion: keeps the entropy.",
    snippet: "isentropic(${1:P} = ${2})",
  },
  {
    name: "isenthalpic",
    detail: "h = const",
    info: "Keeps the enthalpy.",
    snippet: "isenthalpic(${1:P} = ${2})",
  },
  {
    name: "throttle",
    detail: "h = const",
    info: "Expansion valve: keeps the enthalpy.",
    snippet: "throttle(${1:P} = ${2})",
  },
  {
    name: "isobaric",
    detail: "P = const",
    info: "Heating or cooling at constant pressure.",
    snippet: "isobaric(${1:T} = ${2})",
  },
  {
    name: "isothermal",
    detail: "T = const",
    info: "Keeps the temperature.",
    snippet: "isothermal(${1:P} = ${2})",
  },
  {
    name: "isochoric",
    detail: "v = const",
    info: "Keeps the density (rigid tank).",
    snippet: "isochoric(${1:T} = ${2})",
  },
  {
    name: "compress",
    detail: "real compressor",
    info: "h₂ = h₁ + (h₂ₛ − h₁)/η, with 2s the isentropic outlet.",
    snippet: "compress(P = ${1}, eta = ${2:0.8})",
  },
  {
    name: "expand",
    detail: "real turbine",
    info: "h₂ = h₁ − η·(h₁ − h₂ₛ), with 2s the isentropic outlet.",
    snippet: "expand(P = ${1}, eta = ${2:0.85})",
  },
  {
    name: "polytropic",
    detail: "P·vⁿ = const",
    info: "Polytropic compression or expansion to a pressure.",
    snippet: "polytropic(n = ${1:1.3}, P = ${2})",
  },
];

/** Properties of a state, by the short name a script uses. */
export const PROPERTIES: (Doc & { input: boolean; field: string })[] = [
  {
    name: "T",
    detail: "temperature",
    info: "Temperature",
    input: true,
    field: "temperature",
  },
  {
    name: "P",
    detail: "pressure",
    info: "Pressure",
    input: true,
    field: "pressure",
  },
  {
    name: "h",
    detail: "enthalpy",
    info: "Specific enthalpy",
    input: true,
    field: "enthalpy",
  },
  {
    name: "s",
    detail: "entropy",
    info: "Specific entropy",
    input: true,
    field: "entropy",
  },
  {
    name: "x",
    detail: "quality",
    info: "Vapor quality, 0–1 (two-phase only)",
    input: true,
    field: "quality",
  },
  {
    name: "D",
    detail: "density",
    info: "Density (also rho)",
    input: true,
    field: "density",
  },
  {
    name: "v",
    detail: "specific volume",
    info: "Specific volume, 1/D",
    input: true,
    field: "specific_volume",
  },
  {
    name: "u",
    detail: "internal energy",
    info: "Specific internal energy",
    input: true,
    field: "internal_energy",
  },
  {
    name: "cp",
    detail: "cp",
    info: "Isobaric specific heat",
    input: false,
    field: "cp",
  },
  {
    name: "cv",
    detail: "cv",
    info: "Isochoric specific heat",
    input: false,
    field: "cv",
  },
  {
    name: "mu",
    detail: "viscosity",
    info: "Dynamic viscosity",
    input: false,
    field: "viscosity",
  },
  {
    name: "k",
    detail: "conductivity",
    info: "Thermal conductivity",
    input: false,
    field: "conductivity",
  },
  {
    name: "Pr",
    detail: "Prandtl",
    info: "Prandtl number",
    input: false,
    field: "prandtl",
  },
  {
    name: "Z",
    detail: "compressibility",
    info: "Compressibility factor",
    input: false,
    field: "compressibility",
  },
  {
    name: "a",
    detail: "speed of sound",
    info: "Speed of sound",
    input: false,
    field: "speed_of_sound",
  },
  {
    name: "g",
    detail: "Gibbs energy",
    info: "Specific Gibbs energy",
    input: false,
    field: "gibbs",
  },
];

export const FUNCTIONS: (Doc & { snippet: string })[] = [
  { name: "sqrt", detail: "√x", info: "Square root.", snippet: "sqrt(${1})" },
  { name: "abs", detail: "|x|", info: "Absolute value.", snippet: "abs(${1})" },
  {
    name: "min",
    detail: "min(a, b, …)",
    info: "Smallest of values of one dimension.",
    snippet: "min(${1}, ${2})",
  },
  {
    name: "max",
    detail: "max(a, b, …)",
    info: "Largest of values of one dimension.",
    snippet: "max(${1}, ${2})",
  },
  {
    name: "ln",
    detail: "natural log",
    info: "Natural logarithm of a dimensionless value.",
    snippet: "ln(${1})",
  },
  {
    name: "log10",
    detail: "log₁₀",
    info: "Decimal logarithm of a dimensionless value.",
    snippet: "log10(${1})",
  },
  {
    name: "exp",
    detail: "eˣ",
    info: "Exponential of a dimensionless value.",
    snippet: "exp(${1})",
  },
];

/** Units offered after a number, most used first. */
export const COMMON_UNITS: { name: string; detail: string }[] = [
  { name: "°C", detail: "temperature" },
  { name: "K", detail: "temperature" },
  { name: "°F", detail: "temperature" },
  { name: "kPa", detail: "pressure" },
  { name: "MPa", detail: "pressure" },
  { name: "bar", detail: "pressure" },
  { name: "atm", detail: "pressure" },
  { name: "psi", detail: "pressure" },
  { name: "Pa", detail: "pressure" },
  { name: "kJ/kg", detail: "specific energy" },
  { name: "J/kg", detail: "specific energy" },
  { name: "BTU/lb", detail: "specific energy" },
  { name: "kJ/(kg*K)", detail: "specific entropy" },
  { name: "kg/m^3", detail: "density" },
  { name: "m^3/kg", detail: "specific volume" },
  { name: "kg/s", detail: "mass flow" },
  { name: "kg/h", detail: "mass flow" },
  { name: "kW", detail: "power" },
  { name: "MW", detail: "power" },
  { name: "W", detail: "power" },
  { name: "kJ", detail: "energy" },
  { name: "m/s", detail: "speed" },
  { name: "%", detail: "fraction" },
];
