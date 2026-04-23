import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { calculateProperties, properties } from "./lib";
import { normalizeNumericInput } from "./lib/normalizeNumericInput";
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
  si: "SI",
  imperial: "Imperial",
};

const numericProperties = properties.filter((prop) => prop.input);

type FormState = {
  property1: string;
  property2: string;
  value1: string;
  value2: string;
};

// ── WorkspaceHeader ──────────────────────────────────────────────────────────

type WorkspaceHeaderProps = {
  fluid: string;
  canViewGraph: boolean;
  hasPlots: boolean;
  effectiveViewMode: WorkspaceViewMode;
  unitLabel: string;
  statesSummary: string;
  onViewModeChange: (mode: WorkspaceViewMode) => void;
  onNavigateBack: () => void;
};

function WorkspaceHeader({
  fluid,
  canViewGraph,
  hasPlots,
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
              data-tooltip={
                hasPlots
                  ? "The chart could not be generated for this fluid. Only the table view is available."
                  : "Charts are not available for this fluid. Use the table to view thermodynamic properties."
              }
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
  } = useWorkspaceUrlParams({ plotFailed });

  useEffect(() => {
    setPlotFailed(false);
  }, [fluid]);

  useEffect(() => {
    if (!fluid) {
      navigate("/settings", { replace: true });
    }
  }, [fluid, navigate]);

  const computedStates = useComputedStates(states, fluid);

  const plotPoints: PlotPoint[] = useMemo(
    () => getPlotPoints(computedStates, plotId),
    [computedStates, plotId],
  );

  // ── Modal / form state ─────────────────────────────────────────────────────

  const [formState, setFormState] = useState<FormState>(() => {
    const primary = numericProperties[0]?.name ?? "T";
    const secondary = numericProperties[1]?.name ?? "P";
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

    const value1 = Number(normalizedValue1);
    const value2 = Number(normalizedValue2);

    if (!Number.isFinite(value1) || !Number.isFinite(value2)) {
      setFormError("Both values must be numeric.");
      return;
    }

    try {
      calculateProperties(
        formState.property1,
        value1,
        formState.property2,
        value2,
        fluid,
      );
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
      value1: normalizedValue1,
      value2: normalizedValue2,
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
    navigate({ pathname: "/settings", search: `?${params.toString()}` });
  }, [navigate, fluid, units]);

  // ── Form property handlers ─────────────────────────────────────────────────

  const handleFormChange = useCallback(
    (field: keyof FormState, value: string) => {
      setFormState((prev) => {
        if (field === "property1") {
          if (value === prev.property2) {
            const fallback = numericProperties.find((prop) => prop.name !== value);
            return {
              ...prev,
              property1: value,
              property2: fallback?.name ?? prev.property2,
            };
          }
          return { ...prev, property1: value };
        }
        if (field === "property2") {
          if (value === prev.property1) {
            const fallback = numericProperties.find((prop) => prop.name !== value);
            return {
              ...prev,
              property1: fallback?.name ?? prev.property1,
              property2: value,
            };
          }
          return { ...prev, property2: value };
        }
        return { ...prev, [field]: value };
      });
    },
    [],
  );

  const propertyOptions1 = useMemo(
    () => numericProperties.filter((prop) => prop.name !== formState.property2),
    [formState.property2],
  );

  const propertyOptions2 = useMemo(
    () => numericProperties.filter((prop) => prop.name !== formState.property1),
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
        hasPlots={hasPlots}
        effectiveViewMode={effectiveViewMode}
        unitLabel={unitLabel}
        statesSummary={statesSummary}
        onViewModeChange={handleViewModeChange}
        onNavigateBack={handleNavigateBack}
      />

      <div className="workspace__content">
        {effectiveViewMode === "graph" ? (
          <div className="workspace__panel workspace__panel--graph">
            <ThermoPlot
              fluid={fluid}
              plotId={plotId}
              isolineParameter={isolineParameter}
              onPlotChange={setPlotId}
              onIsolineParameterChange={setIsolineParameter}
              onPlotError={setPlotFailed}
              points={plotPoints}
            />
            <StateQuickActions
              states={computedStates}
              onAddState={handleOpenModal}
              onRemoveState={handleRemoveState}
              onClearAll={handleClearAll}
              fluidSelected={Boolean(fluid)}
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
      />
    </section>
  );
}
