import {
  loadCoolProp,
  loadCoolPropWorker,
  type CoolProp,
  type CoolPropWorker,
  type FluidData,
} from "@luisbedoia/coolprop-rs-wasm";

let instance: CoolPropWorker | null = null;
// TODO(worker, step 2): the state modal and the chart still solve on the main
// thread; drop this once they go through the worker.
let syncInstance: CoolProp | null = null;

/**
 * Starts CoolProp in a Web Worker, so solving never blocks the page. Later
 * calls return the same instance.
 */
export async function initCoolProp(): Promise<CoolPropWorker> {
  [instance, syncInstance] = await Promise.all([
    instance ?? loadCoolPropWorker(),
    syncInstance ?? loadCoolProp(),
  ]);
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

/** The main-thread module, until every solve goes through the worker. */
export function coolpropSync(): CoolProp {
  if (!syncInstance) {
    throw new Error("CoolProp module is not loaded.");
  }
  return syncInstance;
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

/** Replaces the modules, e.g. with test doubles. */
export function setCoolProp(
  cp: CoolPropWorker | null,
  sync: CoolProp | null = null,
): void {
  instance = cp;
  syncInstance = sync;
}
