import { Button } from "../components/Button";
import { MathText } from "../components/MathText";
import {
  fromSI,
  getDisplayUnit,
  propertyLabel,
  propertyToMath,
  resolveUnitSystem,
  unitToMath,
} from "../lib";
import type { UnitSystem } from "../lib";
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

function PropertyMath({ name }: { name: string }) {
  return (
    <MathText
      expression={propertyToMath(name)}
      ariaLabel={propertyLabel(name) ?? name}
    />
  );
}

const NUMBER_FORMAT = new Intl.NumberFormat(undefined, {
  minimumSignificantDigits: 3,
  maximumSignificantDigits: 8,
});

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
      <span className={className} title={propertyLabel(definition.property1)}>
        <PropertyMath name={definition.property1} /> ={" "}
        {formatInputValue(definition.property1, definition.value1, units)}
        {unit1 ? " " : null}
        <UnitMath unit={unit1} />
      </span>
      <span className={className} title={propertyLabel(definition.property2)}>
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
        <StateMetrics state={state} limit={4} variant="table" units={units} />
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
      <StateMetrics state={state} limit={6} variant="card" units={units} />
    </li>
  );
}

type StateMetricsProps = {
  state: ComputedState;
  limit: number;
  variant: "table" | "card";
  units: UnitSystem;
};

function StateMetrics({ state, limit, variant, units }: StateMetricsProps) {
  if (state.error) {
    return (
      <p className={`state-error state-error--${variant}`}>{state.error}</p>
    );
  }

  const metrics = state.results.slice(0, limit);

  return (
    <dl className={`state-metrics state-metrics--${variant}`}>
      {metrics.map((result) => {
        const displayValue = fromSI(result.name, result.value, units);
        const displayUnit = getDisplayUnit(result.name, units);
        const tooltip = propertyLabel(result.name) ?? result.description;
        return (
          <div key={result.name} className="state-metrics__row">
            <dt title={tooltip}>
              <PropertyMath name={result.name} />
            </dt>
            <dd>
              {NUMBER_FORMAT.format(displayValue)}
              <UnitMath unit={displayUnit} />
            </dd>
          </div>
        );
      })}
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
              <div className="state-quick__info">
                <span className="state-quick__label">
                  {state.definition.label}
                </span>
                <span className="state-quick__inputs">
                  <PropertyMath name={state.definition.property1} /> = {value1}
                  {unit1 ? " " : null}
                  <UnitMath unit={unit1} /> •{" "}
                  <PropertyMath name={state.definition.property2} /> = {value2}
                  {unit2 ? " " : null}
                  <UnitMath unit={unit2} />
                </span>
              </div>
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
