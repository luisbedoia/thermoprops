import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { DiagramInfo, InputName, StateInputs } from "@luisbedoia/coolprop-rs-wasm";
import { coolprop } from "../coolprop";
import { resolveUnitSystem } from "../lib/units";
import type { UnitSystem } from "../lib/units";
import { validityError } from "../lib/validity";
import type { ComputedState, StateDefinition } from "./types";
import {
  decodeStates,
  encodeStates,
  normalizeStateDefinition,
  statesEqual,
} from "./utils";

export type WorkspaceViewMode = "graph" | "table";

const DIAGRAM_DEFAULT = "pressure_enthalpy";
const VIEW_DEFAULT: WorkspaceViewMode = "graph";

/** The canonical name of the catalog fluid `name` refers to, or "". */
function resolveFluid(name: string | null): string {
  if (!name) return "";
  const found = coolprop()
    .catalog()
    .find((f) => f.name === name || f.aliases.includes(name));
  return found?.name ?? "";
}

/** The catalog diagram with this id, or the default one. */
function resolveDiagram(id: string | null): DiagramInfo {
  const diagrams = coolprop().diagrams();
  return (
    diagrams.find((d) => d.id === id) ??
    diagrams.find((d) => d.id === DIAGRAM_DEFAULT) ??
    diagrams[0]
  );
}

/** `kind` if `diagram` draws it, else the diagram's first isoline family. */
function resolveIsoline(diagram: DiagramInfo, kind: string | null): InputName {
  return diagram.isolines.find((k) => k === kind) ?? diagram.isolines[0];
}

function readStates(param: string | null) {
  const { states, legacy } = decodeStates(param);
  return { states: states.map(normalizeStateDefinition), legacy };
}

/**
 * Manages all URL-synced workspace state:
 * - Reads initial values from searchParams on mount
 * - Writes state back to URL whenever it changes (write direction)
 * - Syncs state from URL when the URL changes externally, e.g. browser back (read direction)
 *
 * plotFailedFor (the fluid whose chart failed) must come from the caller because it's driven by
 * ThermoPlot's render outcome,
 * not by URL params. It affects effectiveViewMode which gets written back to the URL.
 */
export function useWorkspaceUrlParams({ plotFailedFor }: { plotFailedFor: string | null }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // The catalog fluid the URL names (by name or alias); "" when it names
  // none, which sends the user back to the settings.
  const fluid = resolveFluid(searchParams.get("fluid"));
  const units = resolveUnitSystem(searchParams.get("units"));

  const [diagramId, setDiagramId] = useState<string>(
    () => resolveDiagram(searchParams.get("plot")).id,
  );
  const diagram = useMemo(() => resolveDiagram(diagramId), [diagramId]);
  const [isolineKind, setIsolineKind] = useState<InputName>(() =>
    resolveIsoline(diagram, searchParams.get("isoline")),
  );
  const effectiveIsoline = resolveIsoline(diagram, isolineKind);
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>(() => {
    const param = searchParams.get("view");
    return param === "graph" || param === "table" ? param : VIEW_DEFAULT;
  });
  const [initial] = useState(() => readStates(searchParams.get("states")));
  const [states, setStates] = useState<StateDefinition[]>(initial.states);
  const [legacyLink, setLegacyLink] = useState(initial.legacy);

  const canViewGraph = plotFailedFor !== fluid;
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
    next.set("plot", diagram.id);
    next.set("isoline", effectiveIsoline);
    next.set("units", units);
    next.set("fluid", fluid);

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [
    states,
    diagram,
    effectiveIsoline,
    units,
    fluid,
    effectiveViewMode,
    searchParams,
    setSearchParams,
  ]);

  // Read direction: URL → state (browser back/forward navigation). Adjusted
  // while rendering, not in an effect, so a URL change renders once.
  const [readParams, setReadParams] = useState(searchParams);
  if (searchParams !== readParams) {
    setReadParams(searchParams);
    const rawView = searchParams.get("view");
    const nextView =
      rawView === "graph" || rawView === "table" ? rawView : VIEW_DEFAULT;
    setViewMode((prev) => (prev === nextView ? prev : nextView));

    const nextDiagram = resolveDiagram(searchParams.get("plot"));
    setDiagramId((prev) => (prev === nextDiagram.id ? prev : nextDiagram.id));

    const nextIsoline = resolveIsoline(nextDiagram, searchParams.get("isoline"));
    setIsolineKind((prev) => (prev === nextIsoline ? prev : nextIsoline));

    const decoded = readStates(searchParams.get("states"));
    setStates((prev) =>
      statesEqual(prev, decoded.states) ? prev : decoded.states,
    );
    if (decoded.legacy) setLegacyLink(true);
  }

  return {
    fluid,
    units,
    diagram,
    setDiagramId,
    isolineKind: effectiveIsoline,
    setIsolineKind,
    viewMode,
    setViewMode,
    states,
    setStates,
    legacyLink,
    dismissLegacyLink: () => setLegacyLink(false),
    canViewGraph,
    effectiveViewMode,
  };
}

/** Solves each tracked state once. */
export function useComputedStates(
  states: StateDefinition[],
  fluid: string,
  units: UnitSystem,
): ComputedState[] {
  return useMemo(() => {
    return states.map((definition) => {
      const value1 = Number(definition.value1);
      const value2 = Number(definition.value2);
      if (!Number.isFinite(value1) || !Number.isFinite(value2)) {
        return { definition, error: "Values must be numeric." };
      }
      try {
        // The pair comes from the URL, so TypeScript cannot check it;
        // CoolProp rejects unsupported pairs.
        const state = coolprop()
          .fluid(fluid)
          .state({
            [definition.property1]: value1,
            [definition.property2]: value2,
          } as unknown as StateInputs);
        // A link may hold a state past the equation of state's limits,
        // where CoolProp's values are extrapolations.
        const outside = validityError(state, coolprop().fluid(fluid).data, units);
        if (outside) return { definition, error: outside };
        return { definition, state };
      } catch (error) {
        console.error("Unable to calculate state", definition, error);
        return { definition, error: "Unable to evaluate this state." };
      }
    });
  }, [states, fluid, units]);
}
