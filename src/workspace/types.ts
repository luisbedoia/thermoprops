import type { InputName, State } from "@luisbedoia/coolprop-rs-wasm";

/** A tracked state as stored in the URL: two SI inputs, values as text. */
export type StateDefinition = {
  id: string;
  label: string;
  property1: InputName;
  value1: string;
  property2: InputName;
  value2: string;
};

export type ComputedState = {
  definition: StateDefinition;
  /** The solved state; absent when it could not be evaluated. */
  state?: State;
  error?: string;
};
