import { useEffect, useState } from "react";

/**
 * Diagnostics for testing on a device (`/script?debug=1`): what the page
 * believes about focus, input mode and keyboards, and the latest focus and
 * touch events, on screen so a screen recording carries them.
 */
export function DebugHud() {
  const [, setTick] = useState(0);
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    const t0 = performance.now();
    const describe = (el: EventTarget | null) => {
      if (!(el instanceof Element)) return "?";
      return (
        el.getAttribute("aria-label") ??
        (el.className && typeof el.className === "string"
          ? `.${el.className.split(" ")[0]}`
          : el.tagName.toLowerCase())
      );
    };
    const push = (text: string) =>
      setEvents((list) =>
        [
          `${((performance.now() - t0) / 1000).toFixed(1)} ${text}`,
          ...list,
        ].slice(0, 7),
      );
    const onEvent = (e: Event) => push(`${e.type} ${describe(e.target)}`);
    const types = ["focusin", "focusout", "pointerdown", "click"];
    types.forEach((t) => document.addEventListener(t, onEvent, true));
    const vv = window.visualViewport;
    const onViewport = () => push(`viewport ${Math.round(vv!.height)}`);
    vv?.addEventListener("resize", onViewport);
    const timer = setInterval(() => setTick((n) => n + 1), 250);
    return () => {
      types.forEach((t) => document.removeEventListener(t, onEvent, true));
      vv?.removeEventListener("resize", onViewport);
      clearInterval(timer);
    };
  }, []);

  const content = document.querySelector(".script-editor .cm-content");
  const vv = window.visualViewport;
  const rect = (sel: string) => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return r ? `${Math.round(r.top)}–${Math.round(r.bottom)}` : "—";
  };
  const rows = [
    `focus: ${content && document.activeElement === content ? "EDITOR" : describe2(document.activeElement)}`,
    `keypad: ${document.querySelector(".keypad") ? (document.querySelector(".keypad--abc") ? "ABC" : "123") : "—"} · inputmode ${document.querySelector(".script-editor .cm-content")?.getAttribute("inputmode") ?? "(text)"}`,
    `viewport: ${Math.round(vv?.height ?? 0)} @${Math.round(vv?.offsetTop ?? 0)} / win ${window.innerHeight} / scrollY ${Math.round(window.scrollY)}`,
    `panel: ${rect("#panel-code")}`,
    `keypad box: ${rect(".keypad")}`,
  ];
  return (
    <div className="debug-hud" aria-hidden="true">
      {rows.map((r) => (
        <div key={r}>{r}</div>
      ))}
      <div className="debug-hud__events">
        {events.map((e, i) => (
          <div key={i}>{e}</div>
        ))}
      </div>
    </div>
  );
}

function describe2(el: Element | null) {
  if (!el || el === document.body) return "body";
  return el.getAttribute("aria-label") ?? el.tagName.toLowerCase();
}
