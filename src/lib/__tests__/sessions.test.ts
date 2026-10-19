// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearExplorer,
  explorerSummary,
  isOwnWork,
  savedExplorer,
  saveExplorer,
  savedWorksheet,
  saveWorksheet,
  worksheetSummary,
} from "../sessions";
import { TEMPLATES } from "../../dsl/templates";
import { encodeStates } from "../../workspace/utils";
import type { StateDefinition } from "../../workspace/types";
import { setCoolProp } from "../../coolprop";
import { fakeCoolProp } from "../../test-fixtures/fakeCoolProp";

beforeEach(() => {
  localStorage.clear();
  setCoolProp(fakeCoolProp().cp);
});

const state = (id: string): StateDefinition => ({
  id,
  label: id,
  property1: "temperature",
  value1: "300",
  property2: "pressure",
  value2: "101325",
});

describe("worksheet session", () => {
  it("keeps the last script", () => {
    expect(savedWorksheet()).toBeNull();
    saveWorksheet("fluid Water\n1: T = 25 °C, P = 1 bar\n");
    expect(savedWorksheet()).toBe("fluid Water\n1: T = 25 °C, P = 1 bar\n");
  });

  it("tells someone's work from an untouched example", () => {
    expect(isOwnWork(TEMPLATES[0].source)).toBe(false);
    expect(isOwnWork("   \n")).toBe(false);
    expect(isOwnWork(TEMPLATES[0].source + "x = 1\n")).toBe(true);
  });

  it("sums up a script by its fluid and states", () => {
    const rankine = TEMPLATES.find((t) => t.id === "regenerative")!.source;
    expect(worksheetSummary(rankine)).toBe("Water · 7 states");
    expect(worksheetSummary("1 [Air]: T = 300 K, P = 1 bar")).toBe(
      "Air · 1 state",
    );
  });
});

describe("explorer session", () => {
  const search = `?fluid=Water&units=celsius&states=${encodeStates([
    state("s1"),
    state("s2"),
  ])}`;

  it("keeps and clears the last workspace", () => {
    saveExplorer(search);
    expect(savedExplorer()).toBe(search);
    clearExplorer();
    expect(savedExplorer()).toBeNull();
  });

  it("sums up a workspace, or has nothing to continue", () => {
    expect(explorerSummary(search)).toBe("Water · 2 states");
    expect(explorerSummary("?fluid=Water&units=celsius")).toBeNull();
  });
});
