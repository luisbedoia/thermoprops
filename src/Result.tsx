import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChartLine, Table2, X } from "lucide-react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { clearExplorer, saveExplorer } from "./lib/sessions";
import type { StateInputs } from "@luisbedoia/coolprop-rs-wasm";
import { resolveUnitSystem, toSI } from "./lib/units";
import { validityError } from "./lib/validity";
import { normalizeNumericInput } from "./lib/normalizeNumericInput";
import { coolprop, fluidData } from "./coolprop";
import { ThermoPlot } from "./Plot";
import type { PlotPoint } from "./Plot";
import { Button } from "./components/Button";
import { StateList, StateQuickActions } from "./workspace/StateList";
import { StateModal } from "./workspace/StateModal";
import {
  createStateLabel,
  generateId,
  getPlotPoints,
  normalizeStateDefinition,
} from "./workspace/utils";
import { pickInput, swapPair } from "./workspace/pairs";
import type { PairForm, Replacement } from "./workspace/pairs";
import { useComputedStates, useWorkspaceUrlParams } from "./workspace/hooks";
import type { WorkspaceViewMode } from "./workspace/hooks";
import "./Result.css";

const UNIT_LABELS: Record<string, string> = {
  celsius: "Default",
  kelvin: "Kelvin",
  imperial: "Imperial",
};

type FormState = PairForm;

// ── WorkspaceHeader ──────────────────────────────────────────────────────────

type WorkspaceHeaderProps = {
  fluid: string;
  canViewGraph: boolean;
  effectiveViewMode: WorkspaceViewMode;
  unitLabel: string;
  statesSummary: string;
  onViewModeChange: (mode: WorkspaceViewMode) => void;
  onNavigateBack: () => void;
};

function WorkspaceHeader({
  fluid,
  canViewGraph,
  effectiveViewMode,
  unitLabel,
  statesSummary,
  onViewModeChange,
  onNavigateBack,
}: WorkspaceHeaderProps) {
  const headerSubtitle = unitLabel
    ? `${unitLabel} units · ${statesSummary}`
    : statesSummary;

  return (
    <header className="workspace__header">
      <div className="workspace__title">
        <h1>{fluid || "Select a fluid in settings"}</h1>
        <p>{headerSubtitle}</p>
      </div>
      <div className="workspace__actions">
        <Button variant="ghost" size="sm" onClick={onNavigateBack}>
          <ArrowLeft />
          Back to settings
        </Button>
        <div
          className="workspace__view-toggle"
          role="group"
          aria-label="Workspace content view"
        >
          {canViewGraph ? (
            <Button
              variant="plain"
              className={effectiveViewMode === "graph" ? "is-active" : ""}
              aria-pressed={effectiveViewMode === "graph"}
              onClick={() => onViewModeChange("graph")}
            >
              <ChartLine />
              Chart
            </Button>
          ) : (
            <span
              className="workspace__view-disabled-tip"
              data-tooltip="The chart could not be generated for this fluid. Only the table view is available."
            >
              <Button
                variant="plain"
                className="is-disabled"
                aria-pressed={false}
                aria-disabled="true"
                tabIndex={-1}
              >
                <ChartLine />
                Chart
              </Button>
            </span>
          )}
          <Button
            variant="plain"
            className={effectiveViewMode === "table" ? "is-active" : ""}
            aria-pressed={effectiveViewMode === "table"}
            onClick={() => onViewModeChange("table")}
          >
            <Table2 />
            Table
          </Button>
        </div>
      </div>
    </header>
  );
}

// ── WorkspaceView ────────────────────────────────────────────────────────────

