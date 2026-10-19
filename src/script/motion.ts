/**
 * The keypad's entrance, shared by the keypad (CSS) and the page scrolling
 * the caret's line clear of it (here), so both move as one: same start, same
 * duration, same curve. Keep in step with `.keypad`'s `keypad-in` animation.
 */

export const KEYPAD_IN_MS = 220;

/** cubic-bezier(0.2, 0.8, 0.2, 1), as in the CSS: progress at time t ∈ [0, 1]. */
export function keypadEase(t: number): number {
  const [x1, y1, x2, y2] = [0.2, 0.8, 0.2, 1];
  const bez = (a: number, b: number, s: number) =>
    3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  // Solve x(s) = t for s (x is increasing), then return y(s).
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (bez(x1, x2, mid) < t) lo = mid;
    else hi = mid;
  }
  return bez(y1, y2, (lo + hi) / 2);
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Scrolls the page by `delta` px along the keypad's curve, frame by frame;
 * at once with reduced motion. Returns a cancel function.
 */
export function scrollWithKeypad(delta: number): () => void {
  if (prefersReducedMotion()) {
    window.scrollBy(0, delta);
    return () => {};
  }
  const from = window.scrollY;
  const start = performance.now();
  let frame = 0;
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / KEYPAD_IN_MS);
    window.scrollTo(0, from + delta * keypadEase(t));
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}
