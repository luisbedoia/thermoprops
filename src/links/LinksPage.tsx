import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { localizedPath, locale, tr } from "../i18n";
import { TEMPLATES } from "../dsl/templates";
import "../fluids/Fluids.css";
import { FLUID_NAMES, SITE, SYNTAX, worksheetLink } from "./links";
import "./Links.css";

/**
 * How to link to a calculation: the Worksheet's script in its address, for
 * assistants (ChatGPT, Claude…) to answer with a link that opens it solved,
 * and for anyone who writes links by hand.
 */
export function LinksPage() {
  const examples = TEMPLATES.filter((t) =>
    ["refrigeration", "rankine"].includes(t.id),
  );
  return (
    <article className="fluid links">
      <h1>
        {tr("Link to a calculation", "Enlazar un cálculo")}{" "}
        <span>
          {tr(
            "Thermoprops addresses, for assistants and for people",
            "Las direcciones de Thermoprops, para asistentes y para personas",
          )}
        </span>
      </h1>
      <p className="fluid__lead">
        {tr(
          "A Worksheet's script lives in its address: a link opens it already solved, in the browser of whoever follows it. An assistant answering a thermodynamics question can write the script, link it, and the reader gets every state, value and chart, computed by CoolProp.",
          "El código de una Hoja de trabajo vive en su dirección: un enlace la abre ya resuelta, en el navegador de quien lo sigue. Un asistente que responde una pregunta de termodinámica puede escribir el código y enlazarlo, y el lector obtiene cada estado, valor y diagrama, calculados con CoolProp.",
        )}
      </p>

      <section aria-labelledby="links-address">
        <h2 id="links-address">{tr("The address", "La dirección")}</h2>
        <pre className="links__code">
          <code>{`${SITE}/worksheet/?s=<script>`}</code>
        </pre>
        <ul className="links__list">
          <li>
            {tr(
              <>
                <code>&lt;script&gt;</code> is the script, encoded as{" "}
                <code>encodeURIComponent</code> does: spaces as <code>%20</code>
                , line breaks as <code>%0A</code>, <code>+</code> as{" "}
                <code>%2B</code>, <code>#</code> as <code>%23</code>.
              </>,
              <>
                <code>&lt;script&gt;</code> es el código, codificado como lo
                hace <code>encodeURIComponent</code>: espacios como{" "}
                <code>%20</code>, saltos de línea como <code>%0A</code>,{" "}
                <code>+</code> como <code>%2B</code>, <code>#</code> como{" "}
                <code>%23</code>.
              </>,
            )}
          </li>
          <li>
            {tr(
              "The results are computed in the browser that opens the link (CoolProp in WebAssembly): the page's HTML does not hold them, so a reader without JavaScript sees only the script.",
              "Los resultados se calculan en el navegador que abre el enlace (CoolProp en WebAssembly): el HTML de la página no los contiene, así que un lector sin JavaScript solo ve el código.",
            )}
          </li>
          <li>
            {tr(
              "Nothing is sent anywhere: the script stays in the link and in the reader's browser.",
              "Nada se envía a ninguna parte: el código queda en el enlace y en el navegador del lector.",
            )}
          </li>
        </ul>
      </section>

      <section aria-labelledby="links-script">
        <h2 id="links-script">{tr("The script", "El código")}</h2>
        <p className="fluid__hint">
          {tr(
            "One statement per line; # starts a comment.",
            "Una instrucción por línea; # empieza un comentario.",
          )}
        </p>
        <div className="fluid__table" role="region" tabIndex={0}>
          <table className="links__syntax">
            <tbody>
              {SYNTAX.map(([code, en, es]) => (
                <tr key={code}>
                  <th scope="row">
                    <code>{code}</code>
                  </th>
                  <td>{tr(en, es)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="links__terms">
          <div>
            <dt>{tr("Properties", "Propiedades")}</dt>
            <dd>
              {tr(
                "T, P, h, s, x (quality), D (density), v, u, cp, cv, mu, k, Pr, Z, a (speed of sound), g; a state's are read as T2, h1, x4.",
                "T, P, h, s, x (calidad), D (densidad), v, u, cp, cv, mu, k, Pr, Z, a (velocidad del sonido), g; las de un estado se leen como T2, h1, x4.",
              )}
            </dd>
          </div>
          <div>
            <dt>{tr("Processes", "Procesos")}</dt>
            <dd>
              {tr(
                "isentropic, compressed and expanded (with eta), throttled, isobaric, isothermal, isochoric, isenthalpic, polytropic (with n).",
                "isentropic, compressed y expanded (con eta), throttled, isobaric, isothermal, isochoric, isenthalpic, polytropic (con n).",
              )}
            </dd>
          </div>
          <div>
            <dt>{tr("Units", "Unidades")}</dt>
            <dd>
              °C, K, °F, °R, Pa, kPa, MPa, bar, atm, psi, kJ/kg, BTU/lb,
              kJ/(kg*K), kg/m^3, m^3/kg, kg/s, kg/h, kW, MW, W, hp, BTU/h, kJ,
              m/s, %.{" "}
              {tr(
                "A number without a unit is read in the script's units.",
                "Un número sin unidad se lee en las unidades del código.",
              )}
            </dd>
          </div>
          <div>
            <dt>{tr("Fluids", "Fluidos")}</dt>
            <dd>{FLUID_NAMES.join(", ")}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="links-examples">
        <h2 id="links-examples">{tr("Examples", "Ejemplos")}</h2>
        <div className="links__examples">
          {examples.map((t) => (
            <figure key={t.id}>
              <figcaption>{t.name}</figcaption>
              <pre className="links__code">
                <code>{t.source.trim()}</code>
              </pre>
              <a className="fluid__primary" href={worksheetLink(t.source)}>
                {tr("Open it solved", "Abrirlo resuelto")}
                <ArrowRight aria-hidden="true" />
              </a>
            </figure>
          ))}
        </div>
      </section>

      <section aria-labelledby="links-other">
        <h2 id="links-other">{tr("Other addresses", "Otras direcciones")}</h2>
        <ul className="links__list">
          <li>
            {tr(
              <>
                A fluid's tables (saturation by temperature and by pressure,
                superheated vapor) and diagrams, as HTML:{" "}
                <code>{SITE}/fluids/r134a/</code>, in Spanish{" "}
                <code>{SITE}/es/fluidos/r134a/</code>. All of them:{" "}
                <Link to={localizedPath("/fluids", locale)!}>
                  {tr("fluids", "fluidos")}
                </Link>
                .
              </>,
              <>
                Las tablas de un fluido (saturación por temperatura y por
                presión, vapor sobrecalentado) y sus diagramas, en HTML:{" "}
                <code>{SITE}/es/fluidos/r134a/</code>, en inglés{" "}
                <code>{SITE}/fluids/r134a/</code>. Todos:{" "}
                <Link to={localizedPath("/fluids", locale)!}>fluidos</Link>.
              </>,
            )}
          </li>
          <li>
            {tr(
              <>
                The State Explorer with a fluid chosen:{" "}
                <code>{SITE}/explorer/?fluid=R134a&amp;units=celsius</code>{" "}
                (units: celsius, kelvin or imperial).
              </>,
              <>
                El Explorador de estados con un fluido elegido:{" "}
                <code>{SITE}/explorer/?fluid=R134a&amp;units=celsius</code>{" "}
                (unidades: celsius, kelvin o imperial).
              </>,
            )}
          </li>
        </ul>
      </section>
    </article>
  );
}
