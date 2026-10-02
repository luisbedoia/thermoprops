import { loadCoolProp, type CoolProp } from "@luisbedoia/coolprop-rs-wasm";

let instance: CoolProp | null = null;

/** Loads the CoolProp module once; later calls return the same instance. */
export async function initCoolProp(): Promise<CoolProp> {
  instance ??= await loadCoolProp();
  return instance;
}

/** The loaded module. The app renders only after `initCoolProp` resolves. */
export function coolprop(): CoolProp {
  if (!instance) {
    throw new Error("CoolProp module is not loaded.");
  }
  return instance;
}

/** Replaces the module, e.g. with a test double. */
export function setCoolProp(cp: CoolProp | null): void {
  instance = cp;
}
