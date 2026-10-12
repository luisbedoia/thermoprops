import {
  loadCoolPropWorker,
  type CoolPropWorker,
  type FluidData,
} from "@luisbedoia/coolprop-rs-wasm";

let instance: CoolPropWorker | null = null;

/**
 * Starts CoolProp in a Web Worker, so solving never blocks the page. Later
 * calls return the same instance.
 */
export async function initCoolProp(): Promise<CoolPropWorker> {
  instance ??= await loadCoolPropWorker();
  return instance;
}

/**
 * The loaded module. The app renders only after `initCoolProp` resolves.
 * Catalogs and schema answer synchronously; solving returns promises.
 */
export function coolprop(): CoolPropWorker {
  if (!instance) {
    throw new Error("CoolProp module is not loaded.");
  }
  return instance;
}

/**
 * The catalog entry of a fluid, by canonical name or alias, without opening
 * it in the worker.
 */
export function fluidData(name: string): FluidData {
  const data = coolprop()
    .catalog()
    .find((f) => f.name === name || f.aliases.includes(name));
  if (!data) {
    throw new Error(`"${name}" is not in the CoolProp catalog.`);
  }
  return data;
}

/** Replaces the module, e.g. with a test double. */
export function setCoolProp(cp: CoolPropWorker | null): void {
  instance = cp;
}
