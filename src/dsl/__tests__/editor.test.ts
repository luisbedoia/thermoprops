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

const FLUIDS = [
  { name: "Water", aliases: ["H2O"], formula: "H2O" },
  { name: "R134a", aliases: [], formula: "CH2FCF3" },
] as unknown as FluidData[];

const DOC = "fluid Water\n1: T = 25 °C, P = 1 bar\nq = 2\n";

/** Completions with the caret at "|" in `line`, appended to DOC. */
function complete(line: string, explicit = false): string[] {
  const at = line.indexOf("|");
  const doc = DOC + line.replace("|", "");
  const state = EditorState.create({ doc });
  const source = scriptCompletions(() => ({ fluids: FLUIDS }));
  const r = source(
    new CompletionContext(state, DOC.length + at, explicit),
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
      expect.arrayContaining(["kJ/kg", "kW/K"]),
    );
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
