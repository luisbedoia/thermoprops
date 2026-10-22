/**
 * Metamorphic tests: no expected numbers, only relations that must hold
 * between runs. A script means the same in any unit system and line order;
 * what the app shows reads back as itself; equivalent expressions and state
 * definitions agree; every unit converts to every other and back.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { CoolProp } from "@luisbedoia/coolprop-rs-wasm";
import { loadRealCoolProp } from "../../test-fixtures/realCoolProp";
import { evaluate, type ScriptResult } from "../evaluate";
import { formatQuantity } from "../format";
import { TEMPLATES } from "../templates";
import {
  convertTo,
  dimEq,
  displayKind,
  isAbsolute,
  isDifference,
  literal,
  UNITS,
  unitAt,
  type Quantity,
} from "../units";
import type { UnitSystem } from "../../lib/units";

let cp: CoolProp;

beforeAll(async () => {
  cp = await loadRealCoolProp();
});

const SYSTEMS: UnitSystem[] = ["celsius", "kelvin", "imperial"];
const STATE_FIELDS = [
  "temperature",
  "pressure",
  "enthalpy",
  "entropy",
  "density",
] as const;

function run(source: string): ScriptResult {
  return evaluate(source, cp);
}

function close(a: number, b: number, rel = 1e-9): boolean {
  return Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b), 1e-9);
}

/** Where two runs disagree: states and values, in SI, by name. */
function differences(a: ScriptResult, b: ScriptResult, rel = 1e-9): string[] {
  const out: string[] = [];
  const statesB = new Map(b.states.map((s) => [s.name, s]));
  for (const s of a.states) {
    const t = statesB.get(s.name);
    if (!s.state || !t?.state) {
      if (!!s.state !== !!t?.state) out.push(`state ${s.name} solved in one`);
      continue;
    }
    for (const f of STATE_FIELDS) {
      if (!close(s.state[f], t.state[f], rel))
        out.push(`${s.name}.${f}: ${s.state[f]} vs ${t.state[f]}`);
    }
  }
  const valuesB = new Map(b.values.map((v) => [v.name, v]));
  for (const v of a.values) {
    const w = valuesB.get(v.name)?.value;
    if (!v.value || !w) {
      if (!!v.value !== !!w) out.push(`value ${v.name} defined in one`);
      continue;
    }
    if (!close(v.value.value, w.value, rel))
      out.push(`${v.name}: ${v.value.value} vs ${w.value}`);
    if (kind(v.value) !== kind(w))
      out.push(`${v.name}: ${kind(v.value)} vs ${kind(w)}`);
  }
  return out;
}

/** How a temperature-like quantity is shown. */
function kind(q: Quantity): string {
  return isAbsolute(q) ? "absolute" : isDifference(q) ? "difference" : "kelvin";
}

function withUnits(source: string, system: UnitSystem): string {
  return /^units \w+$/m.test(source)
    ? source.replace(/^units \w+$/m, `units ${system}`)
    : `units ${system}\n${source}`;
}

/** A shuffle that is the same on every run. */
function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const SETTING = /^(fluid|units|reference)\b/;

describe("a script means the same", () => {
  for (const t of TEMPLATES) {
    it(`in every unit system: ${t.id}`, () => {
      const base = run(t.source);
      expect(base.diagnostics).toEqual([]);
      for (const system of SYSTEMS) {
        const r = run(withUnits(t.source, system));
        expect(r.diagnostics, system).toEqual([]);
        expect(differences(base, r), system).toEqual([]);
      }
    });

    it(`in any line order: ${t.id}`, () => {
      const base = run(t.source);
      const lines = t.source.split("\n");
      const settings = lines.filter((l) => SETTING.test(l));
      const rest = lines.filter((l) => !SETTING.test(l));
      for (const seed of [1, 2, 3, 4, 5]) {
        const r = run([...settings, ...shuffled(rest, seed)].join("\n"));
        expect(r.diagnostics, `seed ${seed}`).toEqual([]);
        expect(differences(base, r), `seed ${seed}`).toEqual([]);
      }
    });
  }
});

/** Every property of every state, as a print line per state. */
const PROPS = ["T", "P", "h", "s", "u", "v", "D", "cp", "cv", "mu", "k", "a"];

