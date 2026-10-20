/**
 * What the script language knows, documented for the editor: completions,
 * hover cards and the reference. The evaluator's tables (evaluate.ts) must
 * name the same things; a test keeps them in step.
 */

import { tr } from "../i18n";

export type Doc = { name: string; detail: string; info: string };

export const KEYWORDS: (Doc & { snippet: string })[] = [
  {
    name: "state",
    detail: tr("two properties", "dos propiedades"),
    info: tr(
      "A state fixed by two properties: 1: T = 25 °C, P = 1 bar.",
      "Un estado fijado por dos propiedades: 1: T = 25 °C, P = 1 bar.",
    ),
    snippet: "${1:1}: ${2:T} = ${3}, ${4:P} = ${5}",
  },
  {
    name: "state",
    detail: tr("by a process", "por un proceso"),
    info: tr(
      "A state reached from another: 2: from 1, isentropic to P = 1 MPa.",
      "Un estado alcanzado desde otro: 2: from 1, isentropic to P = 1 MPa.",
    ),
    snippet: "${1:2}: from ${2:1}, ${3:isentropic} to ${4:P} = ${5}",
  },
  {
    name: "value",
    detail: "name = …",
    info: tr(
      "A value computed from states and other values: COP = q / w.",
      "Un valor calculado a partir de estados y otros valores: COP = q / w.",
    ),
    snippet: "${1:name} = ${2}",
  },
  {
    name: "fluid",
    detail: tr("default fluid", "fluido por defecto"),
    info: tr(
      "The fluid of every state that does not name another.",
      "El fluido de cada estado que no nombra otro.",
    ),
    snippet: "fluid ${1:Water}",
  },
  {
    name: "units",
    detail: tr("unit system", "sistema de unidades"),
    info: tr(
      "How results are shown, and how numbers without a unit are read: celsius, kelvin or imperial.",
      "Cómo se muestran los resultados y cómo se leen los números sin unidad: celsius, kelvin o imperial.",
    ),
    snippet: "units ${1:celsius}",
  },
  {
    name: "reference",
    detail: tr("h and s origin", "origen de h y s"),
    info: tr(
      "Where enthalpy and entropy are measured from: ASHRAE for the textbooks' refrigerant tables, IIR, NBP, or DEF (CoolProp's default).",
      "Desde dónde se miden la entalpía y la entropía: ASHRAE para las tablas de refrigerantes de los textos, IIR, NBP o DEF (el predeterminado de CoolProp).",
    ),
    snippet: "reference ${1:ASHRAE}",
  },
  {
    name: "draw",
    detail: tr("on the chart", "en el diagrama"),
    info: tr(
      "Draws the processes between consecutive states on the chart, with arrows for their direction: draw 1 -> 2 -> 3 -> 1. Only the chart: no value changes.",
      "Dibuja en el diagrama los procesos entre estados consecutivos, con flechas que indican su sentido: draw 1 -> 2 -> 3 -> 1. Solo el diagrama: ningún valor cambia.",
    ),
    snippet: "draw ${1:1} -> ${2:2} -> ${3:1}",
  },
  {
    name: "print",
    detail: tr("outputs", "salidas"),
    info: tr(
      "Shows values as results; `in` picks the unit: print T2 in °F.",
      "Muestra valores como resultados; `in` elige la unidad: print T2 in °F.",
    ),
    snippet: "print ${1}",
  },
];

/** Words that start a statement; others start a state or a value. */
export { STATEMENTS as STATEMENT_KEYWORDS } from "./parser";

/** Words inside a state's definition and a print. */
export const CLAUSE_WORDS: Doc[] = [
  {
    name: "from",
    detail: tr("starting state", "estado inicial"),
    info: tr(
      "The state a process starts from: 2: from 1, isentropic to P = 1 MPa.",
      "El estado del que parte un proceso: 2: from 1, isentropic to P = 1 MPa.",
    ),
  },
  {
    name: "to",
    detail: tr("target", "destino"),
    info: tr(
      "The property a process goes to: isobaric to T = 400 °C.",
      "La propiedad a la que llega un proceso: isobaric to T = 400 °C.",
    ),
  },
  {
    name: "sat",
    detail: tr("saturated", "saturado"),
    info: tr(
      "sat liquid (x = 0) or sat vapor (x = 1); also saturated liquid, saturated vapor.",
      "sat liquid (x = 0) o sat vapor (x = 1); también saturated liquid, saturated vapor.",
    ),
  },
  {
    name: "in",
    detail: tr("unit", "unidad"),
    info: tr(
      "The unit a print shows a value in: print T2 in °F, W in hp.",
      "La unidad en que print muestra un valor: print T2 in °F, W in hp.",
    ),
  },
];

