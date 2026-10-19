/**
 * The title and summary of the pages search engines should list. The build
 * writes them into each page's HTML (scripts/postbuild.mjs) and the app sets
 * the title as it moves between pages; the others keep the landing's.
 */
export const PAGES: Record<
  string,
  { title: string; description: string; noindex?: boolean }
> = {
  explorer: {
    title: "State Explorer – Thermoprops",
    description:
      "Thermodynamic states of 30 fluids and refrigerants from any two properties: temperature, pressure, enthalpy, entropy, density, quality. Tables and p–h, T–s, h–s, p–v charts, by CoolProp.",
  },
  worksheet: {
    title: "Worksheet – Thermoprops",
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

export const DEFAULT_TITLE =
  "Thermoprops – Thermodynamic Properties Calculator";

/** The title of the page at a router path ("/explorer", "/workspace"…). */
export function pageTitle(pathname: string): string {
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
  if (page === "worksheet" || page === "script") return "Worksheet";
  if (page === "explorer" || page === "settings" || page === "workspace")
    return "State Explorer";
  return "Home";
}