export function WorkspaceView() {
  const navigate = useNavigate();

  // The fluid whose chart failed: a failure is forgotten on another fluid.
  const [plotFailedFor, setPlotFailedFor] = useState<string | null>(null);

  const {
    fluid,
    units,
    diagram,
    setDiagramId,
    isolineKind,
    setIsolineKind,
    viewMode,
    setViewMode,
    states,
    setStates,
    legacyLink,
    dismissLegacyLink,
    canViewGraph,
    effectiveViewMode,
  } = useWorkspaceUrlParams({ plotFailedFor });

  useEffect(() => {
    if (!fluid) {
      navigate("/explorer", { replace: true });
    }
  }, [fluid, navigate]);

  // Kept in this browser while it has states, so leaving never loses them
  // (the settings and the landing page offer to continue).
  // A session emptied here (state by state, or all at once) is cleared; one
  // opened empty (a new session from the settings) leaves the last alone.
  const { search } = useLocation();
  const hadStates = useRef(false);
  useEffect(() => {
    if (fluid && states.length > 0) {
      saveExplorer(search);
      hadStates.current = true;
    } else if (hadStates.current) {
      clearExplorer();
    }
  }, [fluid, states.length, search]);

  const handlePlotError = useCallback(
    (failed: boolean) => setPlotFailedFor(failed ? fluid : null),
    [fluid],
  );

  const computedStates = useComputedStates(states, fluid, units);

  const plotPoints: PlotPoint[] = useMemo(
    () => getPlotPoints(computedStates, diagram),
    [computedStates, diagram],
  );

  // ── Modal / form state ─────────────────────────────────────────────────────

  // Default pair: the first catalog pair (pressure, temperature).
  const [formState, setFormState] = useState<FormState>(() => {
    const [primary, secondary] = coolprop().pairs()[0];
    return { property1: primary, property2: secondary, value1: "", value2: "" };
  });
  const [formError, setFormError] = useState<string | null>(null);
  // The input the form last changed on its own, to explain it.
  const [replacement, setReplacement] = useState<Replacement | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // The worker is checking the new state; the form waits for its answer.
  const [solving, setSolving] = useState(false);
  // Counts submissions and closings: an answer for an older one is dropped.
  const submission = useRef(0);
  const firstValueRef = useRef<HTMLInputElement | null>(null);

  const handleOpenModal = useCallback(() => {
    submission.current++;
    setSolving(false);
    setFormError(null);
    setReplacement(null);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    submission.current++;
    setSolving(false);
    setFormError(null);
    setIsModalOpen(false);
  }, []);

  const handleStateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (solving) return;
    setFormError(null);

    if (!fluid) {
      setFormError("Select a fluid first in settings.");
      return;
    }

    const normalizedValue1 = normalizeNumericInput(formState.value1);
    const normalizedValue2 = normalizeNumericInput(formState.value2);

    if (!normalizedValue1 || !normalizedValue2) {
      setFormError("Both values must be numeric.");
      return;
    }

    const displayValue1 = Number(normalizedValue1);
    const displayValue2 = Number(normalizedValue2);

    if (!Number.isFinite(displayValue1) || !Number.isFinite(displayValue2)) {
      setFormError("Both values must be numeric.");
      return;
    }

    const system = resolveUnitSystem(units);
    const value1 = toSI(formState.property1, displayValue1, system);
    const value2 = toSI(formState.property2, displayValue2, system);

    const { property1, property2 } = formState;
    const token = ++submission.current;
    setSolving(true);
    void (async () => {
      let problem: string | null;
      try {
        // The pair comes from the form, so TypeScript cannot check it;
        // CoolProp rejects unsupported pairs.
        const solved = await (
          await coolprop().fluid(fluid)
        ).state({
          [property1]: value1,
          [property2]: value2,
        } as unknown as StateInputs);
        problem = validityError(solved, fluidData(fluid), system);
      } catch (error) {
        console.error("State validation failed", error);
        problem =
          "CoolProp rejected these inputs. Try different properties or values.";
      }
      // Closed, reopened or submitted again while the worker was solving.
      if (token !== submission.current) return;
      setSolving(false);
      if (problem) {
        setFormError(problem);
        return;
      }

      const id = generateId();
      setStates((prev) => [
        ...prev,
        normalizeStateDefinition({
          id,
          label: createStateLabel(prev.length + 1),
          property1,
          property2,
          value1: String(value1),
          value2: String(value2),
        }),
      ]);
      setFormState((prev) => ({ ...prev, value1: "", value2: "" }));
      setIsModalOpen(false);
    })();
  };

  // ── State list handlers ────────────────────────────────────────────────────

  const handleRemoveState = useCallback(
    (id: string) => setStates((prev) => prev.filter((item) => item.id !== id)),
    [setStates],
  );

  // Clearing is meant: nothing is left to continue.
  const handleClearAll = useCallback(() => {
    setStates([]);
    clearExplorer();
  }, [setStates]);

  // ── View / plot handlers ───────────────────────────────────────────────────

  const handleViewModeChange = useCallback(
    (mode: WorkspaceViewMode) => {
      if (mode !== viewMode) setViewMode(mode);
    },
    [viewMode, setViewMode],
  );

  const handleNavigateBack = useCallback(() => {
    // The tracked states are kept (see above): the settings page offers to
    // continue with them.
    const params = new URLSearchParams();
    params.set("fluid", fluid);
    params.set("units", units);
    navigate({ pathname: "/explorer", search: `?${params.toString()}` });
  }, [navigate, fluid, units]);

  // ── Form property handlers ─────────────────────────────────────────────────

  const handleFormChange = useCallback(
    (field: keyof FormState, value: string) => {
      if (field === "property1" || field === "property2") {
        const input = coolprop()
          .inputs()
          .find((i) => i.name === value);
        if (!input) return;
        const next = pickInput(formState, field, input.name);
        setFormState(next.form);
        setReplacement(next.replaced ?? null);
        return;
      }
      setFormState((prev) => ({ ...prev, [field]: value }));
    },
    [formState],
  );

  const handleSwap = useCallback(() => {
    setFormState(swapPair);
    setReplacement(null);
  }, []);

  // ── Derived display values ─────────────────────────────────────────────────

  const unitLabel = UNIT_LABELS[units] ?? units.toUpperCase();
  const statesSummary = states.length
    ? `${states.length} state${states.length > 1 ? "s" : ""} tracked`
    : "No states tracked yet";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="workspace">
      <WorkspaceHeader
        fluid={fluid}
        canViewGraph={canViewGraph}
        effectiveViewMode={effectiveViewMode}
        unitLabel={unitLabel}
        statesSummary={statesSummary}
        onViewModeChange={handleViewModeChange}
        onNavigateBack={handleNavigateBack}
      />

      {legacyLink ? (
        <div className="workspace__notice" role="status">
          <p>
            This link was created with an earlier version of Thermoprops and its
            states can no longer be opened. Add them again to share an
            up-to-date link.
          </p>
          <Button variant="ghost" size="sm" onClick={dismissLegacyLink}>
            <X />
            Dismiss
          </Button>
        </div>
      ) : null}

      <div className="workspace__content">
        {effectiveViewMode === "graph" ? (
          <div className="workspace__panel workspace__panel--graph">
            <ThermoPlot
              fluid={fluid}
              diagram={diagram}
              isolineKind={isolineKind}
              onDiagramChange={setDiagramId}
              onIsolineChange={setIsolineKind}
              onPlotError={handlePlotError}
              points={plotPoints}
              units={units}
            />
            <StateQuickActions
              states={computedStates}
              fluid={fluid}
              onAddState={handleOpenModal}
              onRemoveState={handleRemoveState}
              onClearAll={handleClearAll}
              fluidSelected={Boolean(fluid)}
              units={units}
            />
          </div>
        ) : (
          <div className="workspace__panel workspace__panel--table">
            <StateList
              states={computedStates}
              fluid={fluid}
              onAddState={handleOpenModal}
              onRemoveState={handleRemoveState}
              onClearAll={handleClearAll}
              fluidSelected={Boolean(fluid)}
              units={units}
            />
          </div>
        )}
      </div>

      <StateModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleStateSubmit}
        formState={formState}
        onFormChange={handleFormChange}
        onSwap={handleSwap}
        replacement={replacement}
        formError={formError}
        solving={solving}
        firstValueRef={firstValueRef}
        units={units}
        existingStates={computedStates}
      />
    </section>
  );
}
