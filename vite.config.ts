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
        // The app's identity: what it was installed as, kept though it now
        // opens on its home.
        id: "/thermoprops/",
        start_url: "/thermoprops/home/",
        scope: "/thermoprops/",
      },

      workbox: {
        // wasm included: without it the app loads offline but cannot compute.
        // woff2 only: KaTeX lists it first and every browser with service
        // workers supports it, so its woff/ttf fallbacks are never fetched.
        // No HTML: precached pages would be answered from the device first,
        // so a reload after a deploy would show the old app. The pages are
        // public/sw-pages.js's: network first, kept for offline use.
        globPatterns: ["**/*.{js,css,svg,png,ico,wasm,woff2}"],
        globIgnores: ["sw-pages.js"],
        navigateFallback: null,
        // Named for the build: a new one is fetched with each new worker.
        importScripts: [`sw-pages.js?${Date.now()}`],
        cleanupOutdatedCaches: true,
        // A new worker takes over as soon as it is installed. Without it,
        // it waits for every tab of the app to close (registerSW.js never
        // asks it to skip waiting), and reloads keep the old app.
        skipWaiting: true,
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
