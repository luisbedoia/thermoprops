import { describe, it, expect } from "vitest";
import {
  createStateLabel,
  decodeStates,
  encodeStates,
  generateId,
  getPropertyValue,
  statesEqual,
} from "../utils";
import type { StateDefinition } from "../types";

const makeState = (overrides: Partial<StateDefinition> = {}): StateDefinition => ({
  id: "test-id",
  label: "State 1",
  property1: "T",
  value1: "300",
  property2: "P",
  value2: "101325",
  ...overrides,
});

describe("createStateLabel", () => {
  it("formats label with count", () => {
    expect(createStateLabel(1)).toBe("State 1");
    expect(createStateLabel(10)).toBe("State 10");
    expect(createStateLabel(0)).toBe("State 0");
  });
});

describe("generateId", () => {
  it("returns a non-empty string", () => {
    const id = generateId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns different values on successive calls", () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateId()));
    expect(ids.size).toBe(10);
  });
});

describe("encodeStates / decodeStates", () => {
  it("round-trips a single state", () => {
    const state = makeState();
    const encoded = encodeStates([state]);
    const decoded = decodeStates(encoded);
    expect(decoded).toEqual([state]);
  });

  it("round-trips multiple states", () => {
    const states = [
      makeState({ id: "a", label: "State 1" }),
      makeState({ id: "b", label: "State 2", property1: "H", value1: "400000" }),
    ];
    expect(decodeStates(encodeStates(states))).toEqual(states);
  });

  it("round-trips an empty array", () => {
    expect(decodeStates(encodeStates([]))).toEqual([]);
  });

  it("returns [] for null input", () => {
    expect(decodeStates(null)).toEqual([]);
  });

  it("returns [] for empty string", () => {
    expect(decodeStates("")).toEqual([]);
  });

  it("returns [] for invalid base64", () => {
    expect(decodeStates("!!!not-base64!!!")).toEqual([]);
  });

  it("returns [] when decoded JSON is not an array", () => {
    const encoded = btoa(JSON.stringify({ not: "an array" }));
    expect(decodeStates(encoded)).toEqual([]);
  });

  it("returns [] when decoded JSON is a string", () => {
    const encoded = btoa(JSON.stringify("a string"));
    expect(decodeStates(encoded)).toEqual([]);
  });

  it("filters out items missing required fields", () => {
    const validState = makeState({ id: "valid" });
    const invalidItem = { id: "bad" }; // missing label, property1, etc.
    const encoded = btoa(JSON.stringify([validState, invalidItem]));
    expect(decodeStates(encoded)).toEqual([validState]);
  });

  it("filters out items with wrong field types", () => {
    const badState = { ...makeState(), value1: 300 }; // value1 should be string
    const encoded = btoa(JSON.stringify([badState]));
    expect(decodeStates(encoded)).toEqual([]);
  });
});

describe("getPropertyValue", () => {
  const definition = makeState();
  const results = [
    { name: "H", unit: "J/kg", description: "Enthalpy", value: 500000 },
    { name: "S", unit: "J/(kg*K)", description: "Entropy", value: 1800 },
  ];

  it("returns Number(value1) when property matches property1", () => {
    expect(getPropertyValue(definition, results, "T")).toBe(300);
  });

  it("returns Number(value2) when property matches property2", () => {
    expect(getPropertyValue(definition, results, "P")).toBe(101325);
  });

  it("returns result value when property is in results", () => {
    expect(getPropertyValue(definition, results, "H")).toBe(500000);
  });

  it("returns null when property is not found anywhere", () => {
    expect(getPropertyValue(definition, results, "CPMASS")).toBeNull();
  });
});

describe("statesEqual", () => {
  it("returns true for two empty arrays", () => {
    expect(statesEqual([], [])).toBe(true);
  });

  it("returns true for identical arrays", () => {
    const states = [makeState({ id: "a" }), makeState({ id: "b" })];
    expect(statesEqual(states, [...states])).toBe(true);
  });

  it("returns false when arrays have different lengths", () => {
    expect(statesEqual([makeState()], [])).toBe(false);
  });

  it("returns false when id differs", () => {
    expect(statesEqual([makeState({ id: "a" })], [makeState({ id: "b" })])).toBe(false);
  });

  it("returns false when label differs", () => {
    expect(
      statesEqual([makeState({ label: "State 1" })], [makeState({ label: "State 2" })]),
    ).toBe(false);
  });

  it("returns false when property1 differs", () => {
    expect(
      statesEqual(
        [makeState({ property1: "T" })],
        [makeState({ property1: "P" })],
      ),
    ).toBe(false);
  });

  it("returns false when value1 differs", () => {
    expect(
      statesEqual([makeState({ value1: "300" })], [makeState({ value1: "350" })]),
    ).toBe(false);
  });

  it("returns false when property2 differs", () => {
    expect(
      statesEqual(
        [makeState({ property2: "P" })],
        [makeState({ property2: "H" })],
      ),
    ).toBe(false);
  });

  it("returns false when value2 differs", () => {
    expect(
      statesEqual([makeState({ value2: "101325" })], [makeState({ value2: "200000" })]),
    ).toBe(false);
  });
});
