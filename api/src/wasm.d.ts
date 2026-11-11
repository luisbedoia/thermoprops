/** wrangler hands a .wasm import over compiled. */
declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}