describe("what the app shows reads back as itself", () => {
  for (const t of TEMPLATES) {
    for (const system of SYSTEMS) {
      it(`${t.id} in ${system}`, () => {
        const source = withUnits(t.source, system);
        const names = run(source).states.map((s) => s.name);
        const r = run(
          `${source}\n${names
            .map((n) => `print ${PROPS.map((p) => `${n}.${p}`).join(", ")}`)
            .join("\n")}`,
        );
        const shown = [
          ...r.values.map((v) => ({ q: v.value, unit: undefined })),
          ...r.prints.map((p) => ({ q: p.value, unit: p.unit })),
        ].filter(
          (x): x is { q: Quantity; unit: string | undefined } =>
            !!x.q && (x.unit !== undefined || displayKind(x.q.dim) !== null),
        );
        expect(shown.length).toBeGreaterThan(10);
        const bad: string[] = [];
        for (const { q, unit } of shown) {
          const text = formatQuantity(q, system, unit);
          const back = run(
            `units ${system}\nx = ${text}\nprint x${unit ? ` in ${unit}` : ""}`,
          );
          const again = back.prints[0]?.value
            ? formatQuantity(back.prints[0].value, system, unit)
            : back.diagnostics.map((d) => d.message).join("; ");
          if (again !== text) bad.push(`${text} → ${again}`);
        }
        expect(bad).toEqual([]);
      });
    }
  }
});

const TWO_STATES =
  "fluid Water\n1: T = 20 °C, P = 100 kPa\n2: T = 80 °C, P = 500 kPa\nm = 2 kg/s\n";

/** Expressions that must agree, each group against its first. */
const EQUIVALENT: string[][] = [
  [
    "T1 + 10 K",
    "T1 + 10 °C",
    "T1 + 10 ºC",
    "T1 + 10 ℃",
    "T1 + 10 degC",
    "T1 + 18 °F",
    "T1 + 18 °R",
    "T1 + 2*5 °C",
    "10 °C + T1",
    "T1 - (-10 °C)",
    "T1 − −10 °C",
    "T1 - -10 K",
  ],
  [
    "(T1 + T2) / 2",
    "0.5*T1 + 0.5*T2",
    "(T1 + T2) * 0.5",
    "(m*T1 + m*T2) / (2*m)",
    "T1 + (T2 - T1) / 2",
    "50 °C",
    "max(T1, 50 °C)",
  ],
  [
    "T2 - T1",
    "-(T1 - T2)",
    "abs(T1 - T2)",
    "(T2 - 10 °C) - (T1 - 10 °C)",
    "(T2 + 5 K) - (T1 + 5 K)",
    "60 K",
    "108 °R",
  ],
  ["T2 - 30 °C", "T2 - 30 K", "T2 - 54 °F", "50 °C", "122 °F"],
  // A kelvin literal is a temperature too, shown in K.
  ["323.15 K", "581.67 °R", "max(323.15 K, 300 K)", "2 * 161.575 K"],
  ["1 kJ/(kg*K)", "1 kJ/(kg·K)", "1 kJ/kgK", "1000 J/(kg*K)", "1 kJ/(kg×K)"],
  ["2 m^2", "2 m²", "2 m2", "2 m * 1 m * 1"],
  ["100 kPa", "0.1 MPa", "1 bar", "100000 Pa", "P1", "P2 / 5"],
  ["P1 * 2", "2 × P1", "P1 + P1", "2*P1"],
  ["m * (h2 - h1)", "-m * (h1 - h2)", "m*h2 - m*h1"],
];

describe("equivalent expressions agree", () => {
  for (const system of SYSTEMS) {
    it(`in ${system}`, () => {
      const bad: string[] = [];
      for (const group of EQUIVALENT) {
        const shown = group.map((expr) => {
          const r = run(withUnits(`${TWO_STATES}x = ${expr}\nprint x`, system));
          const q = r.prints[0]?.value;
          return q
            ? { q, text: formatQuantity(q, system) }
            : { text: r.diagnostics.map((d) => d.message).join("; ") };
        });
        const [first] = shown;
        group.forEach((expr, i) => {
          const s = shown[i];
          const same =
            s.text === first.text &&
            !!s.q &&
            !!first.q &&
            close(s.q.value, first.q.value, 1e-6);
          if (!same)
            bad.push(`${expr} → ${s.text} (${group[0]} → ${first.text})`);
        });
      }
      expect(bad).toEqual([]);
    });
  }
});

