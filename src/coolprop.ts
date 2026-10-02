import { loadCoolProp } from "@luisbedoia/coolprop-rs-wasm";

/**
 * Loads both CoolProp modules in parallel:
 * - `cpp`: the C++ build, still used for the plots.
 * - `rs`: coolprop-rs, used for states and fluid metadata.
 */
export async function CP() {
  const [cpp, rs] = await Promise.all([
    import("@luisbedoia/coolprop-wasm").then((m) => m.default()),
    loadCoolProp(),
  ]);
  return { cpp, rs };
}
