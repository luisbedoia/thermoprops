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
