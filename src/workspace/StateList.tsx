import { Button } from "../components/Button";
import { MathText } from "../components/MathText";
import {
  phaseInfo,
  quantityInfo,
  quantityValue,
  tableQuantities,
} from "../lib/quantities";
import type { Quantity } from "../lib/quantities";
import { fromSI, getDisplayUnit, resolveUnitSystem } from "../lib/units";
import type { UnitSystem } from "../lib/units";
import { symbolToMath, unitToMath } from "../lib/unitsFormat";
import type { ComputedState, StateDefinition } from "./types";

function UnitMath({ unit, className }: { unit: string; className?: string }) {
  if (!unit) return null;
  return (
    <MathText
      className={className}
      expression={unitToMath(unit)}
      ariaLabel={unit}
    />
  );
}

function PropertyMath({ name }: { name: Quantity }) {
  const { symbol, description } = quantityInfo(name);
  return <MathText expression={symbolToMath(symbol)} ariaLabel={description} />;
}

const NUMBER_FORMAT = new Intl.NumberFormat(undefined, {
  minimumSignificantDigits: 3,
  maximumSignificantDigits: 8,
});

// Basic state subset surfaced in the chart-view accordion. The inputs
// themselves are left out of the metrics, so this set just whitelists
// "introductory" properties — anything else (Z, λ, μ, Pr, cp, cv, g, a,
// phase) lives in the full Table view.
const QUICK_BASIC_PROPERTIES: ReadonlySet<string> = new Set<Quantity>([
  "temperature",
  "pressure",
  "density",
  "enthalpy",
  "internal_energy",
  "entropy",
  "quality",
]);

function formatInputValue(
  propertyName: string,
  storedValue: string,
  units: UnitSystem,
): string {
  const numeric = Number(storedValue);
  if (!Number.isFinite(numeric)) return storedValue;
  return NUMBER_FORMAT.format(fromSI(propertyName, numeric, units));
}

type ChipsProps = {
  definition: StateDefinition;
  units: UnitSystem;
  className: string;
};

function StateChips({ definition, units, className }: ChipsProps) {
  const unit1 = getDisplayUnit(definition.property1, units);
  const unit2 = getDisplayUnit(definition.property2, units);
  return (
    <>
      <span className={className} title={quantityInfo(definition.property1).description}>
        <PropertyMath name={definition.property1} /> ={" "}
        {formatInputValue(definition.property1, definition.value1, units)}
        {unit1 ? " " : null}
        <UnitMath unit={unit1} />
      </span>
      <span className={className} title={quantityInfo(definition.property2).description}>
        <PropertyMath name={definition.property2} /> ={" "}
        {formatInputValue(definition.property2, definition.value2, units)}
        {unit2 ? " " : null}
        <UnitMath unit={unit2} />
      </span>
    </>
  );
}

type StateListProps = {
  states: ComputedState[];
  onAddState: () => void;
  onRemoveState: (id: string) => void;
  onClearAll: () => void;
  fluidSelected: boolean;
  units: string;
};

