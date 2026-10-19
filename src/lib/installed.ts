import { useEffect, useState } from "react";

/**
 * Whether the page runs as the installed app (its own window, no browser
 * bar) rather than in a browser tab. The installed app opens on its home
 * (src/home/Home.tsx), not on the website's landing.
 *
 * Keep in step with the redirect in index.html, which does the same before
 * the first paint.
 */
const APP_WINDOW =
  "(display-mode: standalone), (display-mode: minimal-ui), (display-mode: fullscreen), (display-mode: window-controls-overlay)";

export function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const standalone =
    typeof matchMedia === "function" && matchMedia(APP_WINDOW).matches;
  // Safari on iOS, from the home screen.
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone;
  return standalone || ios === true;
}

/**
 * `isInstalled()`, kept up to date: installing from a tab moves the page,
 * as it is and without loading it again, into the app's window. False on
 * the first render, as the built page (the website's) is.
 */
export function useInstalled(): boolean {
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read after hydration, so the first render matches the built page.
    setInstalled(isInstalled());
    if (typeof matchMedia !== "function") return;
    const query = matchMedia(APP_WINDOW);
    const update = () => setInstalled(isInstalled());
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return installed;
}
