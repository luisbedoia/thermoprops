/** The link format's page's facts (LinksPage.tsx), apart for its tests. */

export const SITE = "https://luisbedoia.github.io/thermoprops";

/**
 * The fluids a script can name, by CoolProp's names. A test keeps them in
 * step with the catalog.
 */
export const FLUID_NAMES = [
  "Air",
  "Ammonia",
  "Argon",
  "CarbonDioxide",
  "CarbonMonoxide",
  "Ethanol",
  "Helium",
  "Hydrogen",
  "IsoButane",
  "Isopentane",
  "Methane",
  "n-Butane",
  "n-Pentane",
  "n-Propane",
  "Nitrogen",
  "Oxygen",
  "R1234yf",
  "R1234ze(E)",
  "R125",
  "R134a",
  "R143a",
  "R152A",
  "R22",
  "R245fa",
  "R32",
  "R404A",
  "R410A",
  "R507A",
  "Toluene",
  "Water",
];

/** The Worksheet's address with `source` in it: opened, it is solved. */
export const worksheetLink = (source: string) =>
  `${SITE}/worksheet/?s=${encodeURIComponent(source)}`;

/** Each kind of statement: an example, and what it does. */
export const SYNTAX: [string, string, string][] = [
  [
    "fluid R134a",
    "The fluid of every state.",
    "El fluido de todos los estados.",
  ],
  [
    "units celsius",
    "How results are shown and bare numbers read: celsius (°C, kPa, kJ/kg), kelvin or imperial.",
    "Cómo se muestran los resultados y se leen los números sin unidad: celsius (°C, kPa, kJ/kg), kelvin o imperial.",
  ],
  [
    "reference ASHRAE",
    "Where h and s are measured from: ASHRAE as in the textbooks' refrigerant tables, IIR, NBP or DEF (CoolProp's default).",
    "Desde dónde se miden h y s: ASHRAE como en las tablas de refrigerantes de los textos, IIR, NBP o DEF (el de CoolProp).",
  ],
  [
    "1: T = 25 °C, P = 1 bar",
    "A state fixed by two properties.",
    "Un estado fijado por dos propiedades.",
  ],
  [
    "1: T = -10 °C, sat vapor",
    "A saturated state: sat liquid (x = 0) or sat vapor (x = 1).",
    "Un estado saturado: sat liquid (x = 0) o sat vapor (x = 1).",
  ],
  [
    "2: from 1, compressed to P = 1.2 MPa, eta = 80%",
    "A state reached from another by a process.",
    "Un estado alcanzado desde otro por un proceso.",
  ],
  [
    "3: P = P2, sat liquid",
    "A property of another state, by name.",
    "Una propiedad de otro estado, por su nombre.",
  ],
  [
    "COP = (h1 - h4) / (h2 - h1)",
    "A value computed from states and other values: + - * / ^, sqrt, ln, exp, abs, min, max.",
    "Un valor calculado a partir de estados y otros valores: + - * / ^, sqrt, ln, exp, abs, min, max.",
  ],
  [
    "print COP, T2 in °F",
    "The results to show; in picks the unit.",
    "Los resultados a mostrar; in elige la unidad.",
  ],
  [
    "draw 1 -> 2 -> 3 -> 4 -> 1",
    "The processes drawn on the chart.",
    "Los procesos que se dibujan en el diagrama.",
  ],
];