export function StateList({
  states,
  onAddState,
  onRemoveState,
  onClearAll,
  fluidSelected,
  units,
}: StateListProps) {
  const system = resolveUnitSystem(units);
  const summary =
    states.length === 0
      ? "No states tracked yet."
      : `${states.length} state${states.length === 1 ? "" : "s"} tracked`;

  return (
    <section className="state-list" aria-live="polite">
      <header className="state-list__header">
        <div>
          <h2>Tracked states</h2>
          <p className="state-list__summary">{summary}</p>
        </div>
        <div className="state-list__header-actions">
          {states.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="state-list__clear-all"
              onClick={() => {
                if (window.confirm("Remove all tracked states? This cannot be undone.")) {
                  onClearAll();
                }
              }}
            >
              Clear all
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddState}
            disabled={!fluidSelected}
          >
            Add state
          </Button>
        </div>
      </header>

      {states.length === 0 ? (
        <p className="state-list__empty">
          No states added yet. Add a state to populate the chart.
        </p>
      ) : (
        <>
          <div
            className="state-list__table-wrapper"
            role="region"
            aria-label="Tracked states table"
          >
            <table className="state-list__table">
              <thead>
                <tr>
                  <th scope="col">State</th>
                  <th scope="col">Details</th>
                  <th scope="col" className="state-list__table-actions">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {states.map((state) => (
                  <StateRow
                    key={state.definition.id}
                    state={state}
                    onRemove={onRemoveState}
                    units={system}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <ul className="state-list__cards" aria-label="Tracked states list">
            {states.map((state) => (
              <StateCard
                key={state.definition.id}
                state={state}
                onRemove={onRemoveState}
                units={system}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

type StateRowProps = {
  state: ComputedState;
  onRemove: (id: string) => void;
  units: UnitSystem;
};

function StateRow({ state, onRemove, units }: StateRowProps) {
  return (
    <tr>
      <th scope="row">
        <span className="state-list__label">{state.definition.label}</span>
      </th>
      <td>
        <div className="state-list__chips">
          <StateChips
            definition={state.definition}
            units={units}
            className="state-list__chip"
          />
        </div>
        <StateMetrics state={state} variant="table" units={units} />
      </td>
      <td className="state-list__actions">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(state.definition.id)}
          aria-label={`Remove ${state.definition.label}`}
        >
          Remove
        </Button>
      </td>
    </tr>
  );
}

type StateCardProps = {
  state: ComputedState;
  onRemove: (id: string) => void;
  units: UnitSystem;
};

function StateCard({ state, onRemove, units }: StateCardProps) {
  return (
    <li className="state-card">
      <header className="state-card__header">
        <div>
          <span className="state-card__title">{state.definition.label}</span>
          <div className="state-card__chips">
            <StateChips
              definition={state.definition}
              units={units}
              className="state-card__chip"
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="state-card__remove"
          onClick={() => onRemove(state.definition.id)}
          aria-label={`Remove ${state.definition.label}`}
        >
          Remove
        </Button>
      </header>
      <StateMetrics state={state} variant="card" units={units} />
    </li>
  );
}

type StateMetricsProps = {
  state: ComputedState;
  variant: "table" | "card";
  units: UnitSystem;
  filter?: ReadonlySet<string>;
};

function StateMetrics({ state, variant, units, filter }: StateMetricsProps) {
  if (state.error || !state.state) {
    return (
      <p className={`state-error state-error--${variant}`}>
        {state.error ?? "Unable to evaluate this state."}
      </p>
    );
  }
  const solved = state.state;
  const { property1, property2 } = state.definition;

  // Every quantity defined for this state except the two inputs, in catalog
  // order; the phase goes after the thermodynamic properties.
  const metrics = tableQuantities()
    .filter((q) => q !== property1 && q !== property2)
    .filter((q) => !filter || filter.has(q))
    .flatMap((q) => {
      const value = quantityValue(solved, q);
      return value === null ? [] : [{ name: q, value }];
    });
  const showPhase = !filter || filter.has("phase");

  return (
    <dl className={`state-metrics state-metrics--${variant}`}>
      {metrics.map(({ name, value }) => {
        const displayUnit = getDisplayUnit(name, units);
        const { description } = quantityInfo(name);
        return (
          <div key={name} className="state-metrics__row">
            <dt title={description}>
              <PropertyMath name={name} />
              <span className="state-metrics__name">{description}</span>
            </dt>
            <dd>
              {NUMBER_FORMAT.format(fromSI(name, value, units))}
              <UnitMath unit={displayUnit} />
            </dd>
          </div>
        );
      })}
      {showPhase ? (
        <div className="state-metrics__row">
          <dt>
            <span className="state-metrics__name">Phase</span>
          </dt>
          <dd title={phaseInfo(solved.phase)?.description}>
            {phaseInfo(solved.phase)?.label ?? "unknown"}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

type StateQuickActionsProps = {
  states: ComputedState[];
  onAddState: () => void;
  onRemoveState: (id: string) => void;
  onClearAll: () => void;
  fluidSelected: boolean;
  units: string;
};

export function StateQuickActions({
  states,
  onAddState,
  onRemoveState,
  onClearAll,
  fluidSelected,
  units,
}: StateQuickActionsProps) {
  const system = resolveUnitSystem(units);
  return (
    <section className="state-quick" aria-live="polite">
      <header className="state-quick__header">
        <h2>Tracked states</h2>
        <div className="state-quick__header-actions">
          {states.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="state-quick__clear-all"
              onClick={() => {
                if (window.confirm("Remove all tracked states? This cannot be undone.")) {
                  onClearAll();
                }
              }}
            >
              Clear all
            </Button>
          )}
          <Button size="sm" onClick={onAddState} disabled={!fluidSelected}>
            Add state
          </Button>
        </div>
      </header>
      {states.length === 0 ? (
        <p className="state-quick__empty">
          No states tracked yet. Add a state to populate the chart.
        </p>
      ) : (
        <ul className="state-quick__list">
          {states.map((state) => {
            const unit1 = getDisplayUnit(state.definition.property1, system);
            const unit2 = getDisplayUnit(state.definition.property2, system);
            const value1 = formatInputValue(
              state.definition.property1,
              state.definition.value1,
              system,
            );
            const value2 = formatInputValue(
              state.definition.property2,
              state.definition.value2,
              system,
            );
            return (
            <li key={state.definition.id} className="state-quick__item">
              <details className="state-quick__details">
                <summary className="state-quick__summary">
                  <div className="state-quick__info">
                    <span className="state-quick__label">
                      {state.definition.label}
                    </span>
                    <span className="state-quick__inputs">
                      <PropertyMath name={state.definition.property1} /> = {value1}
                      {unit1 ? " " : null}
                      <UnitMath unit={unit1} />,{" "}
                      <PropertyMath name={state.definition.property2} /> = {value2}
                      {unit2 ? " " : null}
                      <UnitMath unit={unit2} />
                    </span>
                  </div>
                </summary>
                <StateMetrics
                  state={state}
                  variant="card"
                  units={system}
                  filter={QUICK_BASIC_PROPERTIES}
                />
              </details>
              <Button
                variant="ghost"
                size="sm"
                className="state-quick__remove"
                onClick={() => onRemoveState(state.definition.id)}
                aria-label={`Remove ${state.definition.label}`}
              >
                Remove
              </Button>
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
