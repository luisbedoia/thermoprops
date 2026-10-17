import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/**
 * The part of the page the user sees, in layout-viewport px: on iOS the
 * on-screen keyboard shrinks it without resizing the page, and opening it
 * may scroll it down (`top`).
 */
export function useVisualViewport(
  enabled: boolean,
): { top: number; height: number } | null {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !enabled) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setBox((prev) => {
          const next = {
            top: Math.round(vv.offsetTop),
            height: Math.round(vv.height),
          };
          return prev && prev.top === next.top && prev.height === next.height
            ? prev
            : next;
        }),
      );
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      // Forgotten when not in use: never carried over to the next use.
      setBox(null);
    };
  }, [enabled]);
  return enabled ? box : null;
}

/** `value` while `live`; otherwise the last value seen while live. */
export function useFrozenWhile<T>(value: T, live: boolean): T {
  const [frozen, setFrozen] = useState(value);
  // Adjusting state while rendering: React re-renders before committing.
  if (live && frozen !== value) setFrozen(value);
  return live ? value : frozen;
}

/** `value`, once it has stopped changing for `delay` ms. */
export function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}
