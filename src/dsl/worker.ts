/**
 * Runs scripts off the main thread with the synchronous API: one message in
 * (the script), one out (every result), however many states it solves.
 *
 * It loads its own wasm instance, apart from the app's coolprop worker.
 */
import {
  loadCoolProp,
  type CoolProp,
  type StateInputs,
} from "@luisbedoia/coolprop-rs-wasm";
import { evaluate, type Engine, type EngineFluid } from "./evaluate";

/** `fresh`: the page has no result yet, so "unchanged" would not do. */
export type ScriptRequest = { id: number; source: string; fresh: boolean };

const ready = loadCoolProp();

/** Solved states, so editing one line does not solve the others again. */
const cache = new Map<string, ReturnType<EngineFluid["state"]> | Error>();
const CACHE_LIMIT = 5000;
const batches = new Map<string, ReturnType<EngineFluid["states"]>>();
const BATCH_LIMIT = 200;

/** The last result sent, to answer "unchanged" instead of sending it again. */
let lastSent = "";

function cachedEngine(cp: CoolProp): Engine {
  return {
    pairs: () => cp.pairs(),
    fluid(name, options) {
      const f = cp.fluid(name, options);
      // Cached by fluid and reference: h and s differ between references.
      const id = `${f.name}|${f.reference}`;
      return {
        name: f.name,
        state(inputs: StateInputs) {
          const key = `${id}|${JSON.stringify(inputs)}`;
          let hit = cache.get(key);
          if (!hit) {
            try {
              hit = f.state(inputs);
            } catch (e) {
              hit = e instanceof Error ? e : new Error(String(e));
            }
            if (cache.size >= CACHE_LIMIT) cache.clear();
            cache.set(key, hit);
          }
          if (hit instanceof Error) throw hit;
          return hit;
        },
        states(inputs) {
          // The drawn legs: the same batch on every edit that leaves them be.
          const key = `${id}|${JSON.stringify(inputs)}`;
          let hit = batches.get(key);
          if (!hit) {
            hit = f.states(inputs);
            if (batches.size >= BATCH_LIMIT) batches.clear();
            batches.set(key, hit);
          }
          return hit;
        },
      };
    },
  };
}

self.onmessage = async (e: MessageEvent<ScriptRequest>) => {
  const { id, source, fresh } = e.data;
  try {
    const engine = cachedEngine(await ready);
    const result = evaluate(source, engine);
    const json = JSON.stringify(result);
    if (json === lastSent && !fresh) {
      // A comment or spacing edit: the page keeps what it shows.
      self.postMessage({ id, unchanged: true });
      return;
    }
    lastSent = json;
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