/** Reference states: where enthalpy and entropy are measured from. */
export const REFERENCE_STATES: Doc[] = [
  {
    name: "ASHRAE",
    detail: tr("h = s = 0 · liquid at −40 °C", "h = s = 0 · líquido a −40 °C"),
    info: tr(
      "The textbooks' refrigerant tables (Çengel, Moran).",
      "Las tablas de refrigerantes de los textos (Çengel, Moran).",
    ),
  },
  {
    name: "IIR",
    detail: tr(
      "h = 200, s = 1 · liquid at 0 °C",
      "h = 200, s = 1 · líquido a 0 °C",
    ),
    info: tr(
      "kJ/kg and kJ/(kg·K), for the saturated liquid at 0 °C.",
      "kJ/kg y kJ/(kg·K), para el líquido saturado a 0 °C.",
    ),
  },
  {
    name: "NBP",
    detail: tr("h = s = 0 · liquid at 1 atm", "h = s = 0 · líquido a 1 atm"),
    info: tr(
      "For the saturated liquid at the normal boiling point.",
      "Para el líquido saturado en el punto de ebullición normal.",
    ),
  },
  {
    name: "DEF",
    detail: tr("CoolProp's default", "predeterminado de CoolProp"),
    info: tr(
      "Each fluid's own; for water, the steam tables' (u = s = 0 for the liquid at the triple point).",
      "El de cada fluido; para el agua, el de las tablas de vapor (u = s = 0 para el líquido en el punto triple).",
    ),
  },
];

export const UNIT_SYSTEMS: Doc[] = [
  {
    name: "celsius",
    detail: "°C · kPa · kJ/kg",
    info: tr(
      "SI with degrees Celsius and kilo-units.",
      "SI con grados Celsius y kilounidades.",
    ),
  },
  {
    name: "kelvin",
    detail: "K · kPa · kJ/kg",
    info: tr("SI with kelvin and kilo-units.", "SI con kelvin y kilounidades."),
  },
  {
    name: "imperial",
    detail: "°F · psi · BTU/lb",
    info: tr("US customary units.", "Unidades usuales de EE. UU."),
  },
];

/** Processes, as a state's definition names them. */
export const PROCESSES: (Doc & { snippet: string })[] = [
  {
    name: "isentropic",
    detail: "s = const",
    info: tr(
      "Ideal compression or expansion: keeps the entropy.",
      "Compresión o expansión ideal: conserva la entropía.",
    ),
    snippet: "isentropic to ${1:P} = ${2}",
  },
  {
    name: "compressed",
    detail: tr("real compressor", "compresor real"),
    info: tr(
      "h₂ = h₁ + (h₂ₛ − h₁)/η, with 2s the isentropic outlet. Needs eta.",
      "h₂ = h₁ + (h₂ₛ − h₁)/η, con 2s la salida isentrópica. Requiere eta.",
    ),
    snippet: "compressed to P = ${1}, eta = ${2:80%}",
  },
  {
    name: "expanded",
    detail: tr("real turbine", "turbina real"),
    info: tr(
      "h₂ = h₁ − η·(h₁ − h₂ₛ), with 2s the isentropic outlet. Needs eta.",
      "h₂ = h₁ − η·(h₁ − h₂ₛ), con 2s la salida isentrópica. Requiere eta.",
    ),
    snippet: "expanded to P = ${1}, eta = ${2:85%}",
  },
  {
    name: "throttled",
    detail: "h = const",
    info: tr(
      "Expansion valve: keeps the enthalpy.",
      "Válvula de expansión: conserva la entalpía.",
    ),
    snippet: "throttled to P = ${1}",
  },
  {
    name: "isobaric",
    detail: "P = const",
    info: tr(
      "Heating or cooling at constant pressure.",
      "Calentamiento o enfriamiento a presión constante.",
    ),
    snippet: "isobaric to ${1:T} = ${2}",
  },
  {
    name: "isothermal",
    detail: "T = const",
    info: tr("Keeps the temperature.", "Conserva la temperatura."),
    snippet: "isothermal to ${1:P} = ${2}",
  },
  {
    name: "isochoric",
    detail: "v = const",
    info: tr(
      "Keeps the specific volume (rigid tank).",
      "Conserva el volumen específico (tanque rígido).",
    ),
    snippet: "isochoric to ${1:T} = ${2}",
  },
  {
    name: "isenthalpic",
    detail: "h = const",
    info: tr("Keeps the enthalpy.", "Conserva la entalpía."),
    snippet: "isenthalpic to ${1:P} = ${2}",
  },
  {
    name: "polytropic",
    detail: "P·vⁿ = const",
    info: tr(
      "Polytropic compression or expansion to a pressure. Needs n.",
      "Compresión o expansión politrópica hasta una presión. Requiere n.",
    ),
    snippet: "polytropic to P = ${1}, n = ${2:1.3}",
  },
];

