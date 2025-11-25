export async function CP() {
  const coolprop = await import("@luisbedoia/coolprop-wasm");
  const instance = await coolprop.default();
  return instance;
}