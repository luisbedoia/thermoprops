import type { Result } from "../lib";
import type { PlotPoint } from "../lib/plotUtils";
import { normalizeNumericInput } from "../lib/normalizeNumericInput";
import type { ComputedState, StateDefinition } from "./types";

export function decodeStates(encoded: string | null): StateDefinition[] {
  if (!encoded) {
    return [];
  }
  try {
    const raw = atob(encoded);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => item as Partial<StateDefinition>)
      .filter((item): item is StateDefinition =>
        Boolean(
          item &&
            typeof item.id === "string" &&
            typeof item.property1 === "string" &&
            typeof item.property2 === "string" &&
            typeof item.value1 === "string" &&
            typeof item.value2 === "string" &&
            typeof item.label === "string",
        ),
      );
  } catch (error) {
    console.error("Unable to decode states", error);
    return [];
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

export function getPropertyValue(
  definition: StateDefinition,
  results: Result[],
  propertyName: string,
): number | null {
  if (definition.property1 === propertyName) {
    return Number(definition.value1);
  }
  if (definition.property2 === propertyName) {
    return Number(definition.value2);
  }
  const result = results.find((item) => item.name === propertyName);
  return result ? result.value : null;
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

const PLOT_AXES: Record<string, { x: string; y: string }> = {
  ph: { x: "H", y: "P" },
  ts: { x: "S", y: "T" },
  pt: { x: "T", y: "P" },
  rh: { x: "H", y: "D" },
};

export function getPlotPoints(
  computedStates: ComputedState[],
  plotId: string,
): PlotPoint[] {
  const axes = PLOT_AXES[plotId];
  if (!axes) return [];

  return computedStates
    .map((state) => {
      if (state.error) return null;
      const x = getPropertyValue(state.definition, state.results, axes.x);
      const y = getPropertyValue(state.definition, state.results, axes.y);
      if (x == null || y == null) return null;
      return { id: state.definition.id, label: state.definition.label, x, y };
    })
    .filter((point): point is PlotPoint => Boolean(point));
}
