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

/** Search engines cut (and Bing flags) longer titles. */
export const TITLE_LIMIT = 70;

/**
 * Its title, in the words people search with: water's tables are the
 * "steam tables"; the others', their saturation and superheated tables,
 * said as fully as the fluid's name leaves room for.
 */
export function fluidTitle(page: FluidPage): string {
  const suffix = " | Thermoprops";
  if (page.fluid.name === "Water")
    return tr(
      "Steam tables – Saturated and superheated water",
      "Tablas de vapor – Agua saturada y sobrecalentada",
    ).concat(suffix);
  const name = fluidName(page.fluid, page.data.aliases);
  const said = tr(
    [
      "Saturation and superheated tables, p–h diagram",
      "Saturation and superheated tables",
      "Saturation & superheated tables",
    ],
    [
      "Tablas de saturación y sobrecalentado, diagrama p–h",
      "Tablas de saturación y sobrecalentado",
      "Saturación y sobrecalentado",
    ],
  )
    .map((words) => `${name} – ${words}${suffix}`)
    .find((title) => title.length <= TITLE_LIMIT);
  return said ?? `${name}${suffix}`;
}

export function fluidDescription(page: FluidPage): string {
  const name = page.fluid.display[locale];
  const tc = fmt(page.critical.temperature - 273.15);
  const pc = fmt(page.critical.pressure / 1e6);
  // A pure fluid's normal boiling point: what is most often looked up.
  const boils =
    page.boiling && !page.data.pseudo_pure
      ? fmt(page.boiling.bubble - 273.15)
      : null;
  return tr(
    `${name}: saturation tables by temperature and pressure, superheated vapor table, p–h and T–s diagrams, critical point (${tc} °C, ${pc} MPa)${boils ? ` and normal boiling point (${boils} °C)` : ""}. Calculate any of its states with CoolProp, free.`,
    `${name}: tablas de saturación por temperatura y presión, tabla de vapor sobrecalentado, diagramas p–h y T–s, punto crítico (${tc} °C, ${pc} MPa)${boils ? ` y punto de ebullición normal (${boils} °C)` : ""}. Calcula cualquiera de sus estados con CoolProp, gratis.`,
  );
}

export const FLUIDS_TITLE = tr(
  "Thermodynamic properties of fluids and refrigerants | Thermoprops",
  "Propiedades termodinámicas de fluidos y refrigerantes | Thermoprops",
);

export const FLUIDS_DESCRIPTION = tr(
  "Saturation and superheated vapor tables, p–h and T–s diagrams and critical points of water, air, ammonia, CO₂ and refrigerants such as R134a, R410A, R32 and R1234yf, computed with CoolProp.",
  "Tablas de saturación y de vapor sobrecalentado, diagramas p–h y T–s y puntos críticos del agua, aire, amoníaco, CO₂ y refrigerantes como R134a, R410A, R32 y R1234yf, calculados con CoolProp.",
);

const SITE = "https://luisbedoia.github.io/thermoprops/";

/**
 * Its structured data for search engines (schema.org): the tables as a
 * dataset, and where the page is in the site. `url` is the page's address.
 */
export function fluidStructuredData(page: FluidPage, url: string) {
  const name = fluidName(page.fluid, page.data.aliases);
  const fluids = SITE + (locale === "es" ? "es/fluidos/" : "fluids/");
  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: fluidTitle(page).replace(/ \| Thermoprops$/, ""),
    description: fluidDescription(page),
    url,
    inLanguage: locale,
    keywords: [
      name,
      ...page.data.aliases,
      page.data.cas,
      tr("saturation table", "tabla de saturación"),
      tr("superheated vapor table", "tabla de vapor sobrecalentado"),
      tr("thermodynamic properties", "propiedades termodinámicas"),
    ],
    variableMeasured: [
      tr("Temperature", "Temperatura"),
      tr("Pressure", "Presión"),
      tr("Specific volume", "Volumen específico"),
      tr("Specific internal energy", "Energía interna específica"),
      tr("Specific enthalpy", "Entalpía específica"),
      tr("Specific entropy", "Entropía específica"),
    ],
    isAccessibleForFree: true,
    license: "https://opensource.org/licenses/MIT",
    isBasedOn: {
      "@type": "SoftwareSourceCode",
      name: "CoolProp",
      url: "https://coolprop.org",
    },
    // As index.html names the app's author.
    creator: {
      "@type": "Organization",
      name: "Department of Mechanical Engineering, Universidad de Antioquia",
      parentOrganization: {
        "@type": "CollegeOrUniversity",
        name: "Universidad de Antioquia",
        url: "https://www.udea.edu.co",
      },
    },
    includedInDataCatalog: {
      "@type": "DataCatalog",
      name: FLUIDS_TITLE.replace(/ \| Thermoprops$/, ""),
      url: fluids,
    },
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { name: "Thermoprops", item: SITE + (locale === "es" ? "es/" : "") },
      { name: tr("Fluids", "Fluidos"), item: fluids },
      { name, item: url },
    ].map((e, i) => ({ "@type": "ListItem", position: i + 1, ...e })),
  };
  return [dataset, breadcrumbs] as const;
}
