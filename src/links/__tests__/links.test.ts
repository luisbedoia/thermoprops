import { beforeAll, describe, expect, it } from "vitest";
import type { CoolProp } from "@luisbedoia/coolprop-rs-wasm";
import { loadRealCoolProp } from "../../test-fixtures/realCoolProp";
import { evaluate } from "../../dsl/evaluate";
import { TEMPLATES } from "../../dsl/templates";
import { FLUID_NAMES, SYNTAX, worksheetLink } from "../links";

let cp: CoolProp;

beforeAll(async () => {
  cp = await loadRealCoolProp();
});

describe("the link format's page", () => {
  it("names every fluid of the catalog", () => {
    expect([...FLUID_NAMES].sort()).toEqual(
      cp
        .catalog()
        .map((f) => f.name)
        .sort(),
    );
  });

  it("links a script that opens as it was written", () => {
    const source = TEMPLATES[0].source;
    const url = new URL(worksheetLink(source));
    expect(url.pathname).toBe("/thermoprops/worksheet/");
    expect(url.searchParams.get("s")).toBe(source);
    // "+" and "#" survive: neither is read as a space or a fragment.
    const tricky = "# a comment\nq = h1 + h2";
    expect(new URL(worksheetLink(tricky)).searchParams.get("s")).toBe(tricky);
  });

  it("documents statements the Worksheet solves", () => {
    // Its examples as one script: the first state renamed, the cycle closed.
    const lines = SYNTAX.map(([code]) => code);
    lines[lines.indexOf("1: T = 25 °C, P = 1 bar")] = "0: T = 25 °C, P = 1 bar";
    lines.splice(
      lines.indexOf("3: P = P2, sat liquid") + 1,
      0,
      "4: from 3, throttled to P = P1",
    );
    const result = evaluate(lines.join("\n"), cp);
    expect(result.diagnostics).toEqual([]);
    expect(result.states.map((s) => s.name)).toEqual(["0", "1", "2", "3", "4"]);
  });
});
