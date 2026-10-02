import type { DiagramInfo } from "@luisbedoia/coolprop-rs-wasm";
import { coolprop } from "../coolprop";
import type { PlotPoint } from "../lib/plotUtils";
import { quantityValue } from "../lib/quantities";
import { normalizeNumericInput } from "../lib/normalizeNumericInput";
import type { ComputedState, StateDefinition } from "./types";

export type DecodedStates = {
  states: StateDefinition[];
  /**
   * The link was made by an earlier version of the app (states named with
   * CoolProp's short names such as "T"), which is no longer supported.
   */
  legacy: boolean;
};

export function decodeStates(encoded: string | null): DecodedStates {
  if (!encoded) {
    return { states: [], legacy: false };
  }
  try {
    const parsed = JSON.parse(atob(encoded)) as unknown;
    if (!Array.isArray(parsed)) {
      return { states: [], legacy: false };
    }
    const wellFormed = parsed
      .map((item) => item as Partial<Record<keyof StateDefinition, unknown>>)
      .filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.property1 === "string" &&
          typeof item.property2 === "string" &&
          typeof item.value1 === "string" &&
          typeof item.value2 === "string" &&
          typeof item.label === "string",
      );
    const names = new Set<unknown>(coolprop().inputs().map((i) => i.name));
    const states = wellFormed.filter(
      (item): item is StateDefinition =>
        names.has(item.property1) && names.has(item.property2),
    );
    return { states, legacy: states.length < wellFormed.length };
  } catch (error) {
    console.error("Unable to decode states", error);
    return { states: [], legacy: false };
  }
}

export function encodeStates(states: StateDefinition[]): string {
  return btoa(JSON.stringify(states));
}

export function createStateLabel(count: number) {
  return `State ${count}`;
}

export function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function statesEqual(a: StateDefinition[], b: StateDefinition[]) {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (
      left.id !== right.id ||
      left.label !== right.label ||
      left.property1 !== right.property1 ||
      left.property2 !== right.property2 ||
      left.value1 !== right.value1 ||
      left.value2 !== right.value2
    ) {
      return false;
    }
  }
  return true;
}

export function normalizeStateDefinition(
  definition: StateDefinition,
): StateDefinition {
  const normalizedValue1 = normalizeNumericInput(definition.value1);
  const normalizedValue2 = normalizeNumericInput(definition.value2);

  if (
    normalizedValue1 === definition.value1 &&
    normalizedValue2 === definition.value2
  ) {
    return definition;
  }

  return {
    ...definition,
    value1: normalizedValue1,
    value2: normalizedValue2,
  };
}

/** Tracked states as points on the axes of `diagram`. */
export function getPlotPoints(
  computedStates: ComputedState[],
  diagram: DiagramInfo | undefined,
): PlotPoint[] {
  if (!diagram) return [];
  return computedStates.flatMap(({ definition, state }) =>
    state
      ? [
          {
            id: definition.id,
            label: definition.label,
            x: quantityValue(state, diagram.x.property) ?? NaN,
            y: quantityValue(state, diagram.y.property) ?? NaN,
          },
        ]
      : [],
  );
}
