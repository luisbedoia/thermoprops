import { Button } from "../components/Button";
import type { ComputedState } from "./types";

const NUMBER_FORMAT = new Intl.NumberFormat(undefined, {
  minimumSignificantDigits: 3,
  maximumSignificantDigits: 8,
});

type StateListProps = {
  states: ComputedState[];
  onAddState: () => void;
  onRemoveState: (id: string) => void;
  fluidSelected: boolean;
};

export function StateList({
  states,
  onAddState,
  onRemoveState,
  fluidSelected,
}: StateListProps) {
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
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddState}
          disabled={!fluidSelected}
        >
          Add state
        </Button>
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
};

function StateRow({ state, onRemove }: StateRowProps) {
  return (
    <tr>
      <th scope="row">
        <span className="state-list__label">{state.definition.label}</span>
      </th>
      <td>
        <div className="state-list__chips">
          <span className="state-list__chip">
            {state.definition.property1} = {state.definition.value1}
          </span>
          <span className="state-list__chip">
            {state.definition.property2} = {state.definition.value2}
          </span>
        </div>
        <StateMetrics state={state} limit={4} variant="table" />
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
};

function StateCard({ state, onRemove }: StateCardProps) {
  return (
    <li className="state-card">
      <header className="state-card__header">
        <div>
          <span className="state-card__title">{state.definition.label}</span>
          <div className="state-card__chips">
            <span className="state-card__chip">
              {state.definition.property1} = {state.definition.value1}
            </span>
            <span className="state-card__chip">
              {state.definition.property2} = {state.definition.value2}
            </span>
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
      <StateMetrics state={state} limit={6} variant="card" />
    </li>
  );
}

type StateMetricsProps = {
  state: ComputedState;
  limit: number;
  variant: "table" | "card";
};

function StateMetrics({ state, limit, variant }: StateMetricsProps) {
  if (state.error) {
    return (
      <p className={`state-error state-error--${variant}`}>{state.error}</p>
    );
  }

  const metrics = state.results.slice(0, limit);

  return (
    <dl className={`state-metrics state-metrics--${variant}`}>
      {metrics.map((result) => (
        <div key={result.name} className="state-metrics__row">
          <dt>{result.description}</dt>
          <dd>
            {NUMBER_FORMAT.format(result.value)}
            {result.unit && <span>{result.unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

type StateQuickActionsProps = {
  states: ComputedState[];
  onAddState: () => void;
  onRemoveState: (id: string) => void;
  fluidSelected: boolean;
};

export function StateQuickActions({
  states,
  onAddState,
  onRemoveState,
  fluidSelected,
}: StateQuickActionsProps) {
  return (
    <section className="state-quick" aria-live="polite">
      <header className="state-quick__header">
        <h2>Tracked states</h2>
        <Button size="sm" onClick={onAddState} disabled={!fluidSelected}>
          Add state
        </Button>
      </header>
      {states.length === 0 ? (
        <p className="state-quick__empty">
          No states tracked yet. Add a state to populate the chart.
        </p>
      ) : (
        <ul className="state-quick__list">
          {states.map((state) => (
            <li key={state.definition.id} className="state-quick__item">
              <div className="state-quick__info">
                <span className="state-quick__label">
                  {state.definition.label}
                </span>
                <span className="state-quick__inputs">
                  {state.definition.property1} = {state.definition.value1} •{" "}
                  {state.definition.property2} = {state.definition.value2}
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
          ))}
        </ul>
      )}
    </section>
  );
}
