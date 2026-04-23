import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { calculateProperties, fluidHasPlots } from "../lib";
import type { ComputedState, StateDefinition } from "./types";
import {
  decodeStates,
  encodeStates,
  normalizeStateDefinition,
  statesEqual,
} from "./utils";

export type WorkspaceViewMode = "graph" | "table";

const PLOT_DEFAULT = "ph";
const ISOLINE_PARAM_DEFAULT = 19;
const VIEW_DEFAULT: WorkspaceViewMode = "graph";

/**
 * Manages all URL-synced workspace state:
 * - Reads initial values from searchParams on mount
 * - Writes state back to URL whenever it changes (write direction)
 * - Syncs state from URL when the URL changes externally, e.g. browser back (read direction)
 *
 * plotFailed must come from the caller because it's driven by ThermoPlot's render outcome,
 * not by URL params. It affects effectiveViewMode which gets written back to the URL.
 */
export function useWorkspaceUrlParams({ plotFailed }: { plotFailed: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const fluid = searchParams.get("fluid") ?? "";
  const units = searchParams.get("units") ?? "si";

  const [plotId, setPlotId] = useState<string>(
    searchParams.get("plot") || PLOT_DEFAULT,
  );
  const [isolineParameter, setIsolineParameter] = useState<number>(() => {
    const param = searchParams.get("isoline");
    return param ? Number(param) : ISOLINE_PARAM_DEFAULT;
  });
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>(() => {
    const param = searchParams.get("view");
    return param === "graph" || param === "table" ? param : VIEW_DEFAULT;
  });
  const [states, setStates] = useState<StateDefinition[]>(() =>
    decodeStates(searchParams.get("states")).map(normalizeStateDefinition),
  );

  const hasPlots = useMemo(() => fluidHasPlots(fluid), [fluid]);
  const canViewGraph = hasPlots && !plotFailed;
  const effectiveViewMode: WorkspaceViewMode = canViewGraph ? viewMode : "table";

  // Write direction: state → URL
  useEffect(() => {
    if (!fluid) return;

    const next = new URLSearchParams(searchParams);
    if (states.length) {
      next.set("states", encodeStates(states));
    } else {
      next.delete("states");
    }
    next.set("view", effectiveViewMode);
    next.set("plot", plotId);
    next.set("isoline", String(isolineParameter));
    next.set("units", units);
    next.set("fluid", fluid);

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [
    states,
    plotId,
    isolineParameter,
    units,
    fluid,
    viewMode,
    canViewGraph,
    effectiveViewMode,
    searchParams,
    setSearchParams,
  ]);

  // Read direction: URL → state (browser back/forward navigation)
  useEffect(() => {
    const rawView = searchParams.get("view");
    const nextView =
      rawView === "graph" || rawView === "table" ? rawView : VIEW_DEFAULT;
    setViewMode((prev) => (prev === nextView ? prev : nextView));

    const currentPlot = searchParams.get("plot") || PLOT_DEFAULT;
    setPlotId((prev) => (prev === currentPlot ? prev : currentPlot));

    const currentIsolineParam = searchParams.get("isoline");
    const parsedParam = currentIsolineParam
      ? Number(currentIsolineParam)
      : ISOLINE_PARAM_DEFAULT;
    setIsolineParameter((prev) => (prev === parsedParam ? prev : parsedParam));

    const decodedStates = decodeStates(searchParams.get("states")).map(
      normalizeStateDefinition,
    );
    setStates((prev) =>
      statesEqual(prev, decodedStates) ? prev : decodedStates,
    );
  }, [searchParams]);

  return {
    fluid,
    units,
    plotId,
    setPlotId,
    isolineParameter,
    setIsolineParameter,
    viewMode,
    setViewMode,
    states,
    setStates,
    hasPlots,
    canViewGraph,
    effectiveViewMode,
  };
}

export function useComputedStates(
  states: StateDefinition[],
  fluid: string,
): ComputedState[] {
  return useMemo(() => {
    return states.map((definition) => {
      try {
        const value1 = Number(definition.value1);
        const value2 = Number(definition.value2);
        if (!Number.isFinite(value1) || !Number.isFinite(value2)) {
          return { definition, results: [], error: "Values must be numeric." };
        }
        const results = calculateProperties(
          definition.property1,
          value1,
          definition.property2,
          value2,
          fluid,
        );
        return { definition, results };
      } catch (error) {
        console.error("Unable to calculate state", definition, error);
        return {
          definition,
          results: [],
          error: "Unable to evaluate this state.",
        };
      }
    });
  }, [states, fluid]);
}
