import type {
  Phase,
  PhaseInfo,
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

/** Symbol and description of a quantity, as coolprop-rs catalogs them. */
export interface QuantityInfo {
  symbol: string;
  description: string;
}

/**
 * The catalog entry of `quantity`: coolprop-rs's property catalog, or its
 * diagram-axis catalog for specific volume (not a `State` property).
 */
export function quantityInfo(quantity: Quantity): QuantityInfo {
  const cp = coolprop();
  const info =
    cp.properties().find((p) => p.name === quantity) ??
    cp.plotProperties().find((p) => p.name === quantity);
  if (!info)
    throw new Error(`"${quantity}" is not in the coolprop-rs catalogs`);
  return info;
}

/** The catalog entry of a phase; undefined when CoolProp gave none. */
export function phaseInfo(phase: Phase | null): PhaseInfo | undefined {
  return coolprop()
    .phases()
    .find((p) => p.name === phase);
}
