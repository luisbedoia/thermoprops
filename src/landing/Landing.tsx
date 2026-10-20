import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { exampleLink } from "../lib/examples";
import { useSavedWork } from "../lib/useSavedWork";
import { LiveCycle } from "./LiveCycle";
import { DemoVideo } from "./DemoVideo";
import { locale, localizedPath, tr } from "../i18n";
import "./Landing.css";

const EXAMPLES = [
  { id: "refrigeration", label: tr("Refrigeration", "Refrigeración") },
  {
    id: "regenerative",
    label: tr("Regenerative Rankine", "Rankine regenerativo"),
  },
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
    ? tr("Continue your worksheet", "Continuar tu hoja de trabajo")
    : tr("Open the Worksheet", "Abrir la Hoja de trabajo");
  const openExplorer = tr(
    "Open the State Explorer",
    "Abrir el Explorador de estados",
  );
  const savedHere = tr("Saved in this browser:", "Guardado en este navegador:");

  return (
    <div className="landing">
      <section className="landing__hero" aria-labelledby="landing-title">
        <div className="landing__inner landing__hero-grid">
          {/* What it is, as people search for it, over what it does. */}
          <h1 id="landing-title">
            <span className="landing__kicker">
              {tr(
                "Free thermodynamic properties calculator",
                "Calculadora de propiedades termodinámicas gratuita",
              )}
            </span>{" "}
            {tr(
              "Thermodynamic states, worked out",
              "Estados termodinámicos, resueltos",
            )}
          </h1>
          <div className="landing__intro">
            <p>
              {tr(
                "Thermodynamic properties of 30 fluids and refrigerants, by CoolProp, in your browser. Write states as in your notebook and calculate with them, from a single heat to a whole cycle, or explore them one at a time.",
                "Propiedades termodinámicas de 30 fluidos y refrigerantes, calculadas con CoolProp en tu navegador. Escribe estados como en tu cuaderno y calcula con ellos, desde un calor hasta un ciclo completo, o explóralos uno a uno.",
              )}
            </p>
            <div className="landing__cta">
              <Link to="/worksheet" className="landing__primary">
                {worksheetAction} <ArrowRight aria-hidden="true" />
              </Link>
              <Link to="/explorer" className="landing__secondary">
                {openExplorer} <ArrowRight aria-hidden="true" />
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
            <h2 id="mode-worksheet">{tr("Worksheet", "Hoja de trabajo")}</h2>
            <p>
              {tr(
                "Define states as in your notebook, read any of their properties by name (h1, s2) and calculate with them: a heat, a work, an efficiency, a whole cycle. Results, charts and units update as you type.",
                "Define estados como en tu cuaderno, lee cualquiera de sus propiedades por nombre (h1, s2) y calcula con ellas: un calor, un trabajo, una eficiencia, un ciclo completo. Resultados, diagramas y unidades se actualizan mientras escribes.",
              )}
            </p>
            <p className="landing__note">
              {tr(
                <>
                  <strong>In development.</strong> Next comes solving for
                  unknowns, and more of what you would do in EES.
                </>,
                <>
                  <strong>En desarrollo.</strong> Lo siguiente es resolver
                  incógnitas, y más de lo que harías en EES.
                </>,
              )}
            </p>
            <div className="landing__actions">
              <Link to="/worksheet" className="landing__primary">
                {worksheetAction} <ArrowRight aria-hidden="true" />
              </Link>
              {worksheet && (
                <p className="landing__saved">
                  {savedHere} {worksheet}
                </p>
              )}
              <p className="landing__examples">
                {tr("Or start from an example:", "O empieza con un ejemplo:")}{" "}
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
            label={tr(
              "A refrigeration cycle written in the Worksheet with its suggestions, then its results and its chart",
              "Un ciclo de refrigeración escrito en la Hoja de trabajo con sus sugerencias, luego sus resultados y su diagrama",
            )}
          />
        </div>
      </section>

      <section
        className="landing__mode landing__mode--explorer"
        aria-labelledby="mode-explorer"
      >
        <div className="landing__inner landing__mode-grid">
          <div className="landing__copy">
            <h2 id="mode-explorer">
              {tr("State Explorer", "Explorador de estados")}
            </h2>
            <p>
              {tr(
                "Pick a fluid and a unit system, then add states by any two properties and see them in a table and on its charts.",
                "Elige un fluido y un sistema de unidades, luego agrega estados por dos propiedades cualesquiera y míralos en una tabla y en sus diagramas.",
              )}
            </p>
            <div className="landing__actions">
              {/* Its settings page offers to continue or to start again. */}
              <Link to="/explorer" className="landing__outline">
                {openExplorer} <ArrowRight aria-hidden="true" />
              </Link>
              {explorer && (
                <p className="landing__saved">
                  {savedHere} {explorer}
                </p>
              )}
            </div>
          </div>
          <DemoVideo
            name="explorer"
            label={tr(
              "Water chosen in the State Explorer, then three states added by two properties each and shown on its T–s chart",
              "Agua elegida en el Explorador de estados, luego tres estados agregados por dos propiedades cada uno y mostrados en su diagrama T–s",
            )}
          />
        </div>
      </section>

      <section className="landing__charts" aria-labelledby="landing-charts">
        <div className="landing__inner">
          <h2 id="landing-charts">
            {tr(
              "Six charts for every fluid",
              "Seis diagramas para cada fluido",
            )}
          </h2>
          <ul>
            {CHARTS.map((c) => (
              <li key={c.id}>
                <figure>
                  <img
                    src={`${import.meta.env.BASE_URL}demos/chart-${c.id}.jpg`}
                    alt={tr(
                      `The ${c.name} chart of water, with three states`,
                      `El diagrama ${c.name} del agua, con tres estados`,
                    )}
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
          <h2 id="landing-facts">{tr("What it covers", "Qué incluye")}</h2>
          <ul>
            <li>
              <h3>
                <Link to={localizedPath("/fluids", locale)!}>
                  {tr(
                    "30 fluids and refrigerants",
                    "30 fluidos y refrigerantes",
                  )}
                </Link>
              </h3>
              <p>
                {tr(
                  "Water, air, ammonia, CO₂, nitrogen, R134a, R410A, R32, R1234yf, propane…",
                  "Agua, aire, amoníaco, CO₂, nitrógeno, R134a, R410A, R32, R1234yf, propano…",
                )}
              </p>
            </li>
            <li>
              <h3>
                {tr("Any two properties", "Dos propiedades cualesquiera")}
              </h3>
              <p>
                {tr(
                  "Temperature, pressure, density, enthalpy, entropy, internal energy, quality and more.",
                  "Temperatura, presión, densidad, entalpía, entropía, energía interna, calidad y más.",
                )}
              </p>
            </li>
            <li>
              <h3>
                {tr("Your units, your links", "Tus unidades, tus enlaces")}
              </h3>
              <p>
                {tr(
                  "SI or imperial, °C, K or °F. Every link keeps its fluid, units and states.",
                  "SI o imperial, °C, K o °F. Cada enlace conserva su fluido, unidades y estados.",
                )}
              </p>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
