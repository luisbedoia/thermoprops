import { tr } from "../i18n";

/** Example scripts, each with the diagram that shows it best. */
export type Template = {
  id: string;
  name: string;
  diagram: string;
  source: string;
};

export const TEMPLATES: Template[] = [
  {
    id: "refrigeration",
    name: tr("Refrigeration cycle", "Ciclo de refrigeración"),
    diagram: "pressure_enthalpy",
    source: `${tr("# Vapor-compression refrigeration cycle", "# Ciclo de refrigeración por compresión de vapor")}
fluid R134a
units celsius
${tr("# h and s as in the textbooks' refrigerant tables", "# h y s como en las tablas de refrigerantes de los textos")}
reference ASHRAE

${tr("# evaporator outlet", "# salida del evaporador")}
1: T = -10 °C, sat vapor
${tr("# compressor", "# compresor")}
2: from 1, compressed to P = 1.2 MPa, eta = 80%
${tr("# condenser outlet", "# salida del condensador")}
3: P = P2, sat liquid
${tr("# expansion valve", "# válvula de expansión")}
4: from 3, throttled to P = P1

m = 0.05 kg/s
q_evap = h1 - h4
w_comp = h2 - h1
COP = q_evap / w_comp
Q_evap = m * q_evap

draw 1 -> 2 -> 3 -> 4 -> 1
print COP, Q_evap, T2
`,
  },
  {
    id: "rankine",
    name: tr("Rankine cycle", "Ciclo Rankine"),
    diagram: "temperature_entropy",
    source: `${tr("# Rankine cycle with a real turbine", "# Ciclo Rankine con turbina real")}
fluid Water
units celsius

${tr("# condenser outlet", "# salida del condensador")}
1: P = 10 kPa, sat liquid
${tr("# pump", "# bomba")}
2: from 1, isentropic to P = 8 MPa
${tr("# boiler outlet", "# salida de la caldera")}
3: P = P2, T = 480 °C
${tr("# turbine", "# turbina")}
4: from 3, expanded to P = P1, eta = 85%

w_pump = h2 - h1
w_turb = h3 - h4
q_in = h3 - h2
efficiency = (w_turb - w_pump) / q_in

draw 1 -> 2 -> 3 -> 4 -> 1
print efficiency in %, w_turb - w_pump, x4
`,
  },
  {
    id: "regenerative",
    name: tr("Regenerative Rankine", "Rankine regenerativo"),
    diagram: "temperature_entropy",
    source: `${tr("# Rankine cycle with an open feedwater heater", "# Ciclo Rankine con calentador abierto de agua de alimentación")}
fluid Water
units celsius

${tr("# condenser outlet", "# salida del condensador")}
1: P = 10 kPa, sat liquid
${tr("# pump I", "# bomba I")}
2: from 1, isentropic to P = 1.2 MPa
${tr("# feedwater heater outlet", "# salida del calentador de agua de alimentación")}
3: P = 1.2 MPa, sat liquid
${tr("# pump II", "# bomba II")}
4: from 3, isentropic to P = 15 MPa
${tr("# boiler outlet", "# salida de la caldera")}
5: P = 15 MPa, T = 600 °C
${tr("# turbine: bled at 1.2 MPa, the rest to the condenser", "# turbina: extracción a 1.2 MPa, el resto al condensador")}
6: from 5, isentropic to P = 1.2 MPa
7: from 5, isentropic to P = 10 kPa

${tr("# fraction bled to the heater, from its energy balance", "# fracción extraída al calentador, de su balance de energía")}
y = (h3 - h2) / (h6 - h2)
q_in = h5 - h4
q_out = (1 - y) * (h7 - h1)
efficiency = 1 - q_out / q_in

draw 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 1
${tr("# the steam bled to the heater", "# el vapor extraído al calentador")}
draw 6 -> 3
print y, efficiency in %
`,
  },
  {
    id: "brayton",
    name: tr("Brayton cycle", "Ciclo Brayton"),
    diagram: "temperature_entropy",
    source: `${tr("# Gas turbine (Brayton) cycle", "# Ciclo de turbina de gas (Brayton)")}
fluid Air
units kelvin

${tr("# compressor inlet", "# entrada del compresor")}
1: T = 300 K, P = 100 kPa
${tr("# compressor", "# compresor")}
2: from 1, compressed to P = 1 MPa, eta = 85%
${tr("# combustor", "# cámara de combustión")}
3: from 2, isobaric to T = 1400 K
${tr("# turbine", "# turbina")}
4: from 3, expanded to P = P1, eta = 88%

w_comp = h2 - h1
w_turb = h3 - h4
efficiency = (w_turb - w_comp) / (h3 - h2)
back_work = w_comp / w_turb

draw 1 -> 2 -> 3 -> 4 -> 1
print efficiency, w_turb - w_comp, back_work
`,
  },
  {
    id: "combined",
    name: tr("Combined gas-steam cycle", "Ciclo combinado gas-vapor"),
    diagram: "temperature_entropy",
    source: `${tr("# Combined gas-steam cycle: the gas turbine's exhaust runs the steam cycle", "# Ciclo combinado gas-vapor: los gases de escape de la turbina de gas mueven el ciclo de vapor")}
fluid Water
units celsius

${tr("# gas cycle (air)", "# ciclo de gas (aire)")}
1 [Air]: T = 27 °C, P = 100 kPa
2: from 1, compressed to P = 800 kPa, eta = 80%
3: from 2, isobaric to T = 1027 °C
4: from 3, expanded to P = P1, eta = 85%
${tr("# stack: the exhaust leaves the heat recovery boiler", "# chimenea: los gases salen de la caldera de recuperación")}
5 [Air]: T = 177 °C, P = P1

${tr("# steam cycle (water)", "# ciclo de vapor (agua)")}
6: P = 8 kPa, sat liquid
7: from 6, isentropic to P = 8 MPa
8: P = P7, T = 400 °C
9: from 8, expanded to P = P6, eta = 85%

${tr("# kg of steam per kg of gas, from the boiler's energy balance", "# kg de vapor por kg de gas, del balance de energía de la caldera")}
y = (h4 - h5) / (h8 - h7)
w_gas = (h3 - h4) - (h2 - h1)
w_steam = y * ((h8 - h9) - (h7 - h6))
efficiency = (w_gas + w_steam) / (h3 - h2)

draw 1 -> 2 -> 3 -> 4 -> 1
draw 6 -> 7 -> 8 -> 9 -> 6
print y, w_gas, w_steam, efficiency in %
`,
  },
  {
    id: "blank",
    name: tr("Blank worksheet", "Hoja en blanco"),
    diagram: "pressure_enthalpy",
    source: `fluid Water
units celsius

1: T = 25 °C, P = 1 bar
print h1
`,
  },
];
