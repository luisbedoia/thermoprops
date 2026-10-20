import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { locale, tr } from "../i18n";
import { plainFormula } from "../lib/formula";
import type { FluidPage as Page, FluidSummary, SaturationRow } from "./data";
import { FluidChart } from "./FluidChart";
import { loadFluidPage } from "./load";
import { fluidName, fluidTitle } from "./meta";
import { pageData } from "./pageData";
import { fluidsPath } from "./paths";
import "./Fluids.css";

/** Five significant digits, without grouping: as the textbooks' tables. */
const NUMBER = new Intl.NumberFormat("en-US", {
  maximumSignificantDigits: 5,
  useGrouping: false,
});
const num = (v: number) => NUMBER.format(v);
const celsius = (k: number) => num(k - 273.15);

/**
 * A fluid's page, for search engines and to start from: its constants, a
 * saturation table as the textbooks print them, its p–h and T–s diagrams,
 * and the way into the app with it.
 */
export function FluidPage() {
  const { slug = "" } = useParams();
  const { pathname } = useLocation();
  // Built: the data it was built with; opened within the app: worked out.
  const [page, setPage] = useState(() => pageData<Page>(pathname));
  const [missing, setMissing] = useState(false);
  const current = page?.fluid.slug === slug ? page : null;

  useEffect(() => {
    if (current) return;
    let live = true;
    void loadFluidPage(slug).then(
      (p) => live && (p ? setPage(p) : setMissing(true)),
      () => live && setMissing(true),
    );
    return () => {
      live = false;
    };
  }, [slug, current]);

  useEffect(() => {
    if (current) document.title = fluidTitle(current);
  }, [current]);

  if (!current)
    return (
      <p className="app-loader" role="status">
        {missing
          ? tr(
              "No fluid at this address.",
              "No hay un fluido en esta dirección.",
            )
          : tr("Computing its properties…", "Calculando sus propiedades…")}
      </p>
    );
  return <Content page={current} />;
}

