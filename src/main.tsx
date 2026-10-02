import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./layout/AppLayout.css";
import App from "./App.tsx";
import { initCoolProp } from "./coolprop";

// The static shell in index.html stays on screen (and visible to crawlers)
// until CoolProp is ready; only then does React take over #root.
const root = createRoot(document.getElementById("root")!);

initCoolProp()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((error) => {
    console.error("Error loading library", error);
    root.render(
      <div className="app-loader error">Unable to load CoolProp module.</div>,
    );
  });
