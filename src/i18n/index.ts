/**
 * The page's language, chosen once when it loads: Spanish on the Spanish
 * landing (/es/), else the visitor's saved choice, else English. Changing it saves the choice and loads the page
 * again, so every text (the app's here, and coolprop-rs's: fluid names,
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
    // index.html saves the choice on /es/ too; this holds where storage refuses.
    if (onSpanishLanding()) return "es";
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

/** Whether the page is the Spanish landing, built in Spanish (/es/). */
function onSpanishLanding(): boolean {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return /^\/es\/?$/.test(location.pathname.slice(base.length));
}

/**
 * Saves `next` as the visitor's language and loads the page in it: the
 * landings by their own addresses, any other page again. Where storage
 * refuses, nothing is saved and the page stays as it is.
 */
export function setLocale(next: Locale) {
  if (next === locale) return;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    return;
  }
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const path = location.pathname.slice(base.length);
  if (/^\/?$|^\/es\/?$/.test(path)) {
    location.assign(base + (next === "es" ? "/es/" : "/") + location.search);
  } else location.reload();
}