/** Properties of a state, by the short name a script uses. */
export const PROPERTIES: (Doc & { input: boolean; field: string })[] = [
  {
    name: "T",
    detail: tr("temperature", "temperatura"),
    info: tr("Temperature", "Temperatura"),
    input: true,
    field: "temperature",
  },
  {
    name: "P",
    detail: tr("pressure", "presión"),
    info: tr("Pressure", "Presión"),
    input: true,
    field: "pressure",
  },
  {
    name: "h",
    detail: tr("enthalpy", "entalpía"),
    info: tr("Specific enthalpy", "Entalpía específica"),
    input: true,
    field: "enthalpy",
  },
  {
    name: "s",
    detail: tr("entropy", "entropía"),
    info: tr("Specific entropy", "Entropía específica"),
    input: true,
    field: "entropy",
  },
  {
    name: "x",
    detail: tr("quality", "calidad"),
    info: tr(
      "Vapor quality, 0–1 (two-phase only)",
      "Calidad del vapor, 0–1 (solo bifásico)",
    ),
    input: true,
    field: "quality",
  },
  {
    name: "D",
    detail: tr("density", "densidad"),
    info: tr("Density (also rho)", "Densidad (también rho)"),
    input: true,
    field: "density",
  },
  {
    name: "v",
    detail: tr("specific volume", "volumen específico"),
    info: tr("Specific volume, 1/D", "Volumen específico, 1/D"),
    input: true,
    field: "specific_volume",
  },
  {
    name: "u",
    detail: tr("internal energy", "energía interna"),
    info: tr("Specific internal energy", "Energía interna específica"),
    input: true,
    field: "internal_energy",
  },
  {
    name: "cp",
    detail: "cp",
    info: tr("Isobaric specific heat", "Calor específico isobárico"),
    input: false,
    field: "cp",
  },
  {
    name: "cv",
    detail: "cv",
    info: tr("Isochoric specific heat", "Calor específico isocórico"),
    input: false,
    field: "cv",
  },
  {
    name: "mu",
    detail: tr("viscosity", "viscosidad"),
    info: tr("Dynamic viscosity", "Viscosidad dinámica"),
    input: false,
    field: "viscosity",
  },
  {
    name: "k",
    detail: tr("conductivity", "conductividad"),
    info: tr("Thermal conductivity", "Conductividad térmica"),
    input: false,
    field: "conductivity",
  },
  {
    name: "Pr",
    detail: "Prandtl",
    info: tr("Prandtl number", "Número de Prandtl"),
    input: false,
    field: "prandtl",
  },
  {
    name: "Z",
    detail: tr("compressibility", "compresibilidad"),
    info: tr("Compressibility factor", "Factor de compresibilidad"),
    input: false,
    field: "compressibility",
  },
  {
    name: "a",
    detail: tr("speed of sound", "velocidad del sonido"),
    info: tr("Speed of sound", "Velocidad del sonido"),
    input: false,
    field: "speed_of_sound",
  },
  {
    name: "g",
    detail: tr("Gibbs energy", "energía de Gibbs"),
    info: tr("Specific Gibbs energy", "Energía de Gibbs específica"),
    input: false,
    field: "gibbs",
  },
];

