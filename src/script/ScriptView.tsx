import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen,
  ChartLine,
  Check,
  CircleCheck,
  Code,
  Keyboard,
  LayoutTemplate,
  ListChecks,
  LoaderCircle,
  Share2,
  TriangleAlert,
  WandSparkles,
} from "lucide-react";
import type { InputName, State } from "@luisbedoia/coolprop-rs-wasm";
import { Button } from "../components/Button";
import { coolprop } from "../coolprop";
import { ThermoPlot } from "../Plot";
import type { PlotExtent, PlotPoint } from "../Plot";
import { SCRIPT_LOOK, type PlotPath } from "../lib/plotUtils";
import { quantityValue } from "../lib/quantities";
import type { ScriptResult } from "../dsl/evaluate";
import {
  ScriptEditor,
  type ScriptEditorHandle,
} from "../dsl/editor/ScriptEditor";
import { TEMPLATES } from "../dsl/templates";
import { isOwnWork, savedWorksheet, saveWorksheet } from "../lib/sessions";
import { useScript } from "../dsl/useScript";
import { useDebounced, useFrozenWhile, useMediaQuery } from "./hooks";
import { ReferencePanel } from "./ReferencePanel";
import { ResultsPanel } from "./ResultsPanel";
import { Keypad, type KeypadAction } from "./Keypad";
import { KEYPAD_IN_MS, scrollWithKeypad } from "./motion";
import { DebugHud } from "./DebugHud";
import type { Suggestions } from "../dsl/editor/completions";
import { count, tr } from "../i18n";
import "./ScriptView.css";

type Tab = "code" | "results" | "chart" | "reference";

const WIDE = "(min-width: 1024px)";
const UNDO_KEYS =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    ? "⌘ Z"
    : "Ctrl Z";
/** The format shortcut as CodeMirror reads it on this platform. */
const FORMAT_KEYS =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    ? "⌘ ⇧ F"
    : "Ctrl Shift F";
const TOUCH = "(pointer: coarse)";

/**
 * The fluids with solved states, the script's own first, then by how many
 * states each has: the chart shows one at a time.
 */
function chartFluids(result: ScriptResult | undefined): string[] {
  const count = new Map<string, number>();
  for (const s of result?.states ?? [])
    if (s.state && s.fluid) count.set(s.fluid, (count.get(s.fluid) ?? 0) + 1);
  return [...count.keys()].sort(
    (a, b) =>
      Number(b === result?.fluid) - Number(a === result?.fluid) ||
      count.get(b)! - count.get(a)!,
  );
}

function plotData(
  result: ScriptResult | undefined,
  diagramId: string,
  fluid: string | undefined,
) {
  const diagram = coolprop()
    .diagrams()
    .find((d) => d.id === diagramId);
  if (!result || !fluid || !diagram)
    return {
      points: [],
      paths: [],
      extent: undefined,
      isolineValues: undefined,
      focus: "dome" as const,
    };
  const { x, y } = diagram;
  const points: PlotPoint[] = result.states.flatMap((s) =>
    s.state && s.fluid === fluid
      ? [
          {
            id: s.name,
            label: s.name,
            x: quantityValue(s.state, x.property) ?? NaN,
            y: quantityValue(s.state, y.property) ?? NaN,
          },
        ]
      : [],
  );
  const defined = result.states.flatMap((s) =>
    s.state && s.fluid === fluid ? [s.state] : [],
  );
  const legs = result.paths.filter((p) => p.fluid === fluid);
  // How far the domain must reach: the states and the paths between them,
  // rounded outward so editing does not recompute the diagram every time.
  const shown = [...defined, ...legs.flatMap((p) => p.states)];
  const reach = (values: number[]): [number, number] | undefined => {
    const v = values.filter((x) => x > 0);
    if (!v.length) return undefined;
    const r = (x: number, f: (n: number) => number) =>
      10 ** (f(Math.log10(x) * 8) / 8);
    return [r(Math.min(...v), Math.floor), r(Math.max(...v), Math.ceil)];
  };
  const extent: PlotExtent = {
    temperature: reach(shown.map((s) => s.temperature)),
    pressure: reach(shown.map((s) => s.pressure)),
  };
  // The isolines go through the defined states: one per distinct value.
  const through = (get: (s: State) => number | null | undefined) =>
    distinct(
      defined
        .map(get)
        .filter(
          (v): v is number => typeof v === "number" && Number.isFinite(v),
        ),
    );
  const isolineValues: Partial<Record<InputName, number[]>> = {
    temperature: through((s) => s.temperature),
    pressure: through((s) => s.pressure),
    density: through((s) => s.density),
    enthalpy: through((s) => s.enthalpy),
    entropy: through((s) => s.entropy),
    internal_energy: through((s) => s.internal_energy),
    quality: through((s) =>
      s.quality !== null && s.quality > 0 && s.quality < 1 ? s.quality : null,
    ),
  };
  const paths: PlotPath[] = result.paths
    .filter((p) => p.fluid === fluid)
    .map((p) => ({
      label: `${p.from} → ${p.to}`,
      kind: p.kind,
      x: p.states.map((s) => quantityValue(s, x.property) ?? NaN),
      y: p.states.map((s) => quantityValue(s, y.property) ?? NaN),
    }));
  // Drawn processes are centered; lone states are shown against the dome.
  const focus = paths.length > 0 ? ("points" as const) : ("dome" as const);
  return { points, paths, extent, isolineValues, focus };
}

