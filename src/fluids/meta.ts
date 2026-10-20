/**
 * The fluids' pages' titles and summaries, in the page's language: what
 * search results show (scripts/postbuild.mjs) and the window's title.
 */
import { locale, tr } from "../i18n";
import type { FluidPage, FluidSummary } from "./data";

/** Its display name, with its refrigerant number when that is another name. */
export function fluidName(f: FluidSummary, aliases: readonly string[] = []) {
  const name = f.display[locale];
  const number = aliases.find((a) => /^R-?\d/i.test(a) && a !== name);
  return number && !/^R\d/.test(name) ? `${name} (${number})` : name;
}

const fmt = (v: number) => String(Number(v.toPrecision(4)));

export function fluidTitle(page: FluidPage): string {
  const name = fluidName(page.fluid, page.data.aliases);
  return tr(
    `${name} – Thermodynamic properties, saturation table and p–h diagram | Thermoprops`,
    `${name} – Propiedades termodinámicas, tabla de saturación y diagrama p–h | Thermoprops`,
  );
}

export function fluidDescription(page: FluidPage): string {
  const name = page.fluid.display[locale];
  const tc = fmt(page.critical.temperature - 273.15);
  const pc = fmt(page.critical.pressure / 1e6);
  return tr(
    `${name}: saturation table (pressure, specific volume, enthalpy, entropy), p–h and T–s diagrams and critical point (${tc} °C, ${pc} MPa). Calculate any of its states with CoolProp, free.`,
    `${name}: tabla de saturación (presión, volumen específico, entalpía, entropía), diagramas p–h y T–s y punto crítico (${tc} °C, ${pc} MPa). Calcula cualquiera de sus estados con CoolProp, gratis.`,
  );
}

export const FLUIDS_TITLE = tr(
  "Thermodynamic properties of fluids and refrigerants | Thermoprops",
  "Propiedades termodinámicas de fluidos y refrigerantes | Thermoprops",
);

export const FLUIDS_DESCRIPTION = tr(
  "Saturation tables, p–h and T–s diagrams and critical points of water, air, ammonia, CO₂ and refrigerants such as R134a, R410A, R32 and R1234yf, computed with CoolProp.",
  "Tablas de saturación, diagramas p–h y T–s y puntos críticos del agua, aire, amoníaco, CO₂ y refrigerantes como R134a, R410A, R32 y R1234yf, calculados con CoolProp.",
);