/** Functions, each with the use it has in cycle problems. */
export const FUNCTIONS: (Doc & { snippet: string; example: string })[] = [
  {
    name: "sqrt",
    detail: "√x",
    info: tr(
      "Square root: a nozzle's exit velocity.",
      "Raíz cuadrada: la velocidad de salida de una tobera.",
    ),
    example: "V2 = sqrt(2 * (h1 - h2))",
    snippet: "sqrt(${1})",
  },
  {
    name: "ln",
    detail: tr("natural log", "logaritmo natural"),
    info: tr(
      "Of a dimensionless value: an ideal gas's isothermal work.",
      "De un valor adimensional: el trabajo isotérmico de un gas ideal.",
    ),
    example: "w = R * T1 * ln(P1 / P2)",
    snippet: "ln(${1})",
  },
  {
    name: "exp",
    detail: "eˣ",
    info: tr(
      "Of a dimensionless value: a heat exchanger's effectiveness.",
      "De un valor adimensional: la efectividad de un intercambiador de calor.",
    ),
    example: "eps = 1 - exp(-NTU)",
    snippet: "exp(${1})",
  },
  {
    name: "abs",
    detail: "|x|",
    info: tr(
      "Absolute value: a heat as a positive amount.",
      "Valor absoluto: un calor como cantidad positiva.",
    ),
    example: "q_out = abs(h4 - h1)",
    snippet: "abs(${1})",
  },
  {
    name: "min",
    detail: "min(a, b, …)",
    info: tr(
      "Smallest of values of one dimension.",
      "El menor de valores de una misma dimensión.",
    ),
    example: "C_min = min(C_hot, C_cold)",
    snippet: "min(${1}, ${2})",
  },
  {
    name: "max",
    detail: "max(a, b, …)",
    info: tr(
      "Largest of values of one dimension.",
      "El mayor de valores de una misma dimensión.",
    ),
    example: "T_max = max(T3, T4)",
    snippet: "max(${1}, ${2})",
  },
];

/** Units offered after a number, most used first. */
export const COMMON_UNITS: { name: string; detail: string }[] = [
  { name: "°C", detail: tr("temperature", "temperatura") },
  { name: "K", detail: tr("temperature", "temperatura") },
  { name: "°F", detail: tr("temperature", "temperatura") },
  { name: "kPa", detail: tr("pressure", "presión") },
  { name: "MPa", detail: tr("pressure", "presión") },
  { name: "bar", detail: tr("pressure", "presión") },
  { name: "atm", detail: tr("pressure", "presión") },
  { name: "psi", detail: tr("pressure", "presión") },
  { name: "Pa", detail: tr("pressure", "presión") },
  { name: "kJ/kg", detail: tr("specific energy", "energía específica") },
  { name: "J/kg", detail: tr("specific energy", "energía específica") },
  { name: "BTU/lb", detail: tr("specific energy", "energía específica") },
  { name: "kJ/(kg*K)", detail: tr("specific entropy", "entropía específica") },
  { name: "kg/m^3", detail: tr("density", "densidad") },
  { name: "m^3/kg", detail: tr("specific volume", "volumen específico") },
  { name: "kg/s", detail: tr("mass flow", "flujo másico") },
  { name: "kg/h", detail: tr("mass flow", "flujo másico") },
  { name: "kW", detail: tr("power", "potencia") },
  { name: "MW", detail: tr("power", "potencia") },
  { name: "W", detail: tr("power", "potencia") },
  { name: "kJ", detail: tr("energy", "energía") },
  { name: "m/s", detail: tr("speed", "velocidad") },
  { name: "%", detail: tr("fraction", "fracción") },
  { name: "kW/K", detail: tr("conductance (UA)", "conductancia (UA)") },
  {
    name: "W/(m^2*K)",
    detail: tr(
      "heat transfer coefficient",
      "coeficiente de transferencia de calor",
    ),
  },
  { name: "m^2", detail: tr("area", "área") },
  { name: "m^3", detail: tr("volume", "volumen") },
  { name: "m", detail: tr("length", "longitud") },
  { name: "hp", detail: tr("power", "potencia") },
  { name: "BTU/h", detail: tr("power", "potencia") },
  { name: "BTU/lbm", detail: tr("specific energy", "energía específica") },
  { name: "lbm/s", detail: tr("mass flow", "flujo másico") },
  { name: "ft/s", detail: tr("speed", "velocidad") },
  { name: "°R", detail: tr("temperature", "temperatura") },
];
