import { describe, expect, it } from "vitest";
import {
  CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { EditorState, Text } from "@codemirror/state";
import { highlightTree, tagHighlighter, tags as t } from "@lezer/highlight";
import type { FluidData } from "@luisbedoia/coolprop-rs-wasm";
import { scriptCompletions } from "../editor/completions";
import { toCmDiagnostics } from "../editor/hover";
import { scriptLanguage } from "../editor/language";

const FLUIDS = [
  { name: "Water", aliases: ["H2O"], formula: "H2O" },
  { name: "R134a", aliases: [], formula: "CH2FCF3" },
] as unknown as FluidData[];

const DOC = "fluid Water\nstate 1: T = 25 °C, P = 1 bar\nlet q = 2\n";

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
    expect(complete("state 2 = 1 -> |")).toContain("isentropic");
    expect(complete("state 3 [Wa|")).toContain("Water");
    expect(complete("let p = 3 k|")).toContain("kPa");
    expect(complete("cycle 1 -> |")).toContain("1");
    expect(complete("let z = |", true)).toEqual(
      expect.arrayContaining(["q", "1", "sqrt"]),
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
      "fluid Water\nstate 2s = 1 -> isentropic(P = 1.2 MPa) # ok\nlet w = 2s.h - 1.h",
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
});

describe("diagnostic ranges", () => {
  it("underline the word at the position, or the statement", () => {
    const doc = Text.of(["state 1: T = 300 K, Q = bad", "let a ="]);
    const [word, line] = toCmDiagnostics(doc, [
      { line: 1, col: 25, message: "Unknown variable" },
      { line: 2, col: 8, message: "Expected a value" },
    ]);
    expect(doc.sliceString(word.from, word.to)).toBe("bad");
    expect(doc.sliceString(line.from, line.to)).toBe("let a =");
  });
});
