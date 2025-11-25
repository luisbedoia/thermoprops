import { EmbindModule } from '@luisbedoia/coolprop-wasm';

declare module "@luisbedoia/coolprop-wasm" {
  interface EmbindModule {
    get_global_param_string?: (param: string) => string;
  }
}

declare global {
  interface Window {
    CP: EmbindModule;
  }
}

export {};

