import { useEffect, useRef } from "react";

/** Moving more than this between touchstart and touchend is a scroll. */
const SLOP = 10;

/**
 * Handlers that act on a tap without taking the focus off the editor (and
 * its caret). A tap moves the focus on the mouse events
 * the browser synthesizes after `touchend`:
 * - cancelling `touchend` cancels them (and the click), and the tap acts
 *   there;
 * - inside a row that can scroll, `touchend` may come uncancellable (the
 *   touch might have been a scroll): then the tap acts on the click that
 *   follows, and cancelling `mousedown` keeps the focus where it is.
 * Either way it acts once. A finger that moved was scrolling: no action.
 * Mouse and keyboard activation go through `click` too.
 */
export function useTap() {
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  /** When a touch last acted (or a held key repeated): its click is spent. */
  const actedAt = useRef(0);
  const repeat = useRef<{ delay?: number; every?: number }>({});
  const stopRepeat = () => {
    clearTimeout(repeat.current.delay);
    clearInterval(repeat.current.every);
    repeat.current = {};
  };
  useEffect(() => stopRepeat, []);

  return (act: () => void, opts: { repeat?: boolean } = {}) => ({
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY, moved: false };
      if (opts.repeat) {
        stopRepeat();
        repeat.current.delay = window.setTimeout(() => {
          act();
          repeat.current.every = window.setInterval(act, 70);
        }, 400);
      }
    },
    onTouchMove: (e: React.TouchEvent) => {
      const s = start.current;
      const t = e.touches[0];
      if (s && Math.hypot(t.clientX - s.x, t.clientY - s.y) > SLOP) {
        s.moved = true;
        stopRepeat();
      }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current;
      start.current = null;
      const held = repeat.current.every !== undefined;
      stopRepeat();
      if (!s || s.moved) return;
      // A held key already acted while held; its click is spent too.
      if (held) {
        actedAt.current = Date.now();
        if (e.cancelable) e.preventDefault();
        return;
      }
      if (!e.cancelable) return; // the click acts
      e.preventDefault();
      actedAt.current = Date.now();
      act();
    },
    onTouchCancel: () => {
      start.current = null;
      stopRepeat();
    },
    // Keeps the focus (and the keyboard) where it is.
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => {
      if (Date.now() - actedAt.current < 700) return;
      act();
    },
  });
}
