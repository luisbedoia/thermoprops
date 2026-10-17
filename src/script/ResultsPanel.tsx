import { TriangleAlert } from "lucide-react";
import type { InputName } from "@luisbedoia/coolprop-rs-wasm";
import type { ScriptResult, ScriptState } from "../dsl/evaluate";
import { formatQuantity } from "../dsl/format";
import { phaseLabel, propertyValue } from "../dsl/editor/describe";
import { formatNumber } from "../dsl/format";
import { fromSI, getDisplayUnit, type UnitSystem } from "../lib/units";

const COLUMNS: { label: string; name: InputName }[] = [
  { label: "T", name: "temperature" },
  { label: "P", name: "pressure" },
  { label: "h", name: "enthalpy" },
  { label: "s", name: "entropy" },
  { label: "x", name: "quality" },
];

function unit(name: string, units: UnitSystem) {
  return getDisplayUnit(name, units).replace(/\*/g, "·");
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

export function Problems({ result, onGoTo }: Props) {
  if (result.diagnostics.length === 0) return null;
  return (
    <section className="results__section" aria-label="Problems">
      <h2 className="results__heading results__heading--error">
        <TriangleAlert /> {result.diagnostics.length} problem
        {result.diagnostics.length === 1 ? "" : "s"}
      </h2>
      <ul className="problems">
        {result.diagnostics.map((d, i) => (
          <li key={i}>
            <button type="button" onClick={() => onGoTo(d.line, d.col)}>
              <span className="problems__where">Line {d.line}</span>
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
          Define a state, e.g. <code>state 1: T = 25 °C, P = 1 bar</code>, and
          its properties appear here.
        </p>
      )}

      {result.prints.length > 0 && (
        <section className="results__section" aria-label="Outputs">
          <h2 className="results__heading">Outputs</h2>
          <dl className="outputs">
            {result.prints.map((p, i) => (
              <div key={i} className={p.error ? "is-error" : undefined}>
                <dt>{p.text}</dt>
                <dd>{p.value ? formatQuantity(p.value, units) : p.error}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {result.states.length > 0 && (
        <section className="results__section" aria-label="States">
          <h2 className="results__heading">States</h2>
          <div
            className="states-table"
            role="region"
            aria-label="States table"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">State</th>
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
                    <th scope="row">
                      <button
                        type="button"
                        className="link"
                        onClick={() => onGoTo(s.line, 1)}
                      >
                        {s.name}
                      </button>
                      {s.fluid && s.fluid !== result.fluid && (
                        <span className="unit"> {s.fluid}</span>
                      )}
                      <span className="states-table__how">
                        {s.how}
                        {s.state?.phase && (
                          <span className={`phase phase--${s.state.phase}`}>
                            {phaseLabel(s.state.phase)}
                          </span>
                        )}
                      </span>
                    </th>
                    {s.state ? (
                      COLUMNS.map((c) => (
                        <td key={c.name}>{cell(s, c.name, units)}</td>
                      ))
                    ) : (
                      <td colSpan={COLUMNS.length} className="is-error">
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
                  <span className="muted">
                    {[s.fluid !== result.fluid ? s.fluid : null, s.how]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {s.state && (
                    <span className={`phase phase--${s.state.phase ?? "none"}`}>
                      {phaseLabel(s.state.phase)}
                    </span>
                  )}
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
        <section className="results__section" aria-label="Variables">
          <h2 className="results__heading">Variables</h2>
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
