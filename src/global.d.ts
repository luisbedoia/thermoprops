import { EmbindModule } from '@luisbedoia/coolprop-wasm';

declare global {
  interface Window {
    CP: EmbindModule;
  }
}

export {};

