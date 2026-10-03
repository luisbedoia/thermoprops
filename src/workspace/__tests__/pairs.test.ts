import { beforeEach, describe, expect, it } from "vitest";
import { setCoolProp } from "../../coolprop";
import { fakeCoolProp } from "../../test-fixtures/fakeCoolProp";
import { partnerOf, pickInput, solvable, swapPair } from "../pairs";
import type { PairForm } from "../pairs";

beforeEach(() => {
  setCoolProp(fakeCoolProp().cp);
});

const PT: PairForm = { property1: "pressure", value1: "101.3", property2: "temperature", value2: "25" };

describe("solvable", () => {
  it("follows the catalog pairs, in either order", () => {
    expect(solvable("pressure", "temperature")).toBe(true);
    expect(solvable("temperature", "pressure")).toBe(true);
    expect(solvable("enthalpy", "entropy")).toBe(true);
    expect(solvable("temperature", "enthalpy")).toBe(false);
    expect(solvable("pressure", "pressure")).toBe(false);
  });
});

describe("partnerOf", () => {
  it("is a solvable partner for every input", () => {
    for (const { name } of fakeCoolProp().cp.inputs()) {
      expect(solvable(name, partnerOf(name))).toBe(true);
    }
  });

  it("prefers the common pairs", () => {
    expect(partnerOf("temperature")).toBe("pressure");
    expect(partnerOf("enthalpy")).toBe("pressure");
    expect(partnerOf("pressure")).toBe("temperature");
  });
});

describe("pickInput", () => {
  it("keeps a solvable pair as chosen", () => {
    expect(pickInput(PT, "property2", "quality")).toEqual({
      form: { ...PT, property2: "quality" },
    });
  });

  it("swaps when the other input is picked, values included", () => {
    expect(pickInput(PT, "property1", "temperature").form).toEqual({
      property1: "temperature",
      value1: "25",
      property2: "pressure",
      value2: "101.3",
    });
  });

  it("keeps the pick and replaces the other input when the pair is not solvable", () => {
    // T–h does not fix a state: B becomes T's usual partner, p, emptied.
    const ph: PairForm = { property1: "pressure", value1: "101.3", property2: "enthalpy", value2: "2500" };
    expect(pickInput(ph, "property1", "temperature")).toEqual({
      form: { property1: "temperature", value1: "101.3", property2: "pressure", value2: "" },
      replaced: { slot: "property2", from: "enthalpy", to: "pressure" },
    });
  });

  it("reaches any solvable pair in two picks, from any pair", () => {
    const inputs = fakeCoolProp().cp.inputs().map((i) => i.name);
    const pairs = inputs.flatMap((a) => inputs.filter((b) => solvable(a, b)).map((b) => [a, b] as const));
    for (const [s1, s2] of pairs) {
      const start: PairForm = { property1: s1, value1: "1", property2: s2, value2: "2" };
      for (const [a, b] of pairs) {
        const { form } = pickInput(start, "property1", a);
        const end = pickInput(form, "property2", b).form;
        expect([end.property1, end.property2]).toEqual([a, b]);
      }
    }
  });

  it("is a no-op when the same input is picked again", () => {
    expect(pickInput(PT, "property1", "pressure")).toEqual({ form: PT });
  });
});

describe("swapPair", () => {
  it("permutes inputs and values", () => {
    expect(swapPair(swapPair(PT))).toEqual(PT);
    expect(swapPair(PT).property1).toBe("temperature");
  });
});
