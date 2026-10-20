import { tr } from "./i18n";

/**
 * Every address with a page of its own in the build, by its folder: "" is
 * the landing, "es" the Spanish one. The only list of them: the build writes
 * each (scripts/postbuild.mjs) and lists them in pages.json, which the
 * service worker reads to keep them for offline use (public/sw-pages.js).
 * Each is a route of src/Router.tsx, which a test checks.
 */
export const BUILT_PAGES = [
  "",
  "es",
  "home",
  "explorer",
  "settings",
  "workspace",
  "worksheet",
  "script",
];

/**
 * The title and summary of the pages search engines should list. The build
 * writes them into each page's HTML (scripts/postbuild.mjs) and the app sets
 * the title as it moves between pages; the others keep the landing's.
 * Built pages are English (the build has no language); the app gives the
 * titles in the visitor's.
 */
export const PAGES: Record<
  string,
  { title: string; description: string; noindex?: boolean }
> = {
  explorer: {
    title: tr(
      "State Explorer – Thermoprops",
      "Explorador de estados – Thermoprops",
    ),
    description:
      "Thermodynamic states of 30 fluids and refrigerants from any two properties: temperature, pressure, enthalpy, entropy, density, quality. Tables and p–h, T–s, h–s, p–v charts, by CoolProp.",
  },
  worksheet: {
    title: tr("Worksheet – Thermoprops", "Hoja de trabajo – Thermoprops"),
    description:
      "Define thermodynamic states as in your notebook, read their properties by name and calculate with them, from a single heat to a whole cycle. Solved by CoolProp as you type, with units and charts. In development: solving for unknowns.",
  },
  // The installed app's home: for the app, not for search results.
  home: {
    title: "Thermoprops",
    description:
      "Thermoprops: the Worksheet and the State Explorer, with what you saved.",
    noindex: true,
  },
};

export const DEFAULT_TITLE = tr(
  "Thermoprops – Thermodynamic Properties Calculator",
  "Thermoprops – Calculadora de propiedades termodinámicas",
);

/**
 * The landing's title and summary in the page's language. The English
 * landing keeps index.html's own; the build gives the Spanish one (/es/)
 * these.
 */
export const LANDING = {
  title: DEFAULT_TITLE,
  description: tr(
    "Free online calculator for thermodynamic properties of fluids and refrigerants. Compute temperature, pressure, enthalpy, entropy, density and more using CoolProp. Ideal for engineers and students in thermodynamics and refrigeration.",
    "Calculadora gratuita en línea de propiedades termodinámicas de fluidos y refrigerantes. Calcula temperatura, presión, entalpía, entropía, densidad y más con CoolProp. Para ingenieros y estudiantes de termodinámica y refrigeración.",
  ),
};

/** The title of the page at a router path ("/explorer", "/workspace"…). */
export function pageTitle(pathname: string): string | null {
  // The fluids' pages name themselves (src/fluids), by their fluid.
  if (/^\/(fluids|es\/fluidos)(\/|$)/.test(pathname)) return null;
  const page = pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
  // The State Explorer's other pages are the State Explorer too.
  const same = page === "settings" || page === "workspace" ? "explorer" : page;
  return PAGES[same]?.title ?? DEFAULT_TITLE;
}

/**
 * The title in the installed app's window, where the browser already puts
 * the app's name first ("Thermoprops - Worksheet"): the page alone.
 */
export function appTitle(pathname: string): string {
  const page = pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
  if (page === "worksheet" || page === "script")
    return tr("Worksheet", "Hoja de trabajo");
  if (page === "explorer" || page === "settings" || page === "workspace")
    return tr("State Explorer", "Explorador de estados");
  return tr("Home", "Inicio");
}
