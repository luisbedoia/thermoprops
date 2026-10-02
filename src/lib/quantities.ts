import type {
  PlotProperty,
  PropertyName,
  State,
} from "@luisbedoia/coolprop-rs-wasm";
import { coolprop } from "../coolprop";

/**
 * Every number the app shows for a state: coolprop-rs's numeric `State`
 * properties plus specific volume, derived as 1/ρ.
 */
export type Quantity = PropertyName | "specific_volume";

/** The value of `quantity` in `state`; null when undefined for that state. */
export function quantityValue(state: State, quantity: Quantity): number | null {
  if (quantity === "specific_volume") return 1 / state.density;
  return state[quantity];
}

/** Table order: coolprop-rs's property catalog, with v right after ρ. */
export function tableQuantities(): Quantity[] {
  return coolprop()
    .properties()
    .flatMap((p): Quantity[] =>
      p.name === "density" ? ["density", "specific_volume"] : [p.name],
    );
}

/** The value of a diagram axis property in `state`. */
export function plotValue(state: State, property: PlotProperty): number {
  return property === "specific_volume" ? 1 / state.density : state[property];
}
