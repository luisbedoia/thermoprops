import { describe, expect, it } from "vitest";
import {
  CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { EditorState, Text } from "@codemirror/state";
import { highlightTree, tagHighlighter, tags as t } from "@lezer/highlight";
import type { FluidData } from "@luisbedoia/coolprop-rs-wasm";
import {
  plainFormula,
  scriptCompletions,
  suggestionsAt,
} from "../editor/completions";
import { EditorSelection } from "@codemirror/state";
import { toCmDiagnostics } from "../editor/hover";
import { scriptLanguage } from "../editor/language";
import type { ScriptResult } from "../evaluate";

const FLUIDS = [
  { name: "Water", aliases: ["H2O"], formula: "H2O", display_name: "Agua" },
  { name: "R134a", aliases: [], formula: "CH2FCF3", display_name: "R134a" },
  {
    name: "CarbonDioxide",
    aliases: ["CO2", "R744"],
    formula: "CO2",
    display_name: "Dióxido de carbono",
  },
] as unknown as FluidData[];

/** Water's pairs, as coolprop-rs lists them. */
const PAIRS = [
  ["pressure", "temperature"],
  ["pressure", "quality"],
  ["quality", "temperature"],
  ["density", "pressure"],
  ["enthalpy", "pressure"],
  ["pressure", "entropy"],
  ["pressure", "internal_energy"],
  ["density", "temperature"],
  ["entropy", "temperature"],
  ["density", "quality"],
  ["density", "enthalpy"],
  ["density", "entropy"],
  ["density", "internal_energy"],
  ["enthalpy", "entropy"],
] as const;

const DOC = "fluid Water\n1: T = 25 °C, P = 1 bar\nq = 2\n";

/** Completions with the caret at "|" in `line`, appended to DOC. */
function complete(
  line: string,
  explicit = false,
  {
    head = DOC,
    pairs = false,
    result,
  }: { head?: string; pairs?: boolean; result?: ScriptResult } = {},
): string[] {
  const at = line.indexOf("|");
  const doc = head + line.replace("|", "");
  const state = EditorState.create({ doc });
  const source = scriptCompletions(() => ({
    fluids: FLUIDS,
    pairs: pairs ? PAIRS : undefined,
    result,
  }));
  const r = source(
    new CompletionContext(state, head.length + at, explicit),
  ) as CompletionResult | null;
  return r ? r.options.map((o) => o.label) : [];
}

describe("completions", () => {
  it("offer statements at the start of a line", () => {
    expect(complete("st|")).toContain("state");
  });

  it("offer properties after a defined state", () => {
    expect(complete("print 1.|")).toEqual(
      expect.arrayContaining(["T", "h", "cp"]),
    );
    // 1.5 is a number when there is no state 1... and here state 9 does not exist.
    expect(complete("print 9.|")).toEqual([]);
  });

  it("offer processes, fluids, units and states where they fit", () => {
    expect(complete("3 [Wa|")).toContain("Water");
    expect(complete("p = 3 k|")).toContain("kPa");
    expect(complete("draw 1 -> |")).toContain("1");
    expect(complete("z = |", true)).toEqual(
      expect.arrayContaining(["q", "1", "sqrt"]),
    );
    expect(complete("z = h|")).toEqual(expect.arrayContaining(["h1"]));
  });

  it("offer a state's clauses as it is written", () => {
    expect(complete("2: |", true)).toEqual(
      expect.arrayContaining(["T", "P", "sat vapor", "from"]),
    );
    expect(complete("2: from |", true)).toEqual(["1"]);
    expect(complete("2: from 1, |", true)).toEqual(
      expect.arrayContaining(["isentropic", "compressed", "throttled"]),
    );
    expect(complete("2: from 1, compressed |", true)).toEqual(
      expect.arrayContaining(["to P", "to T"]),
    );
    expect(complete("2: from 1, compressed to P = 2 bar, |", true)).toContain(
      "eta",
    );
    expect(complete("2: P = 1 bar, sat |", true)).toEqual(["vapor", "liquid"]);
    expect(complete("2: from 1, throttled to P = |", true)[0]).toBe("P1");
    expect(complete("print h1 in k|")).toEqual(
      expect.arrayContaining(["kJ/kg"]),
    );
  });

  it("offer a property's units, the unit system's first", () => {
    // The space after the number opens them, without asking.
    const pressures = complete("2: P = 100 |");
    expect(pressures[0]).toBe("kPa");
    expect(pressures).toEqual(
      expect.arrayContaining(["MPa", "bar", "psi", "atm"]),
    );
    expect(pressures).not.toContain("°C");
    expect(complete("2: T = 25 |")[0]).toBe("°C");
    expect(complete("2: from 1, isobaric to T = 300 |")[0]).toBe("°C");
    const imperial = { head: "fluid Water\nunits imperial\n" };
    expect(complete("1: P = 14.7 |", false, imperial)[0]).toBe("psi");
    expect(complete("1: h = 100 |", false, imperial)[0]).toBe("BTU/lbm");
    // Typing narrows them: CodeMirror filters by what follows the number.
    expect(complete("2: P = 1 M|")).toContain("MPa");
    // Not by itself where a unit would change the value (eta = 80 %).
    expect(complete("2: from 1, compressed to P = 2 bar, eta = 80 |")).toEqual(
      [],
    );
    expect(
      complete("2: from 1, compressed to P = 2 bar, eta = 80 |", true),
    ).toEqual(["%"]);
    // A value's quantity is unknown: any unit, as before.
    expect(complete("q2 = 3 k|")).toEqual(
      expect.arrayContaining(["kPa", "kJ/kg", "kW"]),
    );
  });

  it("offer the units of what is printed", () => {
    expect(complete("print T1 in |", true)[0]).toBe("°C");
    expect(complete("print T1 in |", true)).not.toContain("kPa");
    expect(complete("print q, 1.P in |", true)).toContain("psi");
    // Any printed expression, as the last evaluation measured it.
    const quantity = (dim: number[]) => ({ value: 1, dim });
    const result = {
      states: [],
      diagnostics: [],
      unitSystem: "celsius",
      values: [
        { name: "efficiency", line: 4, value: quantity([0, 0, 0, 0]) },
        { name: "W", line: 5, value: quantity([1, 2, -3, 0]) },
      ],
      prints: [
        {
          name: "w_turb - w_pump",
          text: "w_turb - w_pump",
          line: 6,
          value: quantity([0, 2, -2, 0]),
        },
      ],
    } as unknown as ScriptResult;
    const work = complete("print w_turb - w_pump in |", false, { result });
    expect(work[0]).toBe("kJ/kg");
    expect(work).toContain("BTU/lbm");
    expect(work).not.toContain("kW");
    expect(complete("print efficiency in |", false, { result })).toEqual(["%"]);
    expect(complete("print W in |", false, { result })[0]).toBe("kW");
    // The output being written, not the ones before it.
    expect(complete("print efficiency, W in |", false, { result })[0]).toBe(
      "kW",
    );
    expect(complete("print W, efficiency in |", false, { result })).toEqual([
      "%",
    ]);
    expect(
      complete("print W in |", false, {
        result,
        head: "fluid Water\nunits imperial\n",
      }),
    ).toEqual(expect.arrayContaining(["hp", "BTU/h"]));
  });

  it("work out what an expression measures from its parts", () => {
    // Not evaluated yet: from the values' definitions and the states.
    const head =
      DOC + "w_1 = h1 - 1.h\nw_2 = 3 kJ/kg\nm = 2 kg/s\nV = sqrt(2 * w_1)\n";
    const units = (expr: string) =>
      complete(`print ${expr} in |`, false, { head });
    expect(units("w_1 - w_2")[0]).toBe("kJ/kg");
    expect(units("m * (w_1 - w_2)")[0]).toBe("kW");
    expect(units("w_1 / w_2")).toEqual(["%"]);
    expect(units("V")[0]).toBe("m/s");
    expect(units("T1 - 2 K")[0]).toBe("°C");
    expect(units("P1 / 1.T")[0]).not.toBe("kPa");
    expect(units("q * m")[0]).toBe("kg/s");
    // An unknown part: any unit, as before.
    expect(units("nope - w_1")).toContain("kJ/kg");
    expect(units("nope * w_1")[0]).toBe("°C");
  });

  it('offer "in" after what is printed', () => {
    expect(complete("print T1 i|")).toEqual(["in", ","]);
    expect(complete("print h1 - h2 i|")).toEqual(["in", ","]);
    expect(complete("print T1 |", true)).toEqual(["in", ","]);
    // Not by itself after the space, nor where a name is starting.
    expect(complete("print T1 |")).toEqual([]);
    expect(complete("print i|")).not.toContain("in");
    expect(complete("print a * i|")).not.toContain("in");
  });

  it("offer fluids by name, alias or display name", () => {
    expect(complete("fluid |")).toEqual(["Water", "R134a", "CarbonDioxide"]);
    expect(complete("fluid co2|")).toEqual(["CarbonDioxide"]);
    expect(complete("fluid agua|")).toEqual(["Water"]);
    expect(complete("fluid dioxido|")).toEqual(["CarbonDioxide"]);
    expect(complete("fluid r1|")).toEqual(["R134a"]);
    expect(complete("3 [h2|")).toEqual(["Water"]);
    // What each statement takes, as soon as its space is typed.
    expect(complete("units |")).toEqual(["celsius", "kelvin", "imperial"]);
    expect(complete("reference |")).toContain("ASHRAE");
    expect(complete("draw |")).toContain("1");
    // Not before the space: "fluid" may still be a value's name.
    expect(complete("fluid|")).toEqual([]);
  });

  it("offer the properties that fix the state with those given", () => {
    const withT = complete("2: T = 25 °C, |", true, { pairs: true });
    expect(withT).toEqual(expect.arrayContaining(["P", "D", "v", "s"]));
    expect(withT).toContain("sat vapor");
    // CoolProp does not solve a state from T and h, nor T and T.
    expect(withT).not.toContain("h");
    expect(withT).not.toContain("T");
    expect(withT).not.toContain("from");
    // Without the pairs, any other property.
    expect(complete("2: T = 25 °C, |", true)).toContain("h");
    // Saturated: x is given.
    expect(
      complete("2: P = 1 bar, sat liquid, |", true, { pairs: true }),
    ).toEqual([]);
    expect(
      complete("2: T = 25 °C, P = 1 bar, |", true, { pairs: true }),
    ).toEqual([]);
    // A process aimed at its target needs only its own parameters.
    expect(complete("2: from 1, compressed to P = 2 bar, |", true)).toEqual([
      "eta",
    ]);
  });

  it("are silent in comments", () => {
    expect(complete("# st|")).toEqual([]);
  });
});

function highlighted(doc: string): Record<string, string> {
  const tree = scriptLanguage.parser.parse(doc);
  const out: Record<string, string> = {};
  const hl = tagHighlighter([
    { tag: t.keyword, class: "keyword" },
    { tag: t.definition(t.typeName), class: "stateDef" },
    { tag: t.typeName, class: "stateRef" },
    { tag: t.propertyName, class: "property" },
    { tag: t.function(t.keyword), class: "process" },
    { tag: t.number, class: "number" },
    { tag: t.unit, class: "unit" },
    { tag: t.atom, class: "atom" },
    { tag: t.variableName, class: "variable" },
    { tag: t.lineComment, class: "comment" },
  ]);
  highlightTree(tree, hl, (from, to, cls) => {
    out[doc.slice(from, to)] = cls;
  });
  return out;
}

describe("highlighting", () => {
  it("tells states, properties, processes, numbers and units apart", () => {
    const h = highlighted(
      "fluid Water\n2s: from 1, isentropic to P = 1.2 MPa # ok\nw = 2s.h - h1",
    );
    expect(h).toMatchObject({
      fluid: "keyword",
      Water: "atom",
      "2s": "stateRef",
      isentropic: "process",
      P: "property",
      "1.2": "number",
      MPa: "unit",
      "# ok": "comment",
      w: expect.stringContaining("variable"),
      h: "property",
    });
  });

  it("reads the current syntax", () => {
    const h = highlighted(
      "2 [Water]: from 1, compressed to P = 1.2 MPa, eta = 80%\n3: T = 25, sat vapor\nCOP = h1 / q\nprint T2 in °F",
    );
    expect(h).toMatchObject({
      "2": "stateDef",
      from: "keyword",
      "1": "stateRef",
      compressed: "process",
      to: "keyword",
      P: "property",
      eta: "property",
      "%": "unit",
      "3": "stateDef",
      sat: "keyword",
      vapor: "atom",
      COP: expect.stringContaining("variable"),
      h1: "property",
      q: "variable",
      in: "keyword",
      "°F": "unit",
    });
  });

  it("reads units as the lexer does", () => {
    const h = highlighted("1m: T = 25 ºC, P = 1 bar\nk = 1 kJ/(kg·K)");
    expect(h).toMatchObject({
      "1m": "stateDef",
      ºC: "unit",
      "kJ/(kg·K)": "unit",
    });
  });
});

describe("diagnostic ranges", () => {
  it("underline the word at the position, or the statement", () => {
    const doc = Text.of(["1: T = 300 K, Q = bad", "a ="]);
    const [word, line] = toCmDiagnostics(doc, [
      { line: 1, col: 19, message: "Unknown variable" },
      { line: 2, col: 4, message: "Expected a value" },
    ]);
    expect(doc.sliceString(word.from, word.to)).toBe("bad");
    expect(doc.sliceString(line.from, line.to)).toBe("a =");
  });
});

describe("keypad suggestions", () => {
  const source = scriptCompletions(() => ({ fluids: FLUIDS }));
  /** Suggestions with the caret at "|" in `line`, appended to DOC. */
  function at(line: string) {
    const caret = DOC.length + line.indexOf("|");
    const state = EditorState.create({
      doc: DOC + line.replace("|", ""),
      selection: EditorSelection.cursor(caret),
    });
    const s = suggestionsAt(state, source);
    return s?.options.map((o) => [o.label, o.apply]) ?? [];
  }

  it("offer statements on an empty line and what follows a name", () => {
    expect(at("|").map(([l]) => l)).toContain("state");
    expect(at("2|")).toEqual([[":", ": "]]);
    expect(at("COP|")).toEqual([
      [":", ": "],
      ["=", " = "],
    ]);
  });

  it("offer units right after a number, with their space", () => {
    expect(at("p = 25|")).toContainEqual(["°C", " °C"]);
    expect(at("2: P = 100|")[0]).toEqual(["kPa", " kPa"]);
    expect(at("fluid co|").map(([l]) => l)).toEqual(["CarbonDioxide"]);
    expect(at("p = 25 k|").map(([l]) => l)).toEqual(
      expect.arrayContaining(["kPa", "kJ/kg"]),
    );
  });

  it("narrow by what is typed and drop the exact match", () => {
    expect(at("print 1.c|").map(([l]) => l)).toEqual(["cp", "cv"]);
    // Right after "print": what there is to print, the values first.
    expect(at("print |").map(([l]) => l)).toEqual(
      expect.arrayContaining(["q", "1"]),
    );
    expect(at("p = 25 kPa|")).toEqual([]);
  });
});

describe("plainFormula", () => {
  it("writes CoolProp's formulas as text, not LaTeX", () => {
    expect(plainFormula("C_{2}F_{4}H_{2}")).toBe("C₂F₄H₂");
    expect(plainFormula("H_{2}O_{1}")).toBe("H₂O");
    expect(plainFormula("C_{5}H_{12}")).toBe("C₅H₁₂");
    expect(plainFormula("")).toBeUndefined();
  });
});
