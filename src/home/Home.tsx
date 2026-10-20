import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { TEMPLATES } from "../dsl/templates";
import { exampleLink } from "../lib/examples";
import { useSavedWork } from "../lib/useSavedWork";
import "./Home.css";
import { tr } from "../i18n";

/** The examples worth starting from: all but the blank one. */
const EXAMPLES = TEMPLATES.filter((t) => t.id !== "blank");

/**
 * The installed app's first screen, in place of the website's landing: the
 * two modes, each with what this browser has saved to continue, and the
 * worksheet's examples. No pitch: whoever installed the app knows it.
 */
export function Home() {
  const { worksheet, explorer } = useSavedWork();

  return (
    <section className="home" aria-labelledby="home-title">
      <h1 id="home-title">
        {tr("What are you working on?", "¿En qué estás trabajando?")}
      </h1>

      <div className="home__modes">
        <article className="home__mode" aria-labelledby="home-worksheet">
          <h2 id="home-worksheet">{tr("Worksheet", "Hoja de trabajo")}</h2>
          <p>
            {tr(
              "States, properties by name and calculations with them, up to a whole cycle.",
              "Estados, propiedades por nombre y cálculos con ellas, hasta un ciclo completo.",
            )}
          </p>
          <div className="home__actions">
            <Link to="/worksheet" className="home__primary">
              {worksheet
                ? tr("Continue your worksheet", "Continuar tu hoja de trabajo")
                : tr("Open the Worksheet", "Abrir la Hoja de trabajo")}
              <ArrowRight aria-hidden="true" />
            </Link>
            {worksheet && (
              <p className="home__saved">
                {tr("Saved:", "Guardada:")} {worksheet}
              </p>
            )}
          </div>
          <div className="home__examples">
            <h3>{tr("Start from an example", "Empezar con un ejemplo")}</h3>
            <ul>
              {EXAMPLES.map((t) => (
                <li key={t.id}>
                  <Link to={exampleLink(t.id)}>{t.name}</Link>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="home__mode" aria-labelledby="home-explorer">
          <h2 id="home-explorer">
            {tr("State Explorer", "Explorador de estados")}
          </h2>
          <p>
            {tr(
              "A fluid and a unit system, then states by any two properties, in a table and on its charts.",
              "Un fluido y un sistema de unidades, luego estados por dos propiedades cualesquiera, en una tabla y en sus diagramas.",
            )}
          </p>
          <div className="home__actions">
            {explorer ? (
              <>
                <Link
                  to={{ pathname: "/workspace", search: explorer.search }}
                  className="home__primary"
                >
                  {tr("Continue with", "Continuar con")} {explorer.summary}
                  <ArrowRight aria-hidden="true" />
                </Link>
                {/* Its settings page asks before the saved one goes. */}
                <Link to="/explorer" className="home__secondary">
                  {tr(
                    "Start a new workspace",
                    "Empezar un nuevo espacio de trabajo",
                  )}
                </Link>
              </>
            ) : (
              <Link to="/explorer" className="home__primary">
                {tr(
                  "Open the State Explorer",
                  "Abrir el Explorador de estados",
                )}
                <ArrowRight aria-hidden="true" />
              </Link>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
