/**
 * The fluids' pages' data worked out in the browser, for a page opened
 * within the app (the built ones carry theirs: see pageData.ts).
 */
import { initCoolProp } from "../coolprop";
import { fluidPage, fluidSummaries, type FluidSummary } from "./data";

let summaries: Promise<FluidSummary[]> | null = null;

/** Every fluid, with its display name in the page's language. */
export function loadSummaries(): Promise<FluidSummary[]> {
  summaries ??= initCoolProp().then((cp) => {
    const names = new Map(cp.catalog().map((f) => [f.name, f.display_name]));
    return fluidSummaries(cp, { en: names, es: names });
  });
  return summaries;
}

/** The page of the fluid at `slug`; null for none. */
export async function loadFluidPage(slug: string) {
  const all = await loadSummaries();
  const fluid = all.find((f) => f.slug === slug);
  return fluid ? fluidPage(await initCoolProp(), fluid, all) : null;
}
