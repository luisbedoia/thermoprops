/**
 * Editing on a phone, in one place. While `editing`:
 * - the code panel covers the visible area (the style returned here), so
 *   the editor sits right above the on-screen keyboard;
 * - the page behind it does not scroll;
 * - the caret is kept in view as the visible area changes (the keyboard
 *   opening, closing or resizing).
 * When editing ends, the page scrolls to where the caret was.
 *
 * Editing ends only when the editor loses focus (the bar's hide-keyboard
 * button, or tapping elsewhere): nothing here guesses the keyboard's state.
 */
import { useEffect, type CSSProperties } from "react";
import { useVisualViewport } from "./hooks";

export function usePhoneEditing(
  editing: boolean,
  reveal: () => void,
): CSSProperties | undefined {
  const viewport = useVisualViewport(editing);

  useEffect(() => {
    if (!editing) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
      // Back on the page: show where the caret was.
      requestAnimationFrame(reveal);
    };
  }, [editing, reveal]);

  const height = viewport?.height;
  useEffect(() => {
    if (!editing) return;
    const frame = requestAnimationFrame(reveal);
    return () => cancelAnimationFrame(frame);
  }, [editing, height, reveal]);

  return editing && viewport
    ? { top: viewport.top, height: viewport.height }
    : undefined;
}
