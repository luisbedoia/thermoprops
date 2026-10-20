import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { locale, tr } from "../i18n";
import { plainFormula } from "../lib/formula";
import type { FluidSummary } from "./data";
import { fluidsPath } from "./paths";
import { loadSummaries } from "./load";
import { FLUIDS_TITLE } from "./meta";
import { pageData } from "./pageData";
import "./Fluids.css";

const NUMBER = new Intl.NumberFormat("en-US", {
  maximumSignificantDigits: 4,
  useGrouping: false,
});

/** Every fluid's page, with what tells them apart: formula and critical point. */
export function FluidIndex() {
  const { pathname } = useLocation();
  const [fluids, setFluids] = useState(() =>
    pageData<FluidSummary[]>(pathname),
  );

  useEffect(() => {
    if (fluids) return;
    let live = true;
    void loadSummaries().then((all) => live && setFluids(all));
    return () => {
      live = false;
    };
  }, [fluids]);

  useEffect(() => {
    document.title = FLUIDS_TITLE;
  }, []);

  const sorted = fluids
    ? [...fluids].sort((a, b) =>
        a.display[locale].localeCompare(b.display[locale], locale),
      )
    : null;

  return (
    <article className="fluid">
      <h1>
        {tr("Fluids and refrigerants", "Fluidos y refrigerantes")}{" "}
        <span>
          {tr("Thermodynamic properties", "Propiedades termodinámicas")}
        </span>
      </h1>
      <p className="fluid__lead">
        {tr(
          "For each fluid: its constants, a saturation table, and its p–h and T–s diagrams, computed with CoolProp. Any state of them, from any two properties, in the State Explorer or the Worksheet.",
          "De cada fluido: sus constantes, una tabla de saturación y sus diagramas p–h y T–s, calculados con CoolProp. Cualquiera de sus estados, desde dos propiedades cualesquiera, en el Explorador de estados o en la Hoja de trabajo.",
        )}
      </p>
      {sorted ? (
        <div className="fluid__table" role="region" tabIndex={0}>
          <table>
            <caption>
              {tr(
                "Fluids, with their critical point",
                "Fluidos, con su punto crítico",
              )}
            </caption>
            <thead>
              <tr>
                <th scope="col">{tr("Fluid", "Fluido")}</th>
                <th scope="col">{tr("Formula", "Fórmula")}</th>
                <th scope="col">Tc °C</th>
                <th scope="col">pc MPa</th>
                <th scope="col">M g/mol</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((f) => (
                <tr key={f.slug}>
                  <th scope="row">
                    <Link to={fluidsPath(f.slug)}>{f.display[locale]}</Link>
                  </th>
                  <td>{plainFormula(f.formula) ?? "—"}</td>
                  <td>{NUMBER.format(f.tc - 273.15)}</td>
                  <td>{NUMBER.format(f.pc / 1e6)}</td>
                  <td>{NUMBER.format(f.molarMass * 1000)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="app-loader" role="status">
          {tr("Loading the fluids…", "Cargando los fluidos…")}
        </p>
      )}
    </article>
  );
}
