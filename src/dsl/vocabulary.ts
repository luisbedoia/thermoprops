/**
 * What the script language knows, documented for the editor: completions,
 * hover cards and the reference. The evaluator's tables (evaluate.ts) must
 * name the same things; a test keeps them in step.
 */

export type Doc = { name: string; detail: string; info: string };

export const KEYWORDS: (Doc & { snippet: string })[] = [
  {
    name: "state",
    detail: "two properties",
    info: "A state fixed by two properties: 1: T = 25 °C, P = 1 bar.",
    snippet: "${1:1}: ${2:T} = ${3}, ${4:P} = ${5}",
  },
  {
    name: "state",
    detail: "by a process",
    info: "A state reached from another: 2: from 1, isentropic to P = 1 MPa.",
    snippet: "${1:2}: from ${2:1}, ${3:isentropic} to ${4:P} = ${5}",
  },
  {
    name: "value",
    detail: "name = …",
    info: "A value computed from states and other values: COP = q / w.",
    snippet: "${1:name} = ${2}",
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
    name: "reference",
    detail: "h and s origin",
    info: "Where enthalpy and entropy are measured from: ASHRAE for the textbooks' refrigerant tables, IIR, NBP, or DEF (CoolProp's default).",
    snippet: "reference ${1:ASHRAE}",
  },
  {
    name: "draw",
    detail: "on the chart",
    info: "Draws the processes between consecutive states on the chart, with arrows for their direction: draw 1 -> 2 -> 3 -> 1. Only the chart: no value changes.",
    snippet: "draw ${1:1} -> ${2:2} -> ${3:1}",
  },
  {
    name: "print",
    detail: "outputs",
    info: "Shows values as results; `in` picks the unit: print T2 in °F.",
    snippet: "print ${1}",
  },
];

/** Words that start a statement; others start a state or a value. */
export { STATEMENTS as STATEMENT_KEYWORDS } from "./parser";

/** Words inside a state's definition and a print. */
export const CLAUSE_WORDS: Doc[] = [
  {
    name: "from",
    detail: "starting state",
    info: "The state a process starts from: 2: from 1, isentropic to P = 1 MPa.",
  },
  {
    name: "to",
    detail: "target",
    info: "The property a process goes to: isobaric to T = 400 °C.",
  },
  {
    name: "sat",
    detail: "saturated",
    info: "sat liquid (x = 0) or sat vapor (x = 1); also saturated liquid, saturated vapor.",
  },
  {
    name: "in",
    detail: "unit",
    info: "The unit a print shows a value in: print T2 in °F, W in hp.",
  },
];

/** Reference states: where enthalpy and entropy are measured from. */
export const REFERENCE_STATES: Doc[] = [
  {
    name: "ASHRAE",
    detail: "h = s = 0 · liquid at −40 °C",
    info: "The textbooks' refrigerant tables (Çengel, Moran).",
  },
  {
    name: "IIR",
    detail: "h = 200, s = 1 · liquid at 0 °C",
    info: "kJ/kg and kJ/(kg·K), for the saturated liquid at 0 °C.",
  },
  {
    name: "NBP",
    detail: "h = s = 0 · liquid at 1 atm",
    info: "For the saturated liquid at the normal boiling point.",
  },
  {
    name: "DEF",
    detail: "CoolProp's default",
    info: "Each fluid's own; for water, the steam tables' (u = s = 0 for the liquid at the triple point).",
  },
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

/** Processes, as a state's definition names them. */
export const PROCESSES: (Doc & { snippet: string })[] = [
  {
    name: "isentropic",
    detail: "s = const",
    info: "Ideal compression or expansion: keeps the entropy.",
    snippet: "isentropic to ${1:P} = ${2}",
  },
  {
    name: "compressed",
    detail: "real compressor",
    info: "h₂ = h₁ + (h₂ₛ − h₁)/η, with 2s the isentropic outlet. Needs eta.",
    snippet: "compressed to P = ${1}, eta = ${2:80%}",
  },
  {
    name: "expanded",
    detail: "real turbine",
    info: "h₂ = h₁ − η·(h₁ − h₂ₛ), with 2s the isentropic outlet. Needs eta.",
    snippet: "expanded to P = ${1}, eta = ${2:85%}",
  },
  {
    name: "throttled",
    detail: "h = const",
    info: "Expansion valve: keeps the enthalpy.",
    snippet: "throttled to P = ${1}",
  },
  {
    name: "isobaric",
    detail: "P = const",
    info: "Heating or cooling at constant pressure.",
    snippet: "isobaric to ${1:T} = ${2}",
  },
  {
    name: "isothermal",
    detail: "T = const",
    info: "Keeps the temperature.",
    snippet: "isothermal to ${1:P} = ${2}",
  },
  {
    name: "isochoric",
    detail: "v = const",
    info: "Keeps the specific volume (rigid tank).",
    snippet: "isochoric to ${1:T} = ${2}",
  },
  {
    name: "isenthalpic",
    detail: "h = const",
    info: "Keeps the enthalpy.",
    snippet: "isenthalpic to ${1:P} = ${2}",
  },
  {
    name: "polytropic",
    detail: "P·vⁿ = const",
    info: "Polytropic compression or expansion to a pressure. Needs n.",
    snippet: "polytropic to P = ${1}, n = ${2:1.3}",
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

/** Functions, each with the use it has in cycle problems. */
export const FUNCTIONS: (Doc & { snippet: string; example: string })[] = [
  {
    name: "sqrt",
    detail: "√x",
    info: "Square root: a nozzle's exit velocity.",
    example: "V2 = sqrt(2 * (h1 - h2))",
    snippet: "sqrt(${1})",
  },
  {
    name: "ln",
    detail: "natural log",
    info: "Of a dimensionless value: an ideal gas's isothermal work.",
    example: "w = R * T1 * ln(P1 / P2)",
    snippet: "ln(${1})",
  },
  {
    name: "exp",
    detail: "eˣ",
    info: "Of a dimensionless value: a heat exchanger's effectiveness.",
    example: "eps = 1 - exp(-NTU)",
    snippet: "exp(${1})",
  },
  {
    name: "abs",
    detail: "|x|",
    info: "Absolute value: a heat as a positive amount.",
    example: "q_out = abs(h4 - h1)",
    snippet: "abs(${1})",
  },
  {
    name: "min",
    detail: "min(a, b, …)",
    info: "Smallest of values of one dimension.",
    example: "C_min = min(C_hot, C_cold)",
    snippet: "min(${1}, ${2})",
  },
  {
    name: "max",
    detail: "max(a, b, …)",
    info: "Largest of values of one dimension.",
    example: "T_max = max(T3, T4)",
    snippet: "max(${1}, ${2})",
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
  { name: "kW/K", detail: "conductance (UA)" },
  { name: "W/(m^2*K)", detail: "heat transfer coefficient" },
  { name: "m^2", detail: "area" },
  { name: "m^3", detail: "volume" },
  { name: "m", detail: "length" },
  { name: "hp", detail: "power" },
  { name: "BTU/h", detail: "power" },
  { name: "BTU/lbm", detail: "specific energy" },
  { name: "lbm/s", detail: "mass flow" },
  { name: "ft/s", detail: "speed" },
  { name: "°R", detail: "temperature" },
];
