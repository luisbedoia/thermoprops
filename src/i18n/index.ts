/**
 * The page's language, chosen once when it loads. The pages with an address
 * in each language (the landing, the fluids' pages: see `localizedPath`) are
 * in their address's; the others in the visitor's saved choice, else
 * English. Changing it saves the choice and loads the page (or its address
 * in the other language) again, so every text (the app's here, and coolprop-rs's: fluid names,
 * property descriptions, errors) comes in the new one. The work in progress
 * is kept in this browser (lib/sessions.ts), so nothing is lost.
 *
 * Workers cannot read storage: their page passes the language in their name
 * (`workerName`).
 */
export type Locale = "en" | "es";

export const LOCALES: readonly Locale[] = ["en", "es"];

/** Each language in itself, for the switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

const KEY = "thermoprops.locale";

const isLocale = (value: unknown): value is Locale =>
  value === "en" || value === "es";

function detect(): Locale {
  try {
    if (typeof window === "undefined") {
      // A worker ("script:es"), or the build's prerender (no name: English).
      const name = (globalThis as { name?: string }).name ?? "";
      const tag = name.slice(name.lastIndexOf(":") + 1);
      return isLocale(tag) ? tag : "en";
    }
    // index.html saves the choice on Spanish addresses too; this holds where
    // storage refuses.
    const own = addressLocale(appPath());
    if (own) return own;
    const saved = localStorage.getItem(KEY);
    return isLocale(saved) ? saved : "en";
  } catch {
    return "en";
  }
}

export const locale: Locale = detect();

/**
 * A text in the page's language, written beside its translation so the two
 * are read and changed together: `tr("Close", "Cerrar")`. Also for markup:
 * `tr(<>See <code>x</code></>, <>Ver <code>x</code></>)`.
 */
export const tr = <T>(en: T, es: T): T => (locale === "es" ? es : en);

/** "1 state", "3 states": `n` with the word in its number. */
export const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** A worker's name carrying the page's language, read back by `detect`. */
export const workerName = (name: string) => `${name}:${locale}`;

/** The landing in a language: "/" (English) or "/es" (Spanish), router paths. */
export const landingPath = (l: Locale = locale) => (l === "es" ? "/es" : "/");

/**
 * A page with an address in each language, in `l`: the landing ("/",
 * "/es") and the fluids' pages ("/fluids/r134a", "/es/fluidos/r134a"),
 * router paths. Null for the app's pages, which have one address for both.
 * Keep in step with index.html, which takes Spanish visitors to theirs.
 */
export function localizedPath(path: string, l: Locale): string | null {
  const p = path.replace(/\/+$/, "") || "/";
  if (p === "/" || p === "/es") return landingPath(l);
  const fluids = /^(?:\/fluids|\/es\/fluidos)(\/[^/]+)?$/.exec(p);
  if (fluids)
    return (l === "es" ? "/es/fluidos" : "/fluids") + (fluids[1] ?? "");
  return null;
}

/** The language a page's address is in: Spanish under /es, English for /fluids. */
function addressLocale(path: string): Locale | null {
  if (/^\/es(\/|$)/.test(path)) return "es";
  if (/^\/fluids(\/|$)/.test(path)) return "en";
  return null;
}

/** The page's router path: the address without the app's base. */
function appPath(): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return location.pathname.slice(base.length) || "/";
}

/**
 * Saves `next` as the visitor's language and loads the page in it: those
 * with an address per language by theirs, any other page again. Where
 * storage refuses, nothing is saved and the page stays as it is.
 */
export function setLocale(next: Locale) {
  if (next === locale) return;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    return;
  }
  const other = localizedPath(appPath(), next);
  if (other === null) return location.reload();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  // Folder-style, as the built pages are served: "/es/", "/fluids/r134a/".
  location.assign(base + (other === "/" ? "/" : `${other}/`) + location.search);
}
