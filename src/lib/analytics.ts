/**
 * What people do in the app, told to Google Analytics as events, so the
 * reports show who uses it and not only who visits. index.html loads GA on
 * the published site only; elsewhere (the dev server, tests, the build's
 * render) there is no `gtag` and nothing is sent.
 *
 * Mark them as key events in GA (Admin › Events): `explorer_state`,
 * `worksheet_solve`, `export_csv`, `worksheet_share` and `fluid_open_app`.
 */
type Params = Record<string, string | number>;

declare global {
  interface Window {
    gtag?: (command: "event", name: string, params?: Params) => void;
  }
}

export function track(name: string, params?: Params) {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", name, params);
  } catch {
    // Analytics never stops the app.
  }
}

const sent = new Set<string>();

/** `track`, once per page load: for what happens on every keystroke. */
export function trackOnce(name: string, params?: Params) {
  if (sent.has(name)) return;
  sent.add(name);
  track(name, params);
}
