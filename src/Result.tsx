import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { InputName } from "@luisbedoia/coolprop-rs-wasm";
import {
  areCompatibleInputs,
  inputs,
  isInputName,
  resolveUnitSystem,
  solveState,
  toSI,
} from "./lib";
import { normalizeNumericInput } from "./lib/normalizeNumericInput";
import { coolprop } from "./coolprop";
import { ThermoPlot } from "./Plot";
import type { PlotPoint } from "./Plot";
import { Button } from "./components/Button";
import { StateList, StateQuickActions } from "./workspace/StateList";
import { StateModal } from "./workspace/StateModal";
import { createStateLabel, generateId, getPlotPoints, normalizeStateDefinition } from "./workspace/utils";
import { useComputedStates, useWorkspaceUrlParams } from "./workspace/hooks";
import type { WorkspaceViewMode } from "./workspace/hooks";
import "./Result.css";

const UNIT_LABELS: Record<string, string> = {
  celsius: "Default",
  kelvin: "Kelvin",
  imperial: "Imperial",
  // Legacy alias — older URLs may still carry units=si.
  si: "SI",
};

type FormState = {
  property1: InputName;
  property2: InputName;
  value1: string;
  value2: string;
};

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

  const [plotFailed, setPlotFailed] = useState(false);

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
  } = useWorkspaceUrlParams({ plotFailed });

  useEffect(() => {
    setPlotFailed(false);
  }, [fluid]);

  useEffect(() => {
    if (!fluid) {
      navigate("/", { replace: true });
    }
  }, [fluid, navigate]);

  const computedStates = useComputedStates(states, fluid);

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const firstValueRef = useRef<HTMLInputElement | null>(null);

  const handleOpenModal = useCallback(() => {
    setFormError(null);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setFormError(null);
    setIsModalOpen(false);
  }, []);

  const handleStateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

    try {
      solveState(fluid, formState.property1, value1, formState.property2, value2);
    } catch (error) {
      console.error("State validation failed", error);
      setFormError(
        "CoolProp rejected these inputs. Try different properties or values.",
      );
      return;
    }

    const nextState = normalizeStateDefinition({
      id: generateId(),
      label: createStateLabel(states.length + 1),
      property1: formState.property1,
      property2: formState.property2,
      value1: String(value1),
      value2: String(value2),
    });

    setStates((prev) => [...prev, nextState]);
    setFormState((prev) => ({ ...prev, value1: "", value2: "" }));
    setIsModalOpen(false);
  };

  // ── State list handlers ────────────────────────────────────────────────────

  const handleRemoveState = useCallback(
    (id: string) => setStates((prev) => prev.filter((item) => item.id !== id)),
    [setStates],
  );

  const handleClearAll = useCallback(() => setStates([]), [setStates]);

  // ── View / plot handlers ───────────────────────────────────────────────────

  const handleViewModeChange = useCallback(
    (mode: WorkspaceViewMode) => {
      if (mode !== viewMode) setViewMode(mode);
    },
    [viewMode, setViewMode],
  );

  const handleNavigateBack = useCallback(() => {
    const params = new URLSearchParams();
    params.set("fluid", fluid);
    params.set("units", units);
    navigate({ pathname: "/", search: `?${params.toString()}` });
  }, [navigate, fluid, units]);

  // ── Form property handlers ─────────────────────────────────────────────────

  const handleFormChange = useCallback(
    (field: keyof FormState, value: string) => {
      setFormState((prev) => {
        if (field === "property1" || field === "property2") {
          if (!isInputName(value)) return prev;
          const other = field === "property1" ? "property2" : "property1";
          // Keep the other input if it still forms a solvable pair; else
          // switch it to the first one that does.
          const otherValue = areCompatibleInputs(value, prev[other])
            ? prev[other]
            : (inputs().find((i) => areCompatibleInputs(i.name, value))?.name ??
              prev[other]);
          return { ...prev, [field]: value, [other]: otherValue };
        }
        return { ...prev, [field]: value };
      });
    },
    [],
  );

  const propertyOptions1 = useMemo(
    () => inputs().filter((i) => areCompatibleInputs(i.name, formState.property2)),
    [formState.property2],
  );

  const propertyOptions2 = useMemo(
    () => inputs().filter((i) => areCompatibleInputs(i.name, formState.property1)),
    [formState.property1],
  );

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
            This link was created with an earlier version of Thermoprops and
            its states can no longer be opened. Add them again to share an
            up-to-date link.
          </p>
          <Button variant="ghost" size="sm" onClick={dismissLegacyLink}>
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
              onPlotError={setPlotFailed}
              points={plotPoints}
              units={units}
            />
            <StateQuickActions
              states={computedStates}
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
        propertyOptions1={propertyOptions1}
        propertyOptions2={propertyOptions2}
        formError={formError}
        firstValueRef={firstValueRef}
        units={units}
        existingStates={computedStates}
      />
    </section>
  );
}
