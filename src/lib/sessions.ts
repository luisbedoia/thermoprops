/**
 * The last session of each mode, kept in this browser so leaving a page
 * never loses its work: the worksheet's script, and the State Explorer's
 * workspace (its address, which holds the fluid, the units and the states).
 *
 * Storage may be missing or refuse (a private window, cleared site data):
 * then nothing is kept and every page works as before.
 */
import { TEMPLATES } from "../dsl/templates";

const WORKSHEET = "thermoprops.worksheet";
const EXPLORER = "thermoprops.explorer";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Nothing kept: the page still works.
  }
}

// ── Worksheet ────────────────────────────────────────────────────────────────

export const savedWorksheet = () => read(WORKSHEET);
export const saveWorksheet = (source: string) => write(WORKSHEET, source);

/** Whether a script is someone's work: not empty, not an example as it is. */
export function isOwnWork(source: string): boolean {
  return source.trim() !== "" && !TEMPLATES.some((t) => t.source === source);
}

/** "R134a · 4 states": the script's fluid and how many states it defines. */
export function worksheetSummary(source: string): string {
  const fluid =
    /^\s*fluid\s+"?([^"\s#]+)/m.exec(source)?.[1] ??
    /^\s*\w+\s*\[\s*"?([^"\]\s]+)/m.exec(source)?.[1];
  const states = source
    .split("\n")
    .filter((l) => /^\s*\w+\s*(\[[^\]]*\]\s*)?:/.test(l)).length;
  return [fluid, `${states} state${states === 1 ? "" : "s"}`]
    .filter(Boolean)
    .join(" · ");
}

// ── State Explorer ───────────────────────────────────────────────────────────

/** The workspace's query string ("?fluid=Water&…"), when it has states. */
export const savedExplorer = () => read(EXPLORER);
export const saveExplorer = (search: string) => write(EXPLORER, search);
export const clearExplorer = () => write(EXPLORER, null);

/**
 * "Water · 3 states", or null for nothing worth continuing. It only counts
 * the states (the workspace saves itself only with valid ones), so the
 * landing can say it before CoolProp has loaded.
 */
export function explorerSummary(search: string): string | null {
  const params = new URLSearchParams(search);
  const fluid = params.get("fluid");
  const count = countStates(params.get("states"));
  if (!fluid || count === 0) return null;
  return `${fluid} · ${count} state${count === 1 ? "" : "s"}`;
}

function countStates(encoded: string | null): number {
  if (!encoded) return 0;
  try {
    const states = JSON.parse(atob(encoded)) as unknown;
    return Array.isArray(states) ? states.length : 0;
  } catch {
    return 0;
  }
}
