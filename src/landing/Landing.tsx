import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { exampleLink } from "../lib/examples";
import { useSavedWork } from "../lib/useSavedWork";
import { LiveCycle } from "./LiveCycle";
import { DemoVideo } from "./DemoVideo";
import "./Landing.css";

const EXAMPLES = [
  { id: "refrigeration", label: "Refrigeration" },
  { id: "regenerative", label: "Regenerative Rankine" },
  { id: "brayton", label: "Brayton" },
];

/** The six charts, as the State Explorer draws them for water. */
const CHARTS = [
  { id: "pressure_enthalpy", name: "p–h" },
  { id: "temperature_entropy", name: "T–s" },
  { id: "enthalpy_entropy", name: "h–s" },
  { id: "pressure_specific_volume", name: "p–v" },
  { id: "temperature_specific_volume", name: "T–v" },
  { id: "pressure_temperature", name: "p–T" },
];

/**
 * The way in, in PlayStation's chapters: a dark opening with a worksheet
 * the visitor can change, then a band for each mode with a recording of it
 * in use, what it covers, and the blue footer.
 */
export function Landing() {
  // This browser's last work in each mode, to continue it.
  const { worksheet, explorer: saved } = useSavedWork();
  const explorer = saved?.summary ?? null;
  const worksheetAction = worksheet
    ? "Continue your worksheet"
    : "Open the Worksheet";

  return (
    <div className="landing">
      <section className="landing__hero" aria-labelledby="landing-title">
        <div className="landing__inner landing__hero-grid">
          <h1 id="landing-title">Thermodynamic states, worked out</h1>
          <div className="landing__intro">
            <p>
              CoolProp’s properties for 30 fluids, in your browser. Write states
              as in your notebook and calculate with them, from a single heat to
              a whole cycle, or explore them one at a time.
            </p>
            <div className="landing__cta">
              <Link to="/worksheet" className="landing__primary">
                {worksheetAction} <ArrowRight aria-hidden="true" />
              </Link>
              <Link to="/explorer" className="landing__secondary">
                Open the State Explorer <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
          <LiveCycle />
        </div>
      </section>

      <section
        className="landing__mode landing__mode--worksheet"
        aria-labelledby="mode-worksheet"
      >
        <div className="landing__inner landing__mode-grid">
          <div className="landing__copy">
            <h2 id="mode-worksheet">Worksheet</h2>
            <p>
              Define states as in your notebook, read any of their properties by
              name (h1, s2) and calculate with them: a heat, a work, an
              efficiency, a whole cycle. Results, charts and units update as you
              type.
            </p>
            <p className="landing__note">
              <strong>In development.</strong> Next comes solving for unknowns,
              and more of what you would do in EES.
            </p>
            <div className="landing__actions">
              <Link to="/worksheet" className="landing__primary">
                {worksheetAction} <ArrowRight aria-hidden="true" />
              </Link>
              {worksheet && (
                <p className="landing__saved">
                  Saved in this browser: {worksheet}
                </p>
              )}
              <p className="landing__examples">
                Or start from an example:{" "}
                {EXAMPLES.map((e, i) => (
                  <span key={e.id}>
                    {i > 0 && " · "}
                    <Link to={exampleLink(e.id)}>{e.label}</Link>
                  </span>
                ))}
              </p>
            </div>
          </div>
          <DemoVideo
            name="worksheet"
            label="A refrigeration cycle written in the Worksheet with its suggestions, then its results and its chart"
          />
        </div>
      </section>

      <section
        className="landing__mode landing__mode--explorer"
        aria-labelledby="mode-explorer"
      >
        <div className="landing__inner landing__mode-grid">
          <div className="landing__copy">
            <h2 id="mode-explorer">State Explorer</h2>
            <p>
              Pick a fluid and a unit system, then add states by any two
              properties and see them in a table and on its charts.
            </p>
            <div className="landing__actions">
              {/* Its settings page offers to continue or to start again. */}
              <Link to="/explorer" className="landing__outline">
                Open the State Explorer <ArrowRight aria-hidden="true" />
              </Link>
              {explorer && (
                <p className="landing__saved">
                  Saved in this browser: {explorer}
                </p>
              )}
            </div>
          </div>
          <DemoVideo
            name="explorer"
            label="Water chosen in the State Explorer, then three states added by two properties each and shown on its T–s chart"
          />
        </div>
      </section>

      <section className="landing__charts" aria-labelledby="landing-charts">
        <div className="landing__inner">
          <h2 id="landing-charts">Six charts for every fluid</h2>
          <ul>
            {CHARTS.map((c) => (
              <li key={c.id}>
                <figure>
                  <img
                    src={`${import.meta.env.BASE_URL}demos/chart-${c.id}.jpg`}
                    alt={`The ${c.name} chart of water, with three states`}
                    width={1200}
                    height={504}
                    loading="lazy"
                    decoding="async"
                  />
                  <figcaption>{c.name}</figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="landing__facts" aria-labelledby="landing-facts">
        <div className="landing__inner landing__facts-grid">
          <h2 id="landing-facts">What it covers</h2>
          <ul>
            <li>
              <h3>30 fluids and refrigerants</h3>
              <p>
                Water, air, ammonia, CO₂, nitrogen, R134a, R410A, R32, R1234yf,
                propane…
              </p>
            </li>
            <li>
              <h3>Any two properties</h3>
              <p>
                Temperature, pressure, density, enthalpy, entropy, internal
                energy, quality and more.
              </p>
            </li>
            <li>
              <h3>Your units, your links</h3>
              <p>
                SI or imperial, °C, K or °F. Every link keeps its fluid, units
                and states.
              </p>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
