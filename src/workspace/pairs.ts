import type { InputName } from "@luisbedoia/coolprop-rs-wasm";
import { coolprop } from "../coolprop";

/** The two inputs of the add-state form, with their values as typed. */
export type PairForm = {
  property1: InputName;
  value1: string;
  property2: InputName;
  value2: string;
};

export type PairSlot = "property1" | "property2";

/** The input the form changed on its own, to keep the pair solvable. */
export type Replacement = { slot: PairSlot; from: InputName; to: InputName };

const VALUE: Record<PairSlot, "value1" | "value2"> = {
  property1: "value1",
  property2: "value2",
};

const OTHER: Record<PairSlot, PairSlot> = {
  property1: "property2",
  property2: "property1",
};

/** Whether CoolProp solves a state from inputs `a` and `b` (either order). */
export function solvable(a: InputName, b: InputName): boolean {
  return coolprop()
    .pairs()
    .some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/**
 * The usual partner of `input`: its partner in the first catalog pair that
 * has it (the catalog lists the common pairs first, e.g. p–T, p–x, T–x).
 */
export function partnerOf(input: InputName): InputName {
  const pair = coolprop()
    .pairs()
    .find(([x, y]) => x === input || y === input);
  if (!pair) throw new Error(`no input pair has "${input}"`);
  return pair[0] === input ? pair[1] : pair[0];
}

/** Swaps the two inputs, values included. */
export function swapPair(form: PairForm): PairForm {
  return {
    property1: form.property2,
    value1: form.value2,
    property2: form.property1,
    value2: form.value1,
  };
}

/**
 * Puts `picked` in `slot`, whatever the other input is:
 * - the other input itself: the two swap, values included;
 * - an input that is solvable with the other: just that;
 * - one that is not: the other input becomes `picked`'s usual partner, and
 *   its value is cleared (it measured something else). That change is
 *   returned, so it can be explained.
 */
export function pickInput(
  form: PairForm,
  slot: PairSlot,
  picked: InputName,
): { form: PairForm; replaced?: Replacement } {
  const other = OTHER[slot];
  if (picked === form[slot]) return { form };
  if (picked === form[other]) return { form: swapPair(form) };
  if (solvable(picked, form[other])) return { form: { ...form, [slot]: picked } };
  const to = partnerOf(picked);
  return {
    form: { ...form, [slot]: picked, [other]: to, [VALUE[other]]: "" },
    replaced: { slot: other, from: form[other], to },
  };
}
