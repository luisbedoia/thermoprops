import { useEffect, useMemo, useRef, useState } from "react";
import { ImageDown } from "lucide-react";
import { Button } from "./components/Button";
import { fileName } from "./lib/exportFiles";
import type { RefObject } from "react";
import type {
  ReferenceState,
  WorkerFluid,
  DiagramData,
  DiagramInfo,
  DiagramRequest,
  InputName,
} from "@luisbedoia/coolprop-rs-wasm";
import "./Plot.css";
import { tr } from "./i18n";
import { coolprop, displayName, fluidData } from "./coolprop";
import { buildChartLabels } from "./lib/chartLabels";
import {
  APP_LOOK,
  type ChartLook,
  buildPathArrows,
  buildDomeTraces,
  buildIsolineTraces,
  buildPathTraces,
  buildPlotLayout,
  buildPointTrace,
  diagramLabel,
  diagramSymbols,
  diagramOptionLabel,
  viewRange,
} from "./lib/plotUtils";
import { loadPlotly, type PlotlyLike } from "./lib/plotly";
import { displayUnit, resolveUnitSystem } from "./lib/units";
import type { UnitSystem } from "./lib/units";

export type { PlotPoint } from "./lib/plotUtils";
import type { PlotPath, PlotPoint } from "./lib/plotUtils";

type ThermoPlotProps = {
  fluid: string;
  diagram: DiagramInfo;
  isolineKind: InputName;
  onDiagramChange?: (id: string) => void;
  /** Fluids to choose among, when there are several (a script's). */
  fluids?: readonly string[];
  onFluidChange?: (fluid: string) => void;
  onIsolineChange?: (kind: InputName) => void;
  onPlotError?: (hasError: boolean) => void;
  points: PlotPoint[];
  /** Lines drawn under the points, e.g. the processes of a cycle. */
  paths?: PlotPath[];
  /**
   * Temperatures and pressures (SI) the domain must reach, past CoolProp's
   * default (which ends at 2.25·Tc: 25 °C for air).
   */
  extent?: PlotExtent;
  /** Isoline values (SI) by family, e.g. through the tracked states. */
  isolineValues?: Partial<Record<InputName, number[]>>;
  /** What the initial view frames: the dome (default) or the points and paths. */
  focus?: "dome" | "points";
  /** Where enthalpy and entropy are measured from. Default `"DEF"`. */
  reference?: ReferenceState;
  /** How it is drawn: the app's look (default) or a screen's own. */
  look?: ChartLook;
  isolineCount?: number;
  /** States per isoline. */
  isolinePoints?: number;
  /** States per branch of the saturation dome. */
  domePoints?: number;
  units?: string;
};

const PLOT_FAILED = tr(
  "The plot could not be generated for the current settings.",
  "No se pudo generar el diagrama con la configuración actual.",
);

