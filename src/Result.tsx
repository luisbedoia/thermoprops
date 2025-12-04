import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { calculateProperties, properties } from "./lib";
import { ThermoPlot, PlotPoint } from "./Plot";
import { Button } from "./components/Button";
import { StateList, StateQuickActions } from "./workspace/StateList";
import { StateModal } from "./workspace/StateModal";
import type { ComputedState, StateDefinition } from "./workspace/types";
import {
  createStateLabel,
  decodeStates,
  encodeStates,
  generateId,
  getPropertyValue,
  statesEqual,
} from "./workspace/utils";
import "./Result.css";

type FormState = {
  property1: string;
  property2: string;
  value1: string;
  value2: string;
};

const UNIT_LABELS: Record<string, string> = {
  si: "SI",
  imperial: "Imperial",
};

const PLOT_DEFAULT = "ph";
const ISOLINE_PARAM_DEFAULT = 19; // Temperatura (T)
type WorkspaceViewMode = "graph" | "table";
const VIEW_DEFAULT: WorkspaceViewMode = "graph";

const numericProperties = properties.filter((prop) => prop.input);

function normalizeNumericInput(value: string): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const compact = trimmed.replace(/\s+/g, "");
  if (/[.,]{2,}/.test(compact)) {
    return "";
  }
  const commaCount = (compact.match(/,/g) ?? []).length;
  const dotCount = (compact.match(/\./g) ?? []).length;

  if (commaCount > 0 && dotCount > 0) {
    const lastComma = compact.lastIndexOf(",");
    const lastDot = compact.lastIndexOf(".");

    if (lastComma > lastDot) {
      const withoutDots = compact.replace(/\./g, "");
      return withoutDots.replace(/,/g, ".");
    }
    return compact.replace(/,/g, "");
  }

  if (commaCount > 1) {
    return compact.replace(/,/g, "");
  }

  if (commaCount === 1) {
    return compact.replace(/,/g, ".");
  }

  if (dotCount > 1) {
    return compact.replace(/\./g, "");
  }

  return compact;
}

function normalizeStateDefinition(
  definition: StateDefinition,
): StateDefinition {
  const normalizedValue1 = normalizeNumericInput(definition.value1);
  const normalizedValue2 = normalizeNumericInput(definition.value2);

  if (
    normalizedValue1 === definition.value1 &&
    normalizedValue2 === definition.value2
  ) {
    return definition;
  }

  return {
    ...definition,
    value1: normalizedValue1,
    value2: normalizedValue2,
  };
}

