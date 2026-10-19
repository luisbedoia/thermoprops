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
    name: "Refrigeration cycle",
    diagram: "pressure_enthalpy",
    source: `# Vapor-compression refrigeration cycle
fluid R134a
units celsius
# h and s as in the textbooks' refrigerant tables
reference ASHRAE

# evaporator outlet
1: T = -10 °C, sat vapor
# compressor
2: from 1, compressed to P = 1.2 MPa, eta = 80%
# condenser outlet
3: P = P2, sat liquid
# expansion valve
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
    name: "Rankine cycle",
    diagram: "temperature_entropy",
    source: `# Rankine cycle with a real turbine
fluid Water
units celsius

# condenser outlet
1: P = 10 kPa, sat liquid
# pump
2: from 1, isentropic to P = 8 MPa
# boiler outlet
3: P = P2, T = 480 °C
# turbine
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
    name: "Regenerative Rankine",
    diagram: "temperature_entropy",
    source: `# Rankine cycle with an open feedwater heater
fluid Water
units celsius

# condenser outlet
1: P = 10 kPa, sat liquid
# pump I
2: from 1, isentropic to P = 1.2 MPa
# feedwater heater outlet
3: P = 1.2 MPa, sat liquid
# pump II
4: from 3, isentropic to P = 15 MPa
# boiler outlet
5: P = 15 MPa, T = 600 °C
# turbine: bled at 1.2 MPa, the rest to the condenser
6: from 5, isentropic to P = 1.2 MPa
7: from 5, isentropic to P = 10 kPa

# fraction bled to the heater, from its energy balance
y = (h3 - h2) / (h6 - h2)
q_in = h5 - h4
q_out = (1 - y) * (h7 - h1)
efficiency = 1 - q_out / q_in

draw 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 1
# the steam bled to the heater
draw 6 -> 3
print y, efficiency in %
`,
  },
  {
    id: "brayton",
    name: "Brayton cycle",
    diagram: "temperature_entropy",
    source: `# Gas turbine (Brayton) cycle
fluid Air
units kelvin

# compressor inlet
1: T = 300 K, P = 100 kPa
# compressor
2: from 1, compressed to P = 1 MPa, eta = 85%
# combustor
3: from 2, isobaric to T = 1400 K
# turbine
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
    name: "Combined gas-steam cycle",
    diagram: "temperature_entropy",
    source: `# Combined gas-steam cycle: the gas turbine's exhaust runs the steam cycle
fluid Water
units celsius

# gas cycle (air)
1 [Air]: T = 27 °C, P = 100 kPa
2: from 1, compressed to P = 800 kPa, eta = 80%
3: from 2, isobaric to T = 1027 °C
4: from 3, expanded to P = P1, eta = 85%
# stack: the exhaust leaves the heat recovery boiler
5 [Air]: T = 177 °C, P = P1

# steam cycle (water)
6: P = 8 kPa, sat liquid
7: from 6, isentropic to P = 8 MPa
8: P = P7, T = 400 °C
9: from 8, expanded to P = P6, eta = 85%

# kg of steam per kg of gas, from the boiler's energy balance
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
    name: "Blank worksheet",
    diagram: "pressure_enthalpy",
    source: `fluid Water
units celsius

1: T = 25 °C, P = 1 bar
print h1
`,
  },
];