function Content({ page }: { page: Page }) {
  const { fluid, data, critical, saturation, charts } = page;
  const name = fluid.display[locale];
  const title = fluidName(fluid, data.aliases);
  const formula = plainFormula(data.formula);
  const middle = saturation[Math.floor(saturation.length / 2)];
  const source = [
    `fluid ${data.name}`,
    "units celsius",
    middle
      ? `1: T = ${Math.round(middle.T - 273.15)} °C, sat vapor`
      : "1: T = 25 °C, P = 1 bar",
    "print P1, h1, s1",
    "",
  ].join("\n");

  return (
    <article className="fluid">
      <nav className="fluid__crumbs" aria-label={tr("Breadcrumb", "Ruta")}>
        <Link to={fluidsPath()}>{tr("Fluids", "Fluidos")}</Link> ›{" "}
        <span>{name}</span>
      </nav>
      <h1>
        {title}{" "}
        <span>
          {tr("Thermodynamic properties", "Propiedades termodinámicas")}
        </span>
      </h1>
      <p className="fluid__lead">
        {tr(
          `Saturation table, p–h and T–s diagrams and constants of ${name}${formula ? ` (${formula})` : ""}, computed with CoolProp. Any other state of ${name}, from any two properties, in the State Explorer or the Worksheet.`,
          `Tabla de saturación, diagramas p–h y T–s y constantes de ${name}${formula ? ` (${formula})` : ""}, calculados con CoolProp. Cualquier otro estado, desde dos propiedades cualesquiera, en el Explorador de estados o en la Hoja de trabajo.`,
        )}
      </p>
      <div className="fluid__cta">
        <Link
          className="fluid__primary"
          to={{ pathname: "/explorer", search: `?fluid=${data.name}` }}
        >
          {tr(`Calculate a state of ${name}`, `Calcular un estado de ${name}`)}
          <ArrowRight aria-hidden="true" />
        </Link>
        <Link
          className="fluid__secondary"
          to={{
            pathname: "/worksheet",
            search: `?${new URLSearchParams({ s: source })}`,
          }}
        >
          {tr("Open it in the Worksheet", "Abrirlo en la Hoja de trabajo")}
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>

      <section aria-labelledby="fluid-constants">
        <h2 id="fluid-constants">{tr("Constants", "Constantes")}</h2>
        <dl className="fluid__constants">
          {formula && <Fact term={tr("Formula", "Fórmula")} value={formula} />}
          {data.aliases.length > 0 && (
            <Fact
              term={tr("Also known as", "También llamado")}
              value={data.aliases.join(", ")}
            />
          )}
          <Fact term="CAS" value={data.cas} />
          <Fact
            term={tr("Molar mass", "Masa molar")}
            value={`${num(data.molar_mass * 1000)} g/mol`}
          />
          <Fact
            term={tr("Critical temperature", "Temperatura crítica")}
            value={`${celsius(critical.temperature)} °C (${num(critical.temperature)} K)`}
          />
          <Fact
            term={tr("Critical pressure", "Presión crítica")}
            value={`${num(critical.pressure / 1e6)} MPa`}
          />
          <Fact
            term={tr("Critical density", "Densidad crítica")}
            value={`${num(critical.density)} kg/m³`}
          />
          <Fact
            term={tr("Triple point", "Punto triple")}
            value={`${celsius(data.t_triple)} °C, ${num(data.p_triple / 1000)} kPa`}
          />
          <Fact
            term={tr("Acentric factor", "Factor acéntrico")}
            value={num(data.acentric)}
          />
          <Fact
            term={tr("Valid up to", "Válido hasta")}
            value={`${celsius(data.t_max)} °C, ${num(data.p_max / 1e6)} MPa`}
          />
        </dl>
      </section>

      {saturation.length > 0 && (
        <Saturation rows={saturation} name={name} mixture={data.pseudo_pure} />
      )}

      {charts.length > 0 && (
        <section aria-labelledby="fluid-charts">
          <h2 id="fluid-charts">{tr("Diagrams", "Diagramas")}</h2>
          <div className="fluid__charts">
            {charts.map((c) => {
              const caption =
                c.id === "pressure_enthalpy"
                  ? tr(
                      `p–h diagram of ${name}, with isotherms`,
                      `Diagrama p–h de ${name}, con isotermas`,
                    )
                  : tr(
                      `T–s diagram of ${name}, with isobars`,
                      `Diagrama T–s de ${name}, con isobaras`,
                    );
              return (
                <figure key={c.id}>
                  <FluidChart chart={c} title={caption} />
                  <figcaption>{caption}</figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      )}

      <p className="fluid__note">
        {tr(
          <>
            Enthalpy and entropy are measured from {name}'s own reference state
            (CoolProp's default). The textbooks' refrigerant tables use
            ASHRAE's: in the Worksheet, write <code>reference ASHRAE</code>.
          </>,
          <>
            La entalpía y la entropía se miden desde el estado de referencia
            propio de {name} (el predeterminado de CoolProp). Las tablas de
            refrigerantes de los textos usan el de ASHRAE: en la Hoja de
            trabajo, escribe <code>reference ASHRAE</code>.
          </>,
        )}
      </p>

      <Others fluids={page.fluids} current={fluid.slug} />
    </article>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt>{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Saturation({
  rows,
  name,
  mixture,
}: {
  rows: SaturationRow[];
  name: string;
  mixture: boolean;
}) {
  return (
    <section aria-labelledby="fluid-saturation">
      <h2 id="fluid-saturation">
        {tr("Saturation table", "Tabla de saturación")}
      </h2>
      <p className="fluid__hint">
        {mixture
          ? tr(
              `${name} is a mixture: at a temperature, it starts boiling (bubble) and ends (dew) at different pressures.`,
              `${name} es una mezcla: a una temperatura empieza a hervir (burbuja) y termina (rocío) a presiones distintas.`,
            )
          : tr(
              "By temperature: saturated liquid (f) and saturated vapor (g).",
              "Por temperatura: líquido saturado (f) y vapor saturado (g).",
            )}
      </p>
      <div className="fluid__table" role="region" tabIndex={0}>
        <table>
          <caption>
            {tr(
              `Saturated ${name}, by temperature`,
              `${name} saturado, por temperatura`,
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col">T °C</th>
              {mixture ? (
                <>
                  <th scope="col">{tr("P bubble", "P burbuja")} kPa</th>
                  <th scope="col">{tr("P dew", "P rocío")} kPa</th>
                </>
              ) : (
                <th scope="col">Psat kPa</th>
              )}
              <th scope="col">vf m³/kg</th>
              <th scope="col">vg m³/kg</th>
              <th scope="col">hf kJ/kg</th>
              <th scope="col">hfg kJ/kg</th>
              <th scope="col">hg kJ/kg</th>
              <th scope="col">sf kJ/(kg·K)</th>
              <th scope="col">sg kJ/(kg·K)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.T}>
                <th scope="row">{celsius(r.T)}</th>
                <td>{num(r.pf / 1000)}</td>
                {mixture && <td>{num(r.pg / 1000)}</td>}
                <td>{num(1 / r.rhof)}</td>
                <td>{num(1 / r.rhog)}</td>
                <td>{num(r.hf / 1000)}</td>
                <td>{num((r.hg - r.hf) / 1000)}</td>
                <td>{num(r.hg / 1000)}</td>
                <td>{num(r.sf / 1000)}</td>
                <td>{num(r.sg / 1000)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Every other fluid's page: the way on to them, for people and robots. */
function Others({
  fluids,
  current,
}: {
  fluids: FluidSummary[];
  current?: string;
}) {
  return (
    <nav className="fluid__others" aria-labelledby="fluid-others">
      <h2 id="fluid-others">
        {current
          ? tr("Other fluids", "Otros fluidos")
          : tr("Fluids", "Fluidos")}
      </h2>
      <ul>
        {fluids
          .filter((f) => f.slug !== current)
          .map((f) => (
            <li key={f.slug}>
              <Link to={fluidsPath(f.slug)}>{f.display[locale]}</Link>
            </li>
          ))}
      </ul>
    </nav>
  );
}
