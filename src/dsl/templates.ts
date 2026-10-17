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

# evaporator outlet
state 1: T = -10 °C, x = 1
# compressor
state 2 = 1 -> compress(P = 1.2 MPa, eta = 0.8)
# condenser outlet
state 3: P = 2.P, x = 0
# expansion valve
state 4 = 3 -> throttle(P = 1.P)

let m_dot = 0.05 kg/s
let q_evap = 1.h - 4.h
let w_comp = 2.h - 1.h
let COP = q_evap / w_comp
let Q_evap = m_dot * q_evap

cycle 1 -> 2 -> 3 -> 4 -> 1
print COP, Q_evap, 2.T
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
state 1: P = 10 kPa, x = 0
# pump
state 2 = 1 -> isentropic(P = 8 MPa)
# boiler outlet
state 3: P = 2.P, T = 480 °C
# turbine
state 4 = 3 -> expand(P = 1.P, eta = 0.85)

let w_pump = 2.h - 1.h
let w_turb = 3.h - 4.h
let q_in = 3.h - 2.h
let efficiency = (w_turb - w_pump) / q_in

cycle 1 -> 2 -> 3 -> 4 -> 1
print efficiency, w_turb - w_pump, 4.x
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
state 1: T = 300 K, P = 100 kPa
# compressor
state 2 = 1 -> compress(P = 1 MPa, eta = 0.85)
# combustor
state 3 = 2 -> isobaric(T = 1400 K)
# turbine
state 4 = 3 -> expand(P = 1.P, eta = 0.88)

let w_comp = 2.h - 1.h
let w_turb = 3.h - 4.h
let efficiency = (w_turb - w_comp) / (3.h - 2.h)
let back_work = w_comp / w_turb

cycle 1 -> 2 -> 3 -> 4 -> 1
print efficiency, w_turb - w_comp, back_work
`,
  },
  {
    id: "blank",
    name: "Blank script",
    diagram: "pressure_enthalpy",
    source: `fluid Water
units celsius

state 1: T = 25 °C, P = 1 bar
print 1.h
`,
  },
];
