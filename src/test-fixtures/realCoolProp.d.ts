import type { CoolProp } from "@luisbedoia/coolprop-rs-wasm";

/** The real coolprop-rs wasm module, loaded once in Node. */
export function loadRealCoolProp(): Promise<CoolProp>;