/** Sorted, with values within 0.1 % of the largest merged into one. */
function distinct(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const scale = Math.max(...sorted.map(Math.abs), 0);
  return sorted.filter((v, i) => i === 0 || v - sorted[i - 1] > scale * 1e-3);
}

const problemsCount = (n: number) =>
  count(n, tr("problem", "problema"), tr("problems", "problemas"));

function Status({
  pending,
  slow,
  error,
  result,
  ms,
  onGoTo,
}: {
  pending: boolean;
  slow: boolean;
  error?: string;
  result?: ScriptResult;
  ms?: number;
  onGoTo(line: number, col: number): void;
}) {
  if (pending && !result) {
    return (
      <span className="status">
        <LoaderCircle className="spin" />{" "}
        {tr("Loading the solver…", "Cargando el solucionador…")}
      </span>
    );
  }
  if (error) {
    return (
      <span className="status status--error">
        <TriangleAlert /> {error}
      </span>
    );
  }
  if (!result) return null;
  const n = result.diagnostics.length;
  const icon = slow ? (
    <LoaderCircle className="spin" />
  ) : n ? (
    <TriangleAlert />
  ) : (
    <CircleCheck />
  );
  const timing = !slow && ms !== undefined && (
    <span className="status__ms">{ms.toFixed(0)} ms</span>
  );
  if (n) {
    const first = result.diagnostics[0];
    // Goes to the first problem, which is written under its line.
    return (
      <button
        type="button"
        className="status status--error status--button"
        onClick={() => onGoTo(first.line, first.col)}
      >
        {icon}
        {problemsCount(n)}
        <span className="status__where">
          · {tr("line", "línea")} {first.line}
        </span>
        {timing}
      </button>
    );
  }
  const states = result.states.length;
  return (
    <span className="status status--ok">
      {icon}
      {tr(
        `${count(states, "state", "states")} solved`,
        count(states, "estado resuelto", "estados resueltos"),
      )}
      {timing}
    </span>
  );
}

/** A code line's height, and the room kept around the caret's line (px). */
const LINE = 26;
const CLEAR = 12;

/**
 * How far down the screen is covered by what sticks to the top (the app's
 * header; the view's tabs when stuck), in px.
 */
function coveredTop(): number {
  let bottom = 0;
  for (const el of document.querySelectorAll<HTMLElement>(
    ".app-header, .sv__tabs",
  )) {
    const style = getComputedStyle(el);
    if (style.position !== "sticky" && style.position !== "fixed") continue;
    const r = el.getBoundingClientRect();
    // Stuck at its offset (not merely in its place in the page).
    const stuck = r.top <= (parseFloat(style.top) || 0) + 1;
    if (stuck && r.bottom > bottom) bottom = r.bottom;
  }
  return bottom;
}