export function WorkspaceView() {
  const navigate = useNavigate();
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
  const [formState, setFormState] = useState<FormState>(() => {
    const primary = numericProperties[0]?.name ?? "T";
    const secondary = numericProperties[1]?.name ?? "P";
    return {
      property1: primary,
      property2: secondary,
      value1: "",
      value2: "",
    };
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const firstValueRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!fluid) {
      navigate("/settings", { replace: true });
    }
  }, [fluid, navigate]);

  useEffect(() => {
    if (!fluid) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    if (states.length) {
      next.set("states", encodeStates(states));
    } else {
      next.delete("states");
    }
    next.set("view", viewMode);
    next.set("plot", plotId);
    next.set("isoline", String(isolineParameter));
    next.set("units", units);
    next.set("fluid", fluid);

    const currentParams = searchParams.toString();
    const nextParams = next.toString();
    if (nextParams !== currentParams) {
      setSearchParams(next, { replace: true });
    }
  }, [
    states,
    plotId,
    isolineParameter,
    units,
    fluid,
    viewMode,
    searchParams,
    setSearchParams,
  ]);

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

  const computedStates: ComputedState[] = useMemo(() => {
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

  const plotPoints: PlotPoint[] = useMemo(() => {
    // Obtener definición de ejes dinámicamente del catálogo
    // Por ahora, mapeo manual de plotId a propiedades (se puede mejorar con catálogo)
    const axesMap: Record<string, { x: string; y: string }> = {
      ph: { x: "H", y: "P" },
      ts: { x: "S", y: "T" },
      pt: { x: "T", y: "P" },
      rh: { x: "H", y: "D" },
    };

    const axes = axesMap[plotId];
    if (!axes) {
      return [];
    }
    return computedStates
      .map((state) => {
        if (state.error) {
          return null;
        }
        const x = getPropertyValue(state.definition, state.results, axes.x);
        const y = getPropertyValue(state.definition, state.results, axes.y);
        if (x == null || y == null) {
          return null;
        }
        return {
          id: state.definition.id,
          label: state.definition.label,
          x,
          y,
        };
      })
      .filter((point): point is PlotPoint => Boolean(point));
  }, [computedStates, plotId]);

  const handleOpenModal = () => {
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setFormError(null);
    setIsModalOpen(false);
  };

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

  const handleRemoveState = (id: string) => {
    setStates((prev) => prev.filter((item) => item.id !== id));
  };

  const handleViewModeChange = (mode: WorkspaceViewMode) => {
    if (mode !== viewMode) {
      setViewMode(mode);
    }
  };

  const handlePlotChange = (value: string) => {
    setPlotId(value);
  };

  const handleIsolineParameterChange = (value: number) => {
    setIsolineParameter(value);
  };

  const handleFormChange = (field: keyof FormState, value: string) => {
    setFormState((prev) => {
      if (field === "property1") {
        if (value === prev.property2) {
          const fallback = numericProperties.find(
            (prop) => prop.name !== value,
          );
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
          const fallback = numericProperties.find(
            (prop) => prop.name !== value,
          );
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
  };

  const handleNavigateBack = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("plot");
    params.delete("isoline");
    const search = params.toString();
    navigate({
      pathname: "/settings",
      search: search ? `?${search}` : "",
    });
  };

  const propertyOptions1 = useMemo(
    () => numericProperties.filter((prop) => prop.name !== formState.property2),
    [formState.property2],
  );

  const propertyOptions2 = useMemo(
    () => numericProperties.filter((prop) => prop.name !== formState.property1),
    [formState.property1],
  );

  const unitLabel = UNIT_LABELS[units] ?? units.toUpperCase();
  const statesSummary = states.length
    ? `${states.length} state${states.length > 1 ? "s" : ""} tracked`
    : "No states tracked yet";
  const headerSubtitle = unitLabel
    ? `${unitLabel} units · ${statesSummary}`
    : statesSummary;

  return (
    <section className="workspace">
      <header className="workspace__header">
        <div className="workspace__title">
          <h1>{fluid || "Select a fluid in settings"}</h1>
          <p>{headerSubtitle}</p>
        </div>
        <div className="workspace__actions">
          <Button variant="ghost" size="sm" onClick={handleNavigateBack}>
            Back to settings
          </Button>
          <div
            className="workspace__view-toggle"
            role="group"
            aria-label="Workspace content view"
          >
            <Button
              variant="plain"
              className={viewMode === "graph" ? "is-active" : ""}
              aria-pressed={viewMode === "graph"}
              onClick={() => handleViewModeChange("graph")}
            >
              Chart
            </Button>
            <Button
              variant="plain"
              className={viewMode === "table" ? "is-active" : ""}
              aria-pressed={viewMode === "table"}
              onClick={() => handleViewModeChange("table")}
            >
              Table
            </Button>
          </div>
        </div>
      </header>

      <div className="workspace__content">
        {viewMode === "graph" ? (
          <div className="workspace__panel workspace__panel--graph">
            <ThermoPlot
              fluid={fluid}
              plotId={plotId}
              isolineParameter={isolineParameter}
              onPlotChange={handlePlotChange}
              onIsolineParameterChange={handleIsolineParameterChange}
              points={plotPoints}
            />
            <StateQuickActions
              states={computedStates}
              onAddState={handleOpenModal}
              onRemoveState={handleRemoveState}
              fluidSelected={Boolean(fluid)}
            />
          </div>
        ) : (
          <div className="workspace__panel workspace__panel--table">
            <StateList
              states={computedStates}
              onAddState={handleOpenModal}
              onRemoveState={handleRemoveState}
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
