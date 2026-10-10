import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  assetsInclude: ["**/*.wasm"],
  // coolprop-rs ships a module worker (its async API). Vite defaults to IIFE
  // workers, which inline the wasm glue the worker imports dynamically
  // instead of sharing its chunk with the main bundle.
  worker: {
    format: "es",
  },
  plugins: [
    react(),
    VitePWA({
      base: "/thermoprops/",
      registerType: "autoUpdate",
      // Register the service worker (a deferred script in index.html):
      // without it there is no offline use nor install as an app.
      injectRegister: "script-defer",

      pwaAssets: {
        disabled: false,
        config: true,
      },

      manifest: {
        name: "Thermoprops – Thermodynamic Properties Calculator",
        short_name: "Thermoprops",
        description:
          "Free online calculator for thermodynamic properties of fluids and refrigerants using CoolProp.",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/thermoprops/",
        scope: "/thermoprops/",
      },

      workbox: {
        // wasm included: without it the app loads offline but cannot compute.
        // woff2 only: KaTeX lists it first and every browser with service
        // workers supports it, so its woff/ttf fallbacks are never fetched.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,wasm,woff2}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },

      devOptions: {
        enabled: false,
        navigateFallback: "index.html",
        suppressWarnings: true,
        type: "module",
      },
    }),
  ],
  optimizeDeps: {
    // Pre-bundling would break how the package locates its .wasm.
    exclude: ["@luisbedoia/coolprop-rs-wasm"],
  },
});