const KEYPAD_PREF = "thermoprops.script.keypad";

/** Whether this viewer wants the keypad on touch screens (default: yes). */
function readKeypadPref(): boolean {
  try {
    return localStorage.getItem(KEYPAD_PREF) !== "off";
  } catch {
    return true;
  }
}

function writeKeypadPref(on: boolean) {
  try {
    localStorage.setItem(KEYPAD_PREF, on ? "on" : "off");
  } catch {
    // Storage unavailable (private mode): the choice lasts this visit.
  }
}

export function ScriptView() {
  const [params, setParams] = useSearchParams();
  // A link's script, else this browser's last worksheet, else the first
  // example.
  const [initial] = useState(
    () => params.get("s") ?? savedWorksheet() ?? TEMPLATES[0].source,
  );
  const [source, setSource] = useState(initial);
  const [debug] = useState(() => params.get("debug") === "1");
  const editor = useRef<ScriptEditorHandle | null>(null);
  const { result, error, ms, pending, slow } = useScript(source);

  const wide = useMediaQuery(WIDE);
  const touch = useMediaQuery(TOUCH);
  // Focus anywhere in the code panel.
  const [focused, setFocused] = useState(false);
  const phone = touch && !wide;
  // Touch screens type through the page's keypad (the system keyboard is
  // never used), unless turned off (an iPad with a keyboard, say).
  const [keypadWanted, setKeypadWanted] = useState(readKeypadPref);
  const keypad = touch && keypadWanted;
  const editing = keypad && focused;
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  // Phones: the keypad is fixed at the bottom of the screen, over the page,
  // which does not move: the caret's line is kept clear of it, and the page
  // gets its height of room at the end. Tablets keep both columns, the
  // keypad at the bottom of the code's.
  const [keypadHeight, setKeypadHeight] = useState(0);
  // Touch screens, phones and tablets alike: the code is part of the page
  // (no scroller of its own) and the keypad is fixed at the bottom of the
  // screen, over the code's column.
  const inset = editing ? keypadHeight : 0;
  // Where the tap that started editing was: the line under the finger is
  // known from the start (the editor moves its caret there only later).
  const tapY = useRef<number | null>(null);
  // While the keypad comes in, the page's scroll is its own (see below).
  const openingUntil = useRef(0);
  // Tablets: the fixed keypad spans the code's column, not the screen.
  const [columnBox, setColumnBox] = useState<{ left: number; width: number }>();
  useEffect(() => {
    if (!editing || !wide) return;
    const el = document.getElementById("panel-code");
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setColumnBox({ left: Math.round(r.left), width: Math.round(r.width) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [editing, wide]);
  const touchNow = useRef(touch);
  useLayoutEffect(() => {
    touchNow.current = touch;
  });
  const keypadBox = useCallback((el: HTMLDivElement | null) => {
    if (!el) {
      setKeypadHeight(0);
      return;
    }
    const observer = new ResizeObserver(() => setKeypadHeight(el.offsetHeight));
    observer.observe(el);
    setKeypadHeight(el.offsetHeight);
    // The keypad comes up from below (CSS); if it will cover the tapped
    // line, the page lifts the line along with it: same start, duration and
    // curve, so they move as one.
    let cancel = () => {};
    if (touchNow.current) {
      const lineY = tapY.current ?? (editor.current?.lineTop() ?? 0) + LINE / 2;
      const covered =
        lineY + LINE / 2 + CLEAR - (window.innerHeight - el.offsetHeight);
      if (covered > 0) {
        openingUntil.current = performance.now() + KEYPAD_IN_MS + 60;
        cancel = scrollWithKeypad(covered);
      }
    }
    tapY.current = null;
    return () => {
      cancel();
      observer.disconnect();
    };
  }, []);
  // Keep the caret's line clear of the keypad (not while it comes in: the
  // page is already lifting the line with it).
  // Keep it clear of what covers the top of the screen too (the sticky
  // header), so the first lines are not hidden under it.
  const clearCaret = useCallback(
    (behavior: ScrollBehavior) => {
      if (!inset || performance.now() < openingUntil.current) return;
      const box = editor.current?.lineBox();
      if (!box) return;
      const below = box.bottom + CLEAR - (window.innerHeight - inset);
      const above = coveredTop() + CLEAR - box.top;
      if (below > 0) window.scrollBy({ top: below, behavior });
      else if (above > 0) window.scrollBy({ top: -above, behavior });
    },
    [inset],
  );
  // Keep the caret's line above the keypad: at once while typing (the line
  // follows the text), smoothly when only the caret moved (a tap, an arrow).
  const onCaretMoved = useCallback(
    (typed: boolean) => {
      clearCaret(typed ? "auto" : "smooth");
      // Once more next frame, should anything have moved in between.
      if (typed) requestAnimationFrame(() => clearCaret("auto"));
    },
    [clearCaret],
  );
  // Checks of our own, not only on our own moves: once the keypad is in
  // (Safari scrolls the page when the text gets the focus, after our lift,
  // and may undo it), again a moment later (its scroll can be slow), and
  // whenever the room on screen changes (the browser's bars, rotation, the
  // keypad's own height). Never on a scroll by the user: that one is theirs.
  useEffect(() => {
    if (!inset) return;
    const timers = [KEYPAD_IN_MS + 120, 700].map((ms) =>
      window.setTimeout(() => clearCaret("smooth"), ms),
    );
    let resized = 0;
    const onResize = () => {
      clearTimeout(resized);
      resized = window.setTimeout(() => clearCaret("smooth"), 120);
    };
    window.visualViewport?.addEventListener("resize", onResize);
    window.addEventListener("resize", onResize);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(resized);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.removeEventListener("resize", onResize);
    };
  }, [inset, clearCaret]);
  // The page scrolled, but not by the user (Safari scrolls when the text
  // gets the focus, at its own moment): once it settles, the caret's line
  // clear again. The user's own scrolls start with a finger on the page
  // (not on the keypad) and coast a while after it lifts: those are left be.
  useEffect(() => {
    if (!inset) return;
    // A finger sliding on the page (not a tap: a tap on the text is what
    // makes Safari scroll), and when it lifted.
    let start: { x: number; y: number } | null = null;
    let sliding = false;
    let liftedAt = 0;
    let settle = 0;
    const isPageTouch = (e: TouchEvent) =>
      !(e.target as Element | null)?.closest?.(".keypad");
    const onStart = (e: TouchEvent) => {
      if (!isPageTouch(e)) return;
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY };
      sliding = false;
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (start && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) {
        sliding = true;
      }
    };
    const onEnd = () => {
      if (start && sliding) liftedAt = performance.now();
      start = null;
      sliding = false;
    };
    const onWheel = () => {
      liftedAt = performance.now();
    };
    const onScroll = () => {
      const now = performance.now();
      if (sliding || now - liftedAt < 1500 || now < openingUntil.current) {
        return;
      }
      clearTimeout(settle);
      settle = window.setTimeout(() => clearCaret("smooth"), 120);
    };
    document.addEventListener("touchstart", onStart, {
      capture: true,
      passive: true,
    });
    document.addEventListener("touchend", onEnd, {
      capture: true,
      passive: true,
    });
    document.addEventListener("touchcancel", onEnd, {
      capture: true,
      passive: true,
    });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(settle);
      document.removeEventListener("touchstart", onStart, { capture: true });
      document.removeEventListener("touchmove", onMove, { capture: true });
      document.removeEventListener("touchend", onEnd, { capture: true });
      document.removeEventListener("touchcancel", onEnd, { capture: true });
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
    };
  }, [inset, clearCaret]);
  const toggleKeypad = () => {
    const next = !keypadWanted;
    setKeypadWanted(next);
    writeKeypadPref(next);
  };
  const [tab, setTab] = useState<Tab>("code");
  const sideTab: Tab = wide && tab === "code" ? "results" : tab;
  const chartVisible = sideTab === "chart";
  // The chart is drawn ahead, out of sight, once the page has been quiet
  // for a while (no typing, scrolling or touching: drawing it takes the main
  // thread a moment), so its tab opens at once. Out of sight, it does not
  // redraw.
  const [chartWarm, setChartWarm] = useState(false);
  const hasResult = result !== undefined;
  useEffect(() => {
    if (!hasResult || chartWarm) return;
    let quiet: number | undefined;
    let idle: number | undefined;
    const cancelIdle = () => {
      if (idle === undefined) return;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else clearTimeout(idle);
      idle = undefined;
    };
    const restart = () => {
      clearTimeout(quiet);
      cancelIdle();
      quiet = window.setTimeout(() => {
        idle = window.requestIdleCallback
          ? window.requestIdleCallback(() => setChartWarm(true), {
              timeout: 3000,
            })
          : window.setTimeout(() => setChartWarm(true), 0);
      }, 2000);
    };
    const events = ["scroll", "touchstart", "pointerdown", "keydown", "wheel"];
    const options = { capture: true, passive: true };
    events.forEach((e) => window.addEventListener(e, restart, options));
    restart();
    return () => {
      clearTimeout(quiet);
      cancelIdle();
      events.forEach((e) => window.removeEventListener(e, restart, options));
    };
  }, [hasResult, chartWarm]);

  const [diagramId, setDiagramId] = useState(() => {
    const t = TEMPLATES.find((x) => x.source === initial);
    return t?.diagram ?? "pressure_enthalpy";
  });
  const diagrams = coolprop().diagrams();
  const diagram = diagrams.find((d) => d.id === diagramId) ?? diagrams[0];
  const [isoline, setIsoline] = useState<InputName>(diagram.isolines[0]);
  const isolineKind = diagram.isolines.includes(isoline)
    ? isoline
    : diagram.isolines[0];
  const fluids = useMemo(() => chartFluids(result), [result]);
  const [pickedFluid, setPickedFluid] = useState<string>();
  const chartFluid =
    pickedFluid && fluids.includes(pickedFluid) ? pickedFluid : fluids[0];
  const plot = useFrozenWhile(
    useMemo(
      () => ({
        ...plotData(result, diagram.id, chartFluid),
        fluid: chartFluid,
        fluids,
        units: result?.unitSystem,
        reference: result?.reference,
      }),
      [result, diagram.id, chartFluid, fluids],
    ),
    chartVisible || !chartWarm,
  );

  // The script lives in the URL, so a link shares it.
  const settled = useDebounced(source, 500);
  useEffect(() => {
    if (params.get("s") !== settled)
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("s", settled);
          return next;
        },
        { replace: true },
      );
  }, [settled, params, setParams]);

  // Kept in this browser once it is edited here: opening a link (a shared
  // script, an example) leaves the last worksheet alone until you type.
  useEffect(() => {
    if (settled !== initial) saveWorksheet(settled);
  }, [settled, initial]);

  const [shared, setShared] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}?s=${encodeURIComponent(source)}`;
    try {
      if (touch && navigator.share) {
        await navigator.share({
          title: tr("Thermoprops script", "Código de Thermoprops"),
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      // Dismissed share sheet or no clipboard access: nothing to do.
    }
  };

  const loadTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    if (
      isOwnWork(source) &&
      !window.confirm(
        tr(
          `Replace your worksheet with the ${t.name} example? You can undo it with ${UNDO_KEYS}.`,
          `¿Reemplazar tu hoja de trabajo con el ejemplo ${t.name}? Puedes deshacerlo con ${UNDO_KEYS}.`,
        ),
      )
    )
      return;
    editor.current?.replace(t.source);
    setDiagramId(t.diagram);
    setTab(wide ? "results" : "code");
  };

  const goTo = useCallback(
    (line: number, col: number) => {
      if (!wide) setTab("code");
      // After the code tab shows.
      requestAnimationFrame(() => editor.current?.goTo(line, col));
    },
    [wide],
  );

  // When the code panel was last touched: iOS may take the focus off the
  // editor on a tap on a key, whatever the key does to keep it, and that is
  // not the end of editing (the editor gets the focus back; with the keypad
  // that opens no system keyboard).
  const lastPanelTouch = useRef(0);
  const closing = useRef(false);
  const onKeypad = useCallback((action: KeypadAction) => {
    const e = editor.current;
    if (!e) return;
    if (action.kind === "done") {
      // Closing on purpose: the blur that follows ends editing, whatever
      // touch events come after it.
      closing.current = true;
      e.blur();
      return;
    }
    if (action.kind === "insert") e.insert(action.text);
    else if (action.kind === "key") e.key(action.key);
    else if (action.kind === "suggest") e.suggest(action.index);
    else e.undo();
    e.focus();
  }, []);

  const problems = result?.diagnostics.length ?? 0;
  const tabs: {
    id: Tab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    ...(wide
      ? []
      : [{ id: "code" as const, label: tr("Code", "Código"), icon: <Code /> }]),
    {
      id: "results",
      label: tr("Results", "Resultados"),
      icon: <ListChecks />,
      badge: problems || undefined,
    },
    { id: "chart", label: tr("Chart", "Diagrama"), icon: <ChartLine /> },
    {
      id: "reference",
      label: tr("Reference", "Referencia"),
      icon: <BookOpen />,
    },
  ];

  return (
    <div
      // While editing on a phone the tabs do not stick (they are not needed,
      // and would cover the code).
      className={`sv${editing && phone ? " is-phone-editing" : ""}`}
      // Room for the last lines to scroll above the fixed keypad.
      style={inset ? { paddingBottom: inset } : undefined}
    >
      <header className="sv__top">
        <div className="sv__title">
          <h1>{tr("Worksheet", "Hoja de trabajo")}</h1>
          <span className="sv__badge">{tr("Preview", "Vista previa")}</span>
        </div>
        <div className="sv__actions">
          <label className="sv__examples">
            <LayoutTemplate aria-hidden="true" />
            <span className="sr-only">
              {tr("Load an example", "Cargar un ejemplo")}
            </span>
            <select value="" onChange={(e) => loadTemplate(e.target.value)}>
              <option value="" disabled>
                {tr("Examples", "Ejemplos")}
              </option>
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.current?.format()}
            title={`${tr("Format", "Formatear")} (${FORMAT_KEYS})`}
          >
            <WandSparkles />
            <span className="sv__action-label">
              {tr("Format", "Formatear")}
            </span>
          </Button>
          {touch && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleKeypad}
              aria-pressed={keypadWanted}
              title={
                keypadWanted
                  ? tr(
                      "Using the page's keypad: tap to use the system keyboard",
                      "Usando el teclado de la página: toca para usar el del sistema",
                    )
                  : tr(
                      "Using the system keyboard: tap to use the page's keypad",
                      "Usando el teclado del sistema: toca para usar el de la página",
                    )
              }
            >
              <Keyboard />
              <span className="sv__action-label">
                {keypadWanted
                  ? tr("Keypad", "Teclado de la página")
                  : tr("Keyboard", "Teclado del sistema")}
              </span>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => void share()}>
            {shared ? <Check /> : <Share2 />}
            <span className="sv__action-label">
              {shared
                ? tr("Link copied", "Enlace copiado")
                : tr("Share", "Compartir")}
            </span>
          </Button>
        </div>
      </header>

      <div className={`sv__body${wide ? " is-wide" : ""}`}>
        <nav
          className="sv__tabs"
          role="tablist"
          aria-label={tr("Worksheet views", "Vistas de la hoja de trabajo")}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={sideTab === t.id}
              aria-controls={`panel-${t.id}`}
              className={sideTab === t.id ? "is-active" : undefined}
              onClick={() => setTab(t.id)}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.badge ? (
                <span
                  className="sv__tab-badge"
                  aria-label={problemsCount(t.badge)}
                >
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        <section
          className={`sv__code${touch ? " is-flow" : ""}`}
          id="panel-code"
          role={wide ? undefined : "tabpanel"}
          aria-labelledby={wide ? undefined : "tab-code"}
          hidden={!wide && sideTab !== "code"}
          onFocus={() => {
            closing.current = false;
            setFocused(true);
          }}
          onPointerDownCapture={(ev) => {
            lastPanelTouch.current = Date.now();
            if (!focused && (ev.target as Element).closest(".script-editor")) {
              tapY.current = ev.clientY;
            }
          }}
          // A held key (delete) ends long after it started: its release too.
          onPointerUpCapture={() => {
            lastPanelTouch.current = Date.now();
          }}
          // Editing ends when the focus leaves the code panel, not when a tap
          // inside it took the focus (the editor gets it back). Checked once
          // the move has settled.
          onBlur={(e) => {
            const panel = e.currentTarget;
            requestAnimationFrame(() => {
              if (panel.contains(document.activeElement)) return;
              if (
                keypad &&
                !closing.current &&
                Date.now() - lastPanelTouch.current < 600
              ) {
                editor.current?.focus();
                return;
              }
              setFocused(false);
            });
          }}
        >
          <div className="sv__editor">
            <ScriptEditor
              ref={editor}
              value={initial}
              onChange={setSource}
              keypad={keypad}
              onSuggestions={setSuggestions}
              bottomInset={inset ? inset + 12 : 0}
              onCaretMoved={editing ? onCaretMoved : undefined}
              data={{
                result,
                fluids: coolprop().catalog(),
                pairs: coolprop().pairs(),
              }}
              current={!pending}
            />
          </div>
          {editing && (
            <Keypad
              ref={keypadBox}
              style={wide ? columnBox : undefined}
              suggestions={suggestions}
              onAction={onKeypad}
            />
          )}
          <div className="sv__statusbar">
            <Status
              pending={pending}
              slow={slow}
              error={error}
              result={result}
              ms={ms}
              onGoTo={goTo}
            />
          </div>
        </section>

        <section
          className="sv__panel"
          id={`panel-${sideTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${sideTab}`}
          hidden={(!wide && sideTab === "code") || chartVisible}
        >
          {sideTab === "results" &&
            (result ? (
              <ResultsPanel result={result} onGoTo={goTo} />
            ) : (
              <p className="results__empty">{tr("Solving…", "Resolviendo…")}</p>
            ))}
          {sideTab === "reference" && <ReferencePanel />}
        </section>

        {(chartWarm || chartVisible) && (
          <section
            className={`sv__chart${chartVisible ? "" : " is-parked"}`}
            id={chartVisible ? "panel-chart" : undefined}
            role={chartVisible ? "tabpanel" : undefined}
            aria-labelledby={chartVisible ? "tab-chart" : undefined}
            aria-hidden={!chartVisible}
          >
            {plot.fluid && plot.points.length > 0 ? (
              <ThermoPlot
                fluid={plot.fluid}
                diagram={diagram}
                isolineKind={isolineKind}
                onDiagramChange={setDiagramId}
                fluids={plot.fluids}
                onFluidChange={setPickedFluid}
                onIsolineChange={setIsoline}
                points={plot.points}
                paths={plot.paths}
                extent={plot.extent}
                isolineValues={plot.isolineValues}
                focus={plot.focus}
                reference={plot.reference}
                look={SCRIPT_LOOK}
                units={plot.units}
                // Fewer points on phones: lighter to draw, pan and zoom.
                isolinePoints={touch ? 60 : 120}
                domePoints={touch ? 60 : 120}
              />
            ) : (
              <p className="results__empty">
                {tr(
                  <>
                    Solved states appear here. Add{" "}
                    <code>draw 1 -&gt; 2 -&gt; 1</code> to draw the processes
                    between them.
                  </>,
                  <>
                    Los estados resueltos aparecen aquí. Agrega{" "}
                    <code>draw 1 -&gt; 2 -&gt; 1</code> para dibujar los
                    procesos entre ellos.
                  </>,
                )}
              </p>
            )}
          </section>
        )}
      </div>
      {debug && <DebugHud />}
    </div>
  );
}
