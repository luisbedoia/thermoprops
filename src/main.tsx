import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./index.css";
import "./layout/AppLayout.css";
import App from "./App.tsx";
import { initCoolProp } from "./coolprop";
import { locale } from "./i18n";

// CoolProp starts loading at once; the pages that compute wait for it.
void initCoolProp().catch(() => {});

const root = document.getElementById("root")!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// A built page (src/prerender.tsx) is taken over as it is, so nothing on
// screen changes or starts again; the dev server's page is empty. A built
// page in another language than the visitor's (index.html notes the built
// one, and hides it) is drawn anew.
const built = document.documentElement.dataset.built ?? "en";
document.documentElement.lang = locale;
if (root.firstElementChild && built === locale) hydrateRoot(root, app);
else {
  createRoot(root).render(app);
  requestAnimationFrame(() =>
    document.documentElement.classList.remove("locale-pending"),
  );
}