function useLegendPlacement(
  wrapperRef: RefObject<HTMLDivElement | null>,
): "bottom" | "right" {
  const [legendPlacement, setLegendPlacement] = useState<"bottom" | "right">(
    () =>
      typeof window !== "undefined" && window.innerWidth >= 768
        ? "right"
        : "bottom",
  );

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;

    const handleResize = () => {
      setLegendPlacement(element.clientWidth < 768 ? "bottom" : "right");
    };

    handleResize();
    const observer = new ResizeObserver(() => {
      handleResize();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
    // wrapperRef is a stable ref object — safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return legendPlacement;
}

/** Spans of temperature and pressure, SI. */
export type PlotExtent = {
  temperature?: [number, number];
  pressure?: [number, number];
};

/**
 * CoolProp's default plot domain (see coolprop-rs `Limits::default_for`),
 * widened to `extent` with some room, within the equation of state's range.
 */
function plotLimits(f: WorkerFluid, extent: PlotExtent | undefined) {
  const { data, critical } = f;
  const base = {
    t_min: data.t_triple * 1.01,
    t_max: Math.min(critical.temperature * 2.25, data.t_max * 0.999),
    p_min: data.p_triple * 1.01,
    p_max: Math.min(critical.pressure * 2.25, data.p_max * 0.999),
  };
  if (!extent?.temperature || !extent.pressure) return undefined;
  const t_max = Math.min(
    Math.max(base.t_max, extent.temperature[1] * 1.1),
    data.t_max * 0.999,
  );
  const p_max = Math.min(
    Math.max(base.p_max, extent.pressure[1] * 1.5),
    data.p_max * 0.999,
  );
  return t_max > base.t_max || p_max > base.p_max
    ? { ...base, t_max, p_max }
    : undefined;
}

/** The chart's element, as Plotly extends it. */
type PlotElement = HTMLElement & {
  _fullLayout?: {
    xaxis?: { range?: unknown[] };
    yaxis?: { range?: unknown[] };
    /** The plot area, in pixels. */
    _size?: { w: number; h: number };
  };
  on?: (event: string, handler: (update?: object) => void) => void;
  removeAllListeners?: (event: string) => void;
};

/**
 * Diagrams already solved, newest last, by engine (tests swap it): going
 * back to one is instant.
 */
const diagramCaches = new WeakMap<object, Map<string, DiagramData>>();
const CACHED_DIAGRAMS = 24;

function diagramCache(): Map<string, DiagramData> {
  const engine = coolprop();
  let cache = diagramCaches.get(engine);
  if (!cache) diagramCaches.set(engine, (cache = new Map()));
  return cache;
}

function remember(key: string, data: DiagramData) {
  const cache = diagramCache();
  cache.delete(key);
  cache.set(key, data);
  if (cache.size > CACHED_DIAGRAMS) cache.delete(cache.keys().next().value!);
}

export function ThermoPlot({
  fluid,
  diagram,
  isolineKind,
  onDiagramChange,
  fluids,
  onFluidChange,
  onIsolineChange,
  onPlotError,
  points,
  paths,
  extent,
  isolineValues,
  focus = "dome",
  reference = "DEF",
  look = APP_LOOK,
  isolineCount = 7,
  // Kept low for low-end devices: computed on the main thread. In desktop
  // Chromium, over every fluid, diagram and family, 120 points per isoline
  // take ~15 ms per diagram (median), ~50 ms at the 95th percentile and
  // ~0.15 s for the slowest fluid; the dome adds ~3 ms.
  isolinePoints = 120,
  domePoints = 120,
  units,
}: ThermoPlotProps) {
  const unitSystem: UnitSystem = resolveUnitSystem(units);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // Of drawing with Plotly; failures known before drawing are setupError.
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  // The Plotly that drew the current chart, to export it.
  const plotlyRef = useRef<PlotlyLike | null>(null);
  /** The axes the chart was created for (its layout's uirevision). */
  const revisionRef = useRef<string | null>(null);
  /**
   * What the path arrows are drawn from, and their traces' indices: they
   * are redrawn for the visible ranges whenever these change (zoom, pan,
   * reset), so a leg too short to see at first gets its arrow up close.
   */
  const arrowsRef = useRef<{
    redraw: (element: PlotElement, plotly: PlotlyLike) => void;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const legendPlacement = useLegendPlacement(wrapperRef);

  // The diagram itself: dome and isolines. It depends on the fluid, the
  // diagram, the isoline family, the resolution and the units, not on the
  // tracked states, so adding or removing a state does not recompute it.
  const request = useMemo(
    (): DiagramRequest => ({
      diagram: diagram.id,
      isolines: [
        {
          kind: isolineKind,
          count: isolineCount,
          unit: displayUnit(isolineKind, unitSystem),
        },
      ],
      points: isolinePoints,
      dome_points: domePoints,
    }),
    [
      diagram.id,
      isolineKind,
      isolineCount,
      isolinePoints,
      domePoints,
      unitSystem,
    ],
  );
  const values = isolineValues?.[isolineKind];
  const requestKey = JSON.stringify([
    fluid,
    reference,
    request,
    extent,
    values,
  ]);
  // The worker's answer, with the request it answers.
  const [answer, setAnswer] = useState<{
    key: string;
    result: { data: DiagramData } | { error: unknown };
  } | null>(null);
  // One diagram at a time: while the worker solves one, only the newest
  // request waits (choices made in between are dropped), so a burst of
  // changes costs at most two diagrams, not one each.
  const queue = useRef<{
    busy: boolean;
    next?: { key: string; solve: () => Promise<DiagramData> };
    mounted: boolean;
  }>({ busy: false, mounted: true });
  useEffect(() => {
    const q = queue.current;
    q.mounted = true;
    return () => {
      q.mounted = false;
    };
  }, []);
  useEffect(() => {
    if (!fluid) return;
    // A solved diagram is shown from the cache (see `computed`).
    if (diagramCache().has(requestKey)) return;
    const q = queue.current;
    q.next = {
      key: requestKey,
      solve: () =>
        coolprop()
          .fluid(fluid, { reference })
          .then((f) => {
            const limits = plotLimits(f, extent);
            return f.diagram({
              ...request,
              ...(limits && { limits }),
              isolines: values?.length
                ? // At most 30 isolines.
                  [{ kind: isolineKind, values: values.slice(0, 30) }]
                : request.isolines,
            });
          }),
    };
    const pump = () => {
      const job = q.next;
      if (q.busy || !job) return;
      q.next = undefined;
      q.busy = true;
      void job
        .solve()
        .then(
          (data) => {
            remember(job.key, data);
            return { data };
          },
          (error: unknown) => ({ error }),
        )
        .then((result) => {
          q.busy = false;
          // An older answer is kept (cached) but not shown: see `computed`.
          if (q.mounted) setAnswer({ key: job.key, result });
          pump();
        });
    };
    pump();
    // `request` is part of `requestKey`; listing it would rerun on identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);
  // Undefined while the worker solves the current request.
  const computed = useMemo(() => {
    if (answer?.key === requestKey) return answer.result;
    const cached = diagramCache().get(requestKey);
    return cached ? { data: cached } : undefined;
  }, [answer, requestKey]);

  const setupError = !fluid
    ? tr(
        "Select a fluid in settings to render a chart.",
        "Elige un fluido en la configuración para dibujar un diagrama.",
      )
    : computed && "error" in computed
      ? PLOT_FAILED
      : null;
  // The first chart waits with a message; later ones keep the previous chart
  // on screen until theirs is solved.
  const shownStatus = setupError
    ? "error"
    : !computed && status !== "ready"
      ? "loading"
      : status;
  const shownError = setupError ?? error;

  // Resize with the container, and release Plotly when the chart goes away.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      // Plotly refuses a chart that is hidden or not drawn yet: nothing to fit.
      const shown = element.offsetParent !== null && "_fullLayout" in element;
      if (!shown) return;
      void Promise.resolve(plotlyRef.current?.Plots?.resize?.(element)).catch(
        () => {},
      );
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      plotlyRef.current?.purge?.(element);
    };
  }, []);

  // Draw, or update in place: Plotly.react keeps the chart (and the user's
  // zoom, through uirevision) when only the tracked states change.
  useEffect(() => {
    let isMounted = true;

    if (!fluid || !computed) return;
    if ("error" in computed) {
      console.error("Error generating plot", computed.error);
      onPlotError?.(true);
      return;
    }
    // Always mounted (see below), so set once the effect runs.
    const element = containerRef.current;
    if (!element) return;

    const { data } = computed;
    const { x, y } = data;
    const traces = [
      ...buildDomeTraces(data.dome, x.property, y.property, unitSystem, look),
      ...buildIsolineTraces(
        data.isolines,
        x.property,
        y.property,
        unitSystem,
        look,
      ),
    ];
    const scales = { x: x.scale, y: y.scale };
    // The path arrows' traces come right after the paths' lines.
    const arrowStart = traces.length + (paths?.length ?? 0);
    if (paths) {
      traces.push(
        ...buildPathTraces(
          paths,
          x.property,
          y.property,
          unitSystem,
          scales,
          undefined,
          look,
        ),
      );
    }
    arrowsRef.current =
      paths?.length || look.inlineLabels
        ? {
            redraw(el, plotly) {
              const l = el._fullLayout;
              if (!l?.xaxis?.range || !l.yaxis?.range) return;
              const view = {
                x: l.xaxis.range.map(Number) as [number, number],
                y: l.yaxis.range.map(Number) as [number, number],
              };
              let arrows: { x: number[]; y: number[] }[] = [];
              if (paths?.length) {
                arrows = buildPathArrows(
                  paths,
                  x.property,
                  y.property,
                  unitSystem,
                  scales,
                  view,
                );
                void plotly.restyle?.(
                  el,
                  { x: arrows.map((a) => a.x), y: arrows.map((a) => a.y) },
                  arrows.map((_, i) => arrowStart + i),
                );
              }
              if (look.inlineLabels && l._size) {
                // The labels for this view; the relayout that sets them is
                // told apart from a zoom by the handler below.
                const annotations = buildChartLabels({
                  points,
                  paths: paths ?? [],
                  isolines: data.isolines,
                  dome: data.dome,
                  xProperty: x.property,
                  yProperty: y.property,
                  unitSystem,
                  scales,
                  view,
                  size: { w: l._size.w, h: l._size.h },
                  colors: { text: look.text, isoline: "#6b6b6b" },
                  font: look.font,
                  arrows,
                });
                void plotly.relayout?.(el, { annotations });
              }
            },
          }
        : null;
    const pointTrace = buildPointTrace(
      points,
      x.property,
      y.property,
      unitSystem,
      look,
    );
    if (pointTrace) traces.push(pointTrace);

    const { liquid, vapor } = data.dome;
    const layout = {
      ...buildPlotLayout(
        look.shortTitle
          ? `${fluidData(fluid).display_name} · ${diagramSymbols(diagram)}`
          : `${fluidData(fluid).display_name} - ${diagramLabel(diagram)}`,
        x,
        y,
        legendPlacement,
        viewRange(x, focus === "dome" ? [...liquid.x, ...vapor.x] : [], [
          ...points.map((p) => p.x),
          ...(paths ?? []).flatMap((p) => p.x),
        ]),
        viewRange(y, focus === "dome" ? [...liquid.y, ...vapor.y] : [], [
          ...points.map((p) => p.y),
          ...(paths ?? []).flatMap((p) => p.y),
        ]),
        unitSystem,
        look,
      ),
      // The toolbar's icons in the chart's greys.
      modebar: {
        bgcolor: "rgba(0,0,0,0)",
        color: "#a8a8a8",
        activecolor: look.text,
      },
      // Zoom and pan survive updates until the axes change meaning.
      uirevision: `${fluid}|${reference}|${diagram.id}|${unitSystem}`,
    };

    const draw = async () => {
      if (!plotlyRef.current) setStatus("loading");
      try {
        const plotly = await loadPlotly();
        if (!isMounted) return;
        plotlyRef.current = plotly;
        // New axes, a new chart: Plotly keeps the first drawing's ranges as
        // the ones "Reset axes" returns to, and those of other axes show
        // nothing (or, on a log axis, freeze it for seconds).
        if (revisionRef.current !== layout.uirevision) {
          if (revisionRef.current !== null) plotly.purge?.(element);
          revisionRef.current = layout.uirevision;
        }
        await plotly.react(element, traces, layout, {
          responsive: true,
          displaylogo: false,
          displayModeBar: true,
          modeBarButtonsToRemove: ["lasso2d", "select2d"],
          // Plotly 4 shows it by default: it uploads the chart to Plotly's cloud.
          showSendToCloud: false,
          toImageButtonOptions: {
            format: "png",
            scale: 3,
          },
        });
        if (!isMounted) return;
        // The arrows for what is visible: the user's zoom survives updates.
        const el = element as PlotElement;
        el.removeAllListeners?.("plotly_relayout");
        if (arrowsRef.current) {
          arrowsRef.current.redraw(el, plotly);
          el.on?.("plotly_relayout", (update) => {
            // Setting the labels is a relayout too: only a change of view
            // (zoom, pan, reset, resize) places them again.
            const keys = Object.keys(update ?? {});
            if (
              keys.length > 0 &&
              keys.every((k) => k.startsWith("annotations"))
            )
              return;
            arrowsRef.current?.redraw(el, plotly);
          });
        }
        setStatus("ready");
        setError(null);
        onPlotError?.(false);
      } catch (err) {
        console.error("Error drawing plot", err);
        if (!isMounted) return;
        setStatus("error");
        setError(PLOT_FAILED);
        onPlotError?.(true);
      }
    };
    void draw();

    return () => {
      isMounted = false;
    };
  }, [
    computed,
    focus,
    reference,
    look,
    fluid,
    diagram,
    points,
    paths,
    legendPlacement,
    onPlotError,
    unitSystem,
  ]);

  return (
    <div className="plot-card">
      <div className="plot-controls">
        {fluids && fluids.length > 1 && (
          <div className="control">
            <label htmlFor="plot-fluid">{tr("Fluid", "Fluido")}</label>
            <select
              id="plot-fluid"
              name="plot-fluid"
              value={fluid}
              onChange={(event) => onFluidChange?.(event.target.value)}
            >
              {fluids.map((f) => (
                <option key={f} value={f}>
                  {displayName(f)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="control">
          <label htmlFor="plot-type">
            {tr("Chart type", "Tipo de diagrama")}
          </label>
          <select
            id="plot-type"
            name="plot-type"
            value={diagram.id}
            onChange={(event) => onDiagramChange?.(event.target.value)}
          >
            {coolprop()
              .diagrams()
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {diagramOptionLabel(d)}
                </option>
              ))}
          </select>
        </div>
        <div className="control">
          <label htmlFor="isolines">{tr("Isolines", "Isolíneas")}</label>
          <select
            id="isolines"
            name="isolines"
            value={isolineKind}
            onChange={(event) =>
              onIsolineChange?.(event.target.value as InputName)
            }
          >
            {coolprop()
              .inputs()
              .filter((input) => diagram.isolines.includes(input.name))
              .map((input) => (
                <option key={input.name} value={input.name}>
                  {`${input.description} (${input.symbol})`}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="plot-actions">
        <Button
          variant="ghost"
          size="sm"
          disabled={shownStatus !== "ready"}
          onClick={() => {
            const element = containerRef.current;
            if (!element) return;
            void plotlyRef.current?.downloadImage?.(element, {
              format: "png",
              filename: fileName(fluid, diagram.id),
              scale: 3,
            });
          }}
        >
          <ImageDown />
          {tr("Download PNG", "Descargar PNG")}
        </Button>
      </div>

      <div
        ref={wrapperRef}
        className={`plot-wrapper${shownStatus === "ready" ? " is-ready" : ""}`}
      >
        {shownStatus === "error" && shownError ? (
          <div className="plot-message error">{shownError}</div>
        ) : null}
        {shownStatus === "loading" && (
          <div className="plot-message">
            {tr("Preparing plot…", "Preparando el diagrama…")}
          </div>
        )}
        {/* Always mounted, so a re-render after an error still finds it. */}
        <div
          ref={containerRef}
          className="plot-container"
          aria-live="polite"
          hidden={shownStatus === "error"}
        />
      </div>
    </div>
  );
}
