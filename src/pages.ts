/**
 * The title and summary of the pages search engines should list. The build
 * writes them into each page's HTML (scripts/postbuild.mjs) and the app sets
 * the title as it moves between pages; the others keep the landing's.
 */
export const PAGES: Record<string, { title: string; description: string }> = {
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
};

export const DEFAULT_TITLE =
  "Thermoprops – Thermodynamic Properties Calculator";

/** The title of the page at a router path ("/explorer", "/workspace"…). */
export function pageTitle(pathname: string): string {
  const page = pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
  return PAGES[page]?.title ?? DEFAULT_TITLE;
}
