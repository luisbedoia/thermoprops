import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen,
  ChartLine,
  Check,
  CircleCheck,
  Code,
  LayoutTemplate,
  ListChecks,
  LoaderCircle,
  Share2,
  TriangleAlert,
  WandSparkles,
} from "lucide-react";
import type { InputName } from "@luisbedoia/coolprop-rs-wasm";
import { Button } from "../components/Button";
import { coolprop } from "../coolprop";
import { ThermoPlot } from "../Plot";
import type { PlotPoint } from "../Plot";
import type { PlotPath } from "../lib/plotUtils";
import { quantityValue } from "../lib/quantities";
import type { ScriptResult } from "../dsl/evaluate";
import {
  ScriptEditor,
  type ScriptEditorHandle,
} from "../dsl/editor/ScriptEditor";
import { TEMPLATES } from "../dsl/templates";
import { useScript } from "../dsl/useScript";
import { useDebounced, useFrozenWhile, useMediaQuery } from "./hooks";
import { usePhoneEditing } from "./phoneEditing";
import { ReferencePanel } from "./ReferencePanel";
import { ResultsPanel } from "./ResultsPanel";
import { SymbolBar, type SymbolAction } from "./SymbolBar";
import "./ScriptView.css";

type Tab = "code" | "results" | "chart" | "reference";

const WIDE = "(min-width: 1024px)";
const TOUCH = "(pointer: coarse)";

function plotData(result: ScriptResult | undefined, diagramId: string) {
  const diagram = coolprop()
    .diagrams()
    .find((d) => d.id === diagramId);
  if (!result?.fluid || !diagram) return { points: [], paths: [] };
  const { x, y } = diagram;
  const points: PlotPoint[] = result.states.flatMap((s) =>
    s.state && s.fluid === result.fluid
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
  const paths: PlotPath[] = result.paths
    .filter((p) => p.fluid === result.fluid)
    .map((p) => ({
      label: `${p.from} → ${p.to}`,
      kind: p.kind,
      x: p.states.map((s) => quantityValue(s, x.property) ?? NaN),
      y: p.states.map((s) => quantityValue(s, y.property) ?? NaN),
    }));
  return { points, paths };
}

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
        <LoaderCircle className="spin" /> Loading the solver…
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
        {n} problem{n === 1 ? "" : "s"}
        <span className="status__where">· line {first.line}</span>
        {timing}
      </button>
    );
  }
  const states = result.states.length;
  return (
    <span className="status status--ok">
      {icon}
      {states} state{states === 1 ? "" : "s"} solved
      {timing}
    </span>
  );
}

export function ScriptView() {
  const [params, setParams] = useSearchParams();
  const [initial] = useState(() => params.get("s") ?? TEMPLATES[0].source);
  const [source, setSource] = useState(initial);
  const editor = useRef<ScriptEditorHandle | null>(null);
  const { result, error, ms, pending, slow } = useScript(source);

  const wide = useMediaQuery(WIDE);
  const touch = useMediaQuery(TOUCH);
  const [focused, setFocused] = useState(false);
  // On a phone, editing takes the visible area: the editor above the
  // keyboard, the symbol bar docked under it, nothing else to scroll.
  const editing = touch && !wide && focused;
  const reveal = useCallback(() => editor.current?.reveal(), []);
  const editingStyle = usePhoneEditing(editing, reveal);
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
  const plot = useFrozenWhile(
    useMemo(
      () => ({
        ...plotData(result, diagram.id),
        fluid: result?.fluid,
        units: result?.unitSystem,
      }),
      [result, diagram.id],
    ),
    chartVisible || !chartWarm,
  );

  // The script lives in the URL, so a link shares it.
  const settled = useDebounced(source, 500);
  useEffect(() => {
    if (params.get("s") !== settled)
      setParams({ s: settled }, { replace: true });
  }, [settled, params, setParams]);

  const [shared, setShared] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}?s=${encodeURIComponent(source)}`;
    try {
      if (touch && navigator.share) {
        await navigator.share({ title: "Thermoprops script", url });
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

  const onSymbol = useCallback((action: SymbolAction) => {
    const e = editor.current;
    if (!e) return;
    if (action.kind === "insert") e.insert(action.text);
    else if (action.kind === "complete") e.complete();
    else if (action.kind === "comment") e.toggleComment();
    else if (action.kind === "undo") e.undo();
    else if (action.kind === "redo") e.redo();
    else e.blur();
  }, []);

  const problems = result?.diagnostics.length ?? 0;
  const tabs: {
    id: Tab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    ...(wide ? [] : [{ id: "code" as const, label: "Code", icon: <Code /> }]),
    {
      id: "results",
      label: "Results",
      icon: <ListChecks />,
      badge: problems || undefined,
    },
    { id: "chart", label: "Chart", icon: <ChartLine /> },
    { id: "reference", label: "Reference", icon: <BookOpen /> },
  ];

  return (
    <div className="sv">
      <header className="sv__top">
        <div className="sv__title">
          <h1>Script</h1>
          <span className="sv__badge">Preview</span>
        </div>
        <div className="sv__actions">
          <label className="sv__examples">
            <LayoutTemplate aria-hidden="true" />
            <span className="sr-only">Load an example</span>
            <select value="" onChange={(e) => loadTemplate(e.target.value)}>
              <option value="" disabled>
                Examples
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
            title="Format (Shift Alt F)"
          >
            <WandSparkles />
            <span className="sv__action-label">Format</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void share()}>
            {shared ? <Check /> : <Share2 />}
            <span className="sv__action-label">
              {shared ? "Link copied" : "Share"}
            </span>
          </Button>
        </div>
      </header>

      <div className={`sv__body${wide ? " is-wide" : ""}`}>
        <nav className="sv__tabs" role="tablist" aria-label="Script views">
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
                  aria-label={`${t.badge} problems`}
                >
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        <section
          className={`sv__code${editing ? " is-editing" : touch && !wide ? " is-flow" : ""}`}
          id="panel-code"
          role={wide ? undefined : "tabpanel"}
          aria-labelledby={wide ? undefined : "tab-code"}
          hidden={!wide && sideTab !== "code"}
          style={editingStyle}
        >
          <div className="sv__editor">
            <ScriptEditor
              ref={editor}
              value={initial}
              onChange={setSource}
              onFocusChange={setFocused}
              data={{ result, fluids: coolprop().catalog() }}
              current={!pending}
            />
          </div>
          {editing && <SymbolBar onAction={onSymbol} />}
          <div className="sv__statusbar" hidden={editing}>
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
              <p className="results__empty">Solving…</p>
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
                onIsolineChange={setIsoline}
                points={plot.points}
                paths={plot.paths}
                units={plot.units}
                // Fewer points on phones: lighter to draw, pan and zoom.
                isolinePoints={touch ? 60 : 120}
                domePoints={touch ? 60 : 120}
              />
            ) : (
              <p className="results__empty">
                Solved states of the script's fluid appear here. Add{" "}
                <code>cycle 1 -&gt; 2 -&gt; 1</code> to draw the processes
                between them.
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
