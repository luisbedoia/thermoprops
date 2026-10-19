// Renders a page at build time (scripts/postbuild.mjs), so its HTML holds
// what React shows: search engines read it, and nothing changes on screen
// when the app starts.
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "./Router";

export function prerender(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return renderToString(
    <MemoryRouter basename={base} initialEntries={[base + path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}
