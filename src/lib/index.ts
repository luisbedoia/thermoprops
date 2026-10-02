import type {
  InputInfo,
  InputName,
  State,
  StateInputs,
} from "@luisbedoia/coolprop-rs-wasm";
import { coolprop } from "../coolprop";

export interface FluidDetails {
  aliases: string[];
  formula?: string;
}

export * from "./plotUtils";
export * from "./quantities";
export * from "./units";
export * from "./unitsFormat";

/** The inputs a state can be defined by, in catalog order. */
export function inputs(): readonly InputInfo[] {
  return coolprop().inputs();
}

export function isInputName(name: string): name is InputName {
  return inputs().some((input) => input.name === name);
}

/** Whether CoolProp can solve a state from these two inputs (either order). */
export function areCompatibleInputs(a: InputName, b: InputName): boolean {
  return coolprop()
    .pairs()
    .some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** The state of `fluid` fixed by two SI inputs. Throws `CoolPropError`. */
export function solveState(
  fluid: string,
  input1: InputName,
  value1: number,
  input2: InputName,
  value2: number,
): State {
  // The names come from runtime data (URL, form), so the pair cannot be
  // checked by TypeScript; CoolProp rejects unsupported pairs.
  const inputs = {
    [input1]: value1,
    [input2]: value2,
  } as unknown as StateInputs;
  return coolprop().fluid(fluid).state(inputs);
}

/** Every curated fluid, sorted by name. */
export function getFluidsList(): string[] {
  return coolprop()
    .catalog()
    .map((fluid) => fluid.name)
    .sort();
}

export function getFluidDetails(fluid: string): FluidDetails {
  const data = coolprop().fluid(fluid).data;
  return { aliases: data.aliases, formula: data.formula || undefined };
}
