import { TriangleAlert } from "lucide-react";
import type { InputName } from "@luisbedoia/coolprop-rs-wasm";
import type { ScriptResult, ScriptState } from "../dsl/evaluate";
import { formatQuantity } from "../dsl/format";
import { phaseLabel, propertyValue } from "../dsl/editor/describe";
import { formatNumber } from "../dsl/format";
import { fromSI, getDisplayUnit, type UnitSystem } from "../lib/units";
import { displayName } from "../coolprop";
import { count, tr } from "../i18n";

const COLUMNS: { label: string; name: InputName }[] = [
  { label: "T", name: "temperature" },
  { label: "P", name: "pressure" },
  { label: "h", name: "enthalpy" },
  { label: "s", name: "entropy" },
  { label: "x", name: "quality" },
];

const OUTPUTS = tr("Outputs", "Salidas");
const STATES = tr("States", "Estados");
const VALUES = tr("Values", "Valores");

function unit(name: string, units: UnitSystem) {
  return getDisplayUnit(name, units).replace(/\*/g, "·");
}

/** "T, x · two-phase", with the fluid when it is not the script's. */
function how(state: ScriptState, fluid: string | undefined): string {
  return [
    state.fluid && state.fluid !== fluid ? displayName(state.fluid) : null,
    state.how,
    state.state?.phase ? phaseLabel(state.state.phase) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function cell(state: ScriptState, name: InputName, units: UnitSystem): string {
  const v = state.state?.[name];
  return v === null || v === undefined
    ? "–"
    : formatNumber(fromSI(name, v, units));
}

type Props = {
  result: ScriptResult;
  onGoTo(line: number, col: number): void;
};

function Problems({ result, onGoTo }: Props) {
  if (result.diagnostics.length === 0) return null;
  return (
    <section
      className="results__section"
      aria-label={tr("Problems", "Problemas")}
    >
      <h2 className="results__heading results__heading--error">
        <TriangleAlert />{" "}
        {count(
          result.diagnostics.length,
          tr("problem", "problema"),
          tr("problems", "problemas"),
        )}
      </h2>
      <ul className="problems">
        {result.diagnostics.map((d, i) => (
          <li key={i}>
            <button type="button" onClick={() => onGoTo(d.line, d.col)}>
              <span className="problems__where">
                {tr("Line", "Línea")} {d.line}
              </span>
              <span>{d.message}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ResultsPanel({ result, onGoTo }: Props) {
  const units = result.unitSystem;
  const empty =
    result.states.length === 0 &&
    result.values.length === 0 &&
    result.prints.length === 0;
  return (
    <div className="results">
      <Problems result={result} onGoTo={onGoTo} />

      {empty && result.diagnostics.length === 0 && (
        <p className="results__empty">
          {tr(
            <>
              Define a state, e.g. <code>1: T = 25 °C, P = 1 bar</code>, and its
              properties appear here.
            </>,
            <>
              Define un estado, p. ej. <code>1: T = 25 °C, P = 1 bar</code>, y
              sus propiedades aparecen aquí.
            </>,
          )}
        </p>
      )}

      {result.prints.length > 0 && (
        <section className="results__section" aria-label={OUTPUTS}>
          <h2 className="results__heading">{OUTPUTS}</h2>
          {/* The first print is the answer: it leads, the rest follow. */}
          <dl className="outputs">
            {result.prints.map((p, i) => (
              <div
                key={i}
                className={
                  [i === 0 && "outputs__lead", p.error && "is-error"]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
              >
                <dt>{p.text}</dt>
                <dd>
                  {p.value ? formatQuantity(p.value, units, p.unit) : p.error}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {result.states.length > 0 && (
        <section className="results__section" aria-label={STATES}>
          <h2 className="results__heading">{STATES}</h2>
          <div
            className="states-table"
            role="region"
            aria-label={tr("States table", "Tabla de estados")}
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">{tr("State", "Estado")}</th>
                  {COLUMNS.map((c) => (
                    <th key={c.name} scope="col">
                      {c.label}
                      {unit(c.name, units) && (
                        <span className="unit"> {unit(c.name, units)}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.states.map((s) => (
                  <tr key={s.name}>
                    <th scope="row" title={how(s, result.fluid)}>
                      <button
                        type="button"
                        className="link states-table__name"
                        onClick={() => onGoTo(s.line, 1)}
                      >
                        {s.name}
                      </button>
                      <span className="states-table__how">
                        {how(s, result.fluid)}
                      </span>
                    </th>
                    {s.state ? (
                      COLUMNS.map((c) => (
                        <td key={c.name}>{cell(s, c.name, units)}</td>
                      ))
                    ) : (
                      <td
                        colSpan={COLUMNS.length}
                        className="is-error"
                        title={s.error}
                      >
                        {s.error}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="state-cards">
            {result.states.map((s) => (
              <li key={s.name} className={s.error ? "is-error" : undefined}>
                <header>
                  <button
                    type="button"
                    className="link state-cards__name"
                    onClick={() => onGoTo(s.line, 1)}
                  >
                    {s.name}
                  </button>
                  <span>{how(s, result.fluid)}</span>
                </header>
                {s.state ? (
                  <dl>
                    {COLUMNS.map((c) => {
                      const v = propertyValue(s, c.name, units);
                      return v ? (
                        <div key={c.name}>
                          <dt>{c.label}</dt>
                          <dd>{v}</dd>
                        </div>
                      ) : null;
                    })}
                  </dl>
                ) : (
                  <p>{s.error}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.values.length > 0 && (
        <section className="results__section" aria-label={VALUES}>
          <h2 className="results__heading">{VALUES}</h2>
          <dl className="variables">
            {result.values.map((v) => (
              <div key={v.name} className={v.error ? "is-error" : undefined}>
                <dt>
                  <button
                    type="button"
                    className="link"
                    onClick={() => onGoTo(v.line, 1)}
                  >
                    {v.name}
                  </button>
                </dt>
                <dd>{v.value ? formatQuantity(v.value, units) : v.error}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
