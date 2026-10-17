import {
  COMMON_UNITS,
  FUNCTIONS,
  PROCESSES,
  PROPERTIES,
  UNIT_SYSTEMS,
} from "../dsl/vocabulary";

const MOD =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    ? "⌘"
    : "Ctrl";

const SHORTCUTS: [string, string][] = [
  [`${MOD} Space`, "Suggestions"],
  ["Shift Alt F", "Format"],
  [`${MOD} /`, "Comment line"],
  [`${MOD} Z / ${MOD} Shift Z`, "Undo / redo"],
  [`${MOD} F`, "Find and replace"],
  ["Alt ↑ / ↓", "Move line"],
  [`${MOD} D`, "Select next match"],
];

/** The language at a glance, built from the same vocabulary as the editor. */
export function ReferencePanel() {
  return (
    <div className="reference">
      <section>
        <h2 className="results__heading">Statements</h2>
        <pre className="reference__code">{`fluid R134a
units celsius
state 1: T = -10 °C, x = 1
state 2 = 1 -> isentropic(P = 1.2 MPa)
state 5 [Water]: T = 25 °C, P = 1 bar
let COP = (1.h - 4.h) / (2.h - 1.h)
cycle 1 -> 2 -> 3 -> 4 -> 1
print COP, 2.T - 1.T`}</pre>
        <p className="muted">
          One statement per line; <code>#</code> starts a comment.{" "}
          <code>1.h</code> reads state 1's enthalpy. States and variables can be
          defined in any order. A number without a unit is read in the unit
          system: with <code>units celsius</code>, <code>T = 25</code> is 25 °C.
        </p>
      </section>

      <section>
        <h2 className="results__heading">Processes</h2>
        <dl className="reference__list">
          {PROCESSES.map((p) => (
            <div key={p.name}>
              <dt>
                <code>
                  {p.snippet.replace(
                    /\$\{\d+:?([^}]*)\}/g,
                    (_, t: string) => t || "…",
                  )}
                </code>
              </dt>
              <dd>{p.info}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="results__heading">Properties</h2>
        <dl className="reference__grid">
          {PROPERTIES.map((p) => (
            <div key={p.name}>
              <dt>
                <code>{p.name}</code>
              </dt>
              <dd>
                {p.info}
                {!p.input && <span className="muted"> · read only</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="results__heading">Units</h2>
        <p className="reference__units">
          {COMMON_UNITS.map((u) => (
            <code key={u.name} title={u.detail}>
              {u.name}
            </code>
          ))}
        </p>
        <dl className="reference__list">
          {UNIT_SYSTEMS.map((u) => (
            <div key={u.name}>
              <dt>
                <code>units {u.name}</code>
              </dt>
              <dd>{u.detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="results__heading">Functions</h2>
        <p className="reference__units">
          {FUNCTIONS.map((f) => (
            <code key={f.name} title={f.info}>
              {f.detail}
            </code>
          ))}
        </p>
      </section>

      <section className="reference__shortcuts">
        <h2 className="results__heading">Keyboard</h2>
        <dl className="reference__list">
          {SHORTCUTS.map(([k, what]) => (
            <div key={k}>
              <dt>
                <kbd>{k}</kbd>
              </dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
