import {
  CLAUSE_WORDS,
  COMMON_UNITS,
  FUNCTIONS,
  PROCESSES,
  PROPERTIES,
  REFERENCE_STATES,
  UNIT_SYSTEMS,
} from "../dsl/vocabulary";
import { tr } from "../i18n";

const SUGGESTIONS = tr("Suggestions", "Sugerencias");
const ACCEPT = tr(
  "Accept a suggestion, next field",
  "Aceptar una sugerencia, campo siguiente",
);
const FORMAT = tr("Format", "Formatear");
const COMMENT = tr("Comment line", "Comentar la línea");
const UNDO = tr("Undo / redo", "Deshacer / rehacer");
const FIND = tr("Find and replace", "Buscar y reemplazar");
const MOVE = tr("Move line", "Mover la línea");

// As CodeMirror tells the platforms apart.
const MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * The editor's shortcuts, each checked by pressing it on macOS, Windows and
 * Linux. On a Mac, Ctrl Space is often taken by the system (input sources),
 * hence ⌥ I too; Shift Alt F types a character there, hence ⌘ ⇧ F.
 */
const SHORTCUTS: [string, string][] = MAC
  ? [
      [tr("⌃ Space  or  ⌥ I", "⌃ Espacio  o  ⌥ I"), SUGGESTIONS],
      ["Tab", ACCEPT],
      ["⌘ ⇧ F", FORMAT],
      ["⌘ /", COMMENT],
      ["⌘ Z  /  ⌘ ⇧ Z", UNDO],
      ["⌘ F", FIND],
      ["⌥ ↑  /  ⌥ ↓", MOVE],
    ]
  : [
      [tr("Ctrl Space", "Ctrl Espacio"), SUGGESTIONS],
      ["Tab", ACCEPT],
      ["Ctrl Shift F", FORMAT],
      ["Ctrl /", COMMENT],
      ["Ctrl Z  /  Ctrl Y", UNDO],
      ["Ctrl F", FIND],
      ["Alt ↑  /  Alt ↓", MOVE],
    ];

/** The language at a glance, built from the same vocabulary as the editor. */
export function ReferencePanel() {
  return (
    <div className="reference">
      <section>
        <h2 className="results__heading">
          {tr("Statements", "Instrucciones")}
        </h2>
        <pre className="reference__code">{`fluid R134a
units celsius
1: T = -10 °C, sat vapor
2: from 1, compressed to P = 1.2 MPa, eta = 80%
3: P = P2, sat liquid
4: from 3, throttled to P = P1
5 [Water]: T = 25 °C, P = 1 bar
COP = (h1 - h4) / (h2 - h1)
draw 1 -> 2 -> 3 -> 4 -> 1
print COP, T2 in °F`}</pre>
        <p className="muted">
          {tr(
            <>
              One statement per line; <code>#</code> starts a comment.{" "}
              <code>1:</code> defines state 1, by two properties or{" "}
              <code>from</code> another state by a process; <code>name =</code>{" "}
              defines a value. <code>h1</code> reads state 1's enthalpy (also{" "}
              <code>1.h</code>; for a state named <code>inlet</code>,{" "}
              <code>inlet.h</code>). States and values can be defined in any
              order. A number without a unit is read in the unit system: with{" "}
              <code>units celsius</code>, <code>T = 25</code> is 25 °C.
            </>,
            <>
              Una instrucción por línea; <code>#</code> inicia un comentario.{" "}
              <code>1:</code> define el estado 1, por dos propiedades o{" "}
              <code>from</code> otro estado mediante un proceso;{" "}
              <code>nombre =</code> define un valor. <code>h1</code> lee la
              entalpía del estado 1 (también <code>1.h</code>; para un estado
              llamado <code>entrada</code>, <code>entrada.h</code>). Estados y
              valores se pueden definir en cualquier orden. Un número sin unidad
              se lee en el sistema de unidades: con <code>units celsius</code>,{" "}
              <code>T = 25</code> es 25 °C.
            </>,
          )}
        </p>
      </section>

      <section>
        <h2 className="results__heading">{tr("Processes", "Procesos")}</h2>
        <p className="muted">
          {tr(
            <>
              After <code>from 1,</code> in a state's definition.
            </>,
            <>
              Después de <code>from 1,</code> en la definición de un estado.
            </>,
          )}
        </p>
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
        <h2 className="results__heading">{tr("Words", "Palabras")}</h2>
        <dl className="reference__list">
          {CLAUSE_WORDS.map((w) => (
            <div key={w.name}>
              <dt>
                <code>{w.name}</code>
              </dt>
              <dd>{w.info}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="results__heading">{tr("Properties", "Propiedades")}</h2>
        <dl className="reference__grid">
          {PROPERTIES.map((p) => (
            <div key={p.name}>
              <dt>
                <code>{p.name}</code>
              </dt>
              <dd>
                {p.info}
                {!p.input && (
                  <span className="muted">
                    {" "}
                    · {tr("read only", "solo lectura")}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="results__heading">{tr("Units", "Unidades")}</h2>
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
        <h2 className="results__heading">
          {tr("Reference state", "Estado de referencia")}
        </h2>
        <p className="muted">
          {tr(
            <>
              Where enthalpy and entropy are measured from; differences do not
              change. Compare with the textbooks' refrigerant tables using{" "}
              <code>reference ASHRAE</code>.
            </>,
            <>
              Desde dónde se miden la entalpía y la entropía; las diferencias no
              cambian. Compara con las tablas de refrigerantes de los textos
              usando <code>reference ASHRAE</code>.
            </>,
          )}
        </p>
        <dl className="reference__list">
          {REFERENCE_STATES.map((r) => (
            <div key={r.name}>
              <dt>
                <code>reference {r.name}</code>
              </dt>
              <dd>
                {r.detail}. {r.info}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="results__heading">{tr("Functions", "Funciones")}</h2>
        <dl className="reference__list">
          {FUNCTIONS.map((f) => (
            <div key={f.name}>
              <dt>
                <code>{f.example}</code>
              </dt>
              <dd>{f.info}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="reference__shortcuts">
        <h2 className="results__heading">{tr("Keyboard", "Teclado")}</h2>
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