/** State definitions that must reach the same state 2 (or 3). */
const SAME_STATE: { setup: string; defs: string[] }[] = [
  {
    setup: "fluid Water\n",
    defs: [
      "2: T = 50 °C, P = 1 bar",
      "2: P = 1 bar, T = 50 °C",
      "2: T = 323.15 K, P = 100 kPa",
      "2: T = 122 °F, P = 0.1 MPa",
      "2: T = 50 ºC, P = 100000 Pa",
    ],
  },
  {
    setup: "fluid Water\n1: T = 300 °C, P = 1 MPa\n",
    defs: [
      "2: from 1, isentropic to P = 100 kPa",
      "2: P = 100 kPa, s = s1",
      "2: from 1, expanded to P = 100 kPa, eta = 100%",
      "2: from 1, expanded to P = 100 kPa, eta = 1",
    ],
  },
  {
    setup: "fluid R134a\n1: T = -10 °C, sat vapor\n",
    defs: [
      "2: from 1, compressed to P = 1 MPa, eta = 100%",
      "2: from 1, isentropic to P = 1 MPa",
      "2: P = 1 MPa, s = s1",
    ],
  },
  {
    setup: "fluid Water\n1: T = 300 °C, P = 1 MPa\n",
    defs: [
      "2: from 1, isobaric to T = 400 °C",
      "2: T = 400 °C, P = P1",
      "2: T = T1 + 100 K, P = 1 MPa",
    ],
  },
  {
    setup: "fluid R134a\n1: P = 1 MPa, sat liquid\n",
    defs: [
      "2: from 1, throttled to P = 200 kPa",
      "2: from 1, isenthalpic to P = 200 kPa",
      "2: P = 200 kPa, h = h1",
    ],
  },
  {
    setup: "fluid Water\n1: T = 300 °C, P = 1 MPa\n",
    defs: ["2: from 1, isothermal to P = 500 kPa", "2: T = T1, P = 500 kPa"],
  },
  {
    setup: "fluid Water\n1: T = 300 °C, P = 1 MPa\n",
    defs: ["2: from 1, isochoric to P = 2 MPa", "2: P = 2 MPa, v = v1"],
  },
  {
    setup: "fluid Water\n",
    defs: [
      "units celsius\n2: T = 25, P = 100",
      "units kelvin\n2: T = 298.15, P = 100",
      "units imperial\n2: T = 77, P = 14.503773773020923",
      "2: T = 25 °C, P = 100 kPa",
    ],
  },
  {
    setup: "fluid Water\n",
    defs: [
      "2: P = 100 kPa, x = 50%",
      "2: P = 100 kPa, x = 0.5",
      "2: x = 0.5, P = 1 bar",
    ],
  },
];

describe("equivalent state definitions agree", () => {
  SAME_STATE.forEach(({ setup, defs }) => {
    it(defs[0], () => {
      const solved = defs.map((d) => {
        const r = run(setup + d);
        expect(r.diagnostics, d).toEqual([]);
        return r.states.find((s) => s.name === "2")!.state!;
      });
      const bad: string[] = [];
      solved.forEach((s, i) => {
        for (const f of STATE_FIELDS) {
          if (!close(s[f], solved[0][f], 1e-6))
            bad.push(`${defs[i]}: ${f} ${s[f]} vs ${solved[0][f]}`);
        }
      });
      expect(bad).toEqual([]);
    });
  });
});

describe("the unit table", () => {
  const names = Object.keys(UNITS);

  it("converts every unit to every other and back", () => {
    const bad: string[] = [];
    for (const a of names) {
      // An absolute temperature, or any other quantity.
      const q = literal(1.2345, a);
      for (const b of names) {
        if (!dimEq(UNITS[a].dim, UNITS[b].dim)) {
          if (convertTo(q, b) !== null) bad.push(`${a} → ${b} converted`);
          continue;
        }
        // Every temperature literal is a temperature, in K or in °C.
        const x = convertTo(q, b)!;
        const back = literal(x, b);
        if (
          !close(back.value, q.value) ||
          isDifference(back) !== isDifference(q)
        )
          bad.push(`${a} → ${b}: ${x}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("reads each unit as the app shows it and keyboards type it", () => {
    const variants = (name: string) =>
      new Set([
        name,
        name.replace(/\*/g, "·"),
        name.replace(/\*/g, "×"),
        name.replace(/\^2/g, "²").replace(/\^3/g, "³"),
        name.replace(/°/g, "º"),
        name
          .replace(/\*/g, "·")
          .replace(/\^2/g, "²")
          .replace(/\^3/g, "³")
          .replace(/°/g, "º"),
      ]);
    const bad: string[] = [];
    for (const name of names) {
      for (const v of variants(name)) {
        const u = unitAt(`${v} `);
        const same =
          u &&
          u.length === v.length &&
          UNITS[u.name].scale === UNITS[name].scale &&
          (UNITS[u.name].offset ?? 0) === (UNITS[name].offset ?? 0) &&
          dimEq(UNITS[u.name].dim, UNITS[name].dim);
        if (!same) bad.push(`${v} → ${u?.name}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
