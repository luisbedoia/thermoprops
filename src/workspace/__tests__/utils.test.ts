import { beforeEach, describe, expect, it } from "vitest";
import type { DiagramInfo } from "@luisbedoia/coolprop-rs-wasm";
import { setCoolProp } from "../../coolprop";
import {
  fakeCoolProp,
  LIQUID_WATER,
  TWO_PHASE_WATER,
} from "../../test-fixtures/fakeCoolProp";
import {
  createStateLabel,
  decodeStates,
  encodeStates,
  generateId,
  getPlotPoints,
  normalizeStateDefinition,
  statesEqual,
} from "../utils";
import type { ComputedState, StateDefinition } from "../types";

beforeEach(() => {
  setCoolProp(fakeCoolProp().cp);
});

function makeState(overrides: Partial<StateDefinition> = {}): StateDefinition {
  return {
    id: "s1",
    label: "State 1",
    property1: "temperature",
    value1: "300",
    property2: "pressure",
    value2: "101325",
    ...overrides,
  };
}

describe("createStateLabel", () => {
  it("formats label with count", () => {
    expect(createStateLabel(1)).toBe("State 1");
    expect(createStateLabel(12)).toBe("State 12");
  });
});

describe("generateId", () => {
  it("returns distinct non-empty strings", () => {
    const a = generateId();
    expect(a).toBeTruthy();
    expect(generateId()).not.toBe(a);
  });
});

describe("encodeStates / decodeStates", () => {
  it("round-trips states", () => {
    const states = [
      makeState(),
      makeState({ id: "s2", property2: "quality", value2: "0.5" }),
    ];
    expect(decodeStates(encodeStates(states))).toEqual({
      states,
      legacy: false,
    });
  });

  it("returns nothing for missing or malformed input", () => {
    const none = { states: [], legacy: false };
    expect(decodeStates(null)).toEqual(none);
    expect(decodeStates("")).toEqual(none);
    expect(decodeStates("not base64!")).toEqual(none);
    expect(decodeStates(btoa(JSON.stringify({ a: 1 })))).toEqual(none);
  });

  it("drops items missing fields or with wrong types", () => {
    const encoded = btoa(
      JSON.stringify([
        makeState(),
        { id: "x", label: "y" },
        { ...makeState(), value1: 3 },
      ]),
    );
    expect(decodeStates(encoded)).toEqual({
      states: [makeState()],
      legacy: false,
    });
  });

  it("drops states whose values are not numbers, without flagging the link", () => {
    const bad = [
      makeState({ id: "inf", value1: "Infinity" }),
      makeState({ id: "hex", value2: "0x10" }),
      makeState({ id: "txt", value1: "abc" }),
    ];
    const decoded = decodeStates(
      btoa(JSON.stringify([...bad, makeState({ id: "ok" })])),
    );
    expect(decoded.states.map((s) => s.id)).toEqual(["ok"]);
    expect(decoded.legacy).toBe(false);
  });

  it("flags links from earlier versions (CoolProp short names)", () => {
    const old = { ...makeState(), property1: "T", property2: "P" };
    const decoded = decodeStates(
      btoa(JSON.stringify([old, makeState({ id: "s2" })])),
    );
    expect(decoded.legacy).toBe(true);
    expect(decoded.states).toEqual([makeState({ id: "s2" })]);
  });
});

describe("statesEqual", () => {
  it("compares every field in order", () => {
    expect(statesEqual([], [])).toBe(true);
    expect(statesEqual([makeState()], [makeState()])).toBe(true);
    expect(statesEqual([makeState()], [])).toBe(false);
    for (const change of [
      { id: "other" },
      { label: "Other" },
      { property1: "density" as const },
      { value1: "301" },
      { property2: "quality" as const },
      { value2: "1" },
    ]) {
      expect(statesEqual([makeState()], [makeState(change)])).toBe(false);
    }
  });
});

describe("normalizeStateDefinition", () => {
  it("returns the same object when already normalized", () => {
    const s = makeState();
    expect(normalizeStateDefinition(s)).toBe(s);
  });

  it("converts comma decimal separators, keeping the rest", () => {
    const s = makeState({ value1: "300,5", value2: "1,5" });
    expect(normalizeStateDefinition(s)).toEqual({
      ...s,
      value1: "300.5",
      value2: "1.5",
    });
  });
});

describe("getPlotPoints", () => {
  const diagram = (id: string) =>
    fakeCoolProp()
      .cp.diagrams()
      .find((d) => d.id === id) as DiagramInfo;
  const solved = (overrides: Partial<ComputedState> = {}): ComputedState => ({
    definition: makeState(),
    state: LIQUID_WATER,
    ...overrides,
  });

  it("is empty without a diagram or states", () => {
    expect(getPlotPoints([solved()], undefined)).toEqual([]);
    expect(getPlotPoints([], diagram("pressure_enthalpy"))).toEqual([]);
  });

  it("projects each state onto the diagram's axes", () => {
    const [ph] = getPlotPoints([solved()], diagram("pressure_enthalpy"));
    expect(ph).toEqual({
      id: "s1",
      label: "State 1",
      x: LIQUID_WATER.enthalpy,
      y: LIQUID_WATER.pressure,
    });
    const [ts] = getPlotPoints(
      [solved({ state: TWO_PHASE_WATER })],
      diagram("temperature_entropy"),
    );
    expect(ts).toMatchObject({
      x: TWO_PHASE_WATER.entropy,
      y: TWO_PHASE_WATER.temperature,
    });
  });

  it("derives specific volume for P–v", () => {
    const [pv] = getPlotPoints([solved()], diagram("pressure_specific_volume"));
    expect(pv.x).toBeCloseTo(1 / LIQUID_WATER.density, 12);
  });

  it("skips states that could not be evaluated", () => {
    const points = getPlotPoints(
      [
        solved(),
        solved({
          definition: makeState({ id: "bad" }),
          state: undefined,
          error: "x",
        }),
      ],
      diagram("pressure_enthalpy"),
    );
    expect(points.map((p) => p.id)).toEqual(["s1"]);
  });
});
