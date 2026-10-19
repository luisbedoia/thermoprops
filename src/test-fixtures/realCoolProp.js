// Loads the real coolprop-rs wasm module in Node, for tests that solve.
import { readFile } from "node:fs/promises";
import { loadCoolProp } from "@luisbedoia/coolprop-rs-wasm";

let loading;

export function loadRealCoolProp() {
  if (!loading) {
    // The wasm build locates its binary with fetch, which Node lacks for file:.
    const nodeFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      const href = String(url);
      if (!href.startsWith("file:")) return nodeFetch(url, init);
      return new Response(await readFile(new URL(href)), {
        headers: { "content-type": "application/wasm" },
      });
    };
    loading = loadCoolProp();
  }
  return loading;
}
