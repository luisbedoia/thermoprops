import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  assetsInclude: ["**/*.wasm"],
  plugins: [
    react(),
    VitePWA({
      base: "/thermoprops/",
      registerType: "autoUpdate",
      injectRegister: false,

      pwaAssets: {
        disabled: false,
        config: true,
      },

      manifest: {
        name: "thermoprops",
        short_name: "thermoprops",
        description: "thermoprops",
        theme_color: "#ffffff",
      },

      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
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
    exclude: ["@luisbedoia/coolprop-wasm"],
  },
  ssr: {
    noExternal: ["@luisbedoia/coolprop-wasm"],
  },
});
