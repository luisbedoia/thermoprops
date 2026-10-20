import { localizedPath, locale } from "../i18n";

/** The fluids' index, or a fluid's page, in the page's language. */
export const fluidsPath = (slug?: string) =>
  localizedPath(slug ? `/fluids/${slug}` : "/fluids", locale)!;
