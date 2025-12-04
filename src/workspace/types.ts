import type { Result } from "../lib";

export type StateDefinition = {
  id: string;
  label: string;
  property1: string;
  value1: string;
  property2: string;
  value2: string;
};

export type ComputedState = {
  definition: StateDefinition;
  results: Result[];
  error?: string;
};
