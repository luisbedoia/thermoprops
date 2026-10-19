import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { TEMPLATES } from "../dsl/templates";
import { exampleLink } from "../lib/examples";
import { useSavedWork } from "../lib/useSavedWork";
import "./Home.css";

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
      <h1 id="home-title">What are you working on?</h1>

      <div className="home__modes">
        <article className="home__mode" aria-labelledby="home-worksheet">
          <h2 id="home-worksheet">Worksheet</h2>
          <p>
            States, properties by name and calculations with them, up to a whole
            cycle.
          </p>
          <div className="home__actions">
            <Link to="/worksheet" className="home__primary">
              {worksheet ? "Continue your worksheet" : "Open the Worksheet"}
              <ArrowRight aria-hidden="true" />
            </Link>
            {worksheet && <p className="home__saved">Saved: {worksheet}</p>}
          </div>
          <div className="home__examples">
            <h3>Start from an example</h3>
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
          <h2 id="home-explorer">State Explorer</h2>
          <p>
            A fluid and a unit system, then states by any two properties, in a
            table and on its charts.
          </p>
          <div className="home__actions">
            {explorer ? (
              <>
                <Link
                  to={{ pathname: "/workspace", search: explorer.search }}
                  className="home__primary"
                >
                  Continue with {explorer.summary}
                  <ArrowRight aria-hidden="true" />
                </Link>
                {/* Its settings page asks before the saved one goes. */}
                <Link to="/explorer" className="home__secondary">
                  Start a new workspace
                </Link>
              </>
            ) : (
              <Link to="/explorer" className="home__primary">
                Open the State Explorer
                <ArrowRight aria-hidden="true" />
              </Link>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
