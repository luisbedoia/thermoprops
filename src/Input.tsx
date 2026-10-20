import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { clearExplorer, explorerSummary, savedExplorer } from "./lib/sessions";
import { coolprop, fluidData } from "./coolprop";
import { resolveUnitSystem } from "./lib/units";
import "./Input.css";
import { MathText } from "./components/MathText";
import { Button } from "./components/Button";
import { tr } from "./i18n";

const UNIT_SYSTEMS = [
  {
    value: "celsius",
    label: tr("Default (°C, kPa, kJ)", "Predeterminado (°C, kPa, kJ)"),
  },
  { value: "kelvin", label: "Kelvin (K, kPa, kJ)" },
  { value: "imperial", label: "Imperial (°F, psi, BTU)" },
];

const NOT_PROVIDED = tr("Not provided", "No disponible");

type FormState = {
  fluid: string;
  units: string;
};

export function SettingsView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // By the name shown, in the page's language; the canonical name is the value.
  const catalog = useMemo(
    () =>
      [...coolprop().catalog()].sort((a, b) =>
        a.display_name.localeCompare(b.display_name),
      ),
    [],
  );
  const fluids = useMemo(() => catalog.map((f) => f.name), [catalog]);
  const [formState, setFormState] = useState<FormState>(() => {
    const requested = searchParams.get("fluid") ?? "";
    return {
      fluid: fluids.includes(requested) ? requested : (fluids[0] ?? ""),
      units: resolveUnitSystem(searchParams.get("units")),
    };
  });

  const searchSnapshot = useMemo(() => searchParams.toString(), [searchParams]);
  const statesParam = useMemo(() => searchParams.get("states"), [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams(searchSnapshot);

    if (formState.fluid) {
      next.set("fluid", formState.fluid);
    } else {
      next.delete("fluid");
    }

    if (formState.units) {
      next.set("units", formState.units);
    } else {
      next.delete("units");
    }

    if (statesParam) {
      next.set("states", statesParam);
    } else {
      next.delete("states");
    }

    const nextString = next.toString();
    if (nextString !== searchSnapshot) {
      setSearchParams(next, { replace: true });
    }
  }, [
    formState.fluid,
    formState.units,
    statesParam,
    searchSnapshot,
    setSearchParams,
  ]);

  const details = useMemo(
    () => (formState.fluid ? fluidData(formState.fluid) : null),
    [formState.fluid],
  );

  // The last session in this browser, to pick up where it was left.
  const [resume] = useState(() => {
    const search = savedExplorer();
    const summary = search && explorerSummary(search);
    return search && summary ? { search, summary } : null;
  });
  // Opening the workspace without states starts again: the saved session
  // goes, once the user agrees.
  const startsAgain = resume !== null && !statesParam;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (startsAgain) {
      if (
        !window.confirm(
          tr(
            `Start a new workspace? Your saved states (${resume.summary}) will be removed. This cannot be undone.`,
            `¿Empezar un nuevo espacio de trabajo? Tus estados guardados (${resume.summary}) se eliminarán. Esto no se puede deshacer.`,
          ),
        )
      ) {
        return;
      }
      clearExplorer();
    }
    const next = new URLSearchParams();
    next.set("fluid", formState.fluid);
    next.set("units", formState.units);
    if (statesParam) {
      next.set("states", statesParam);
    }
    navigate(`/workspace?${next.toString()}`);
  };

  const handleChange = (changes: Partial<FormState>) => {
    setFormState((prev) => ({ ...prev, ...changes }));
  };

  const unitLabel = useMemo(
    () =>
      UNIT_SYSTEMS.find((option) => option.value === formState.units)?.label,
    [formState.units],
  );

  const formula = details?.formula;
  const formulaExpression = useMemo(() => {
    if (!formula) {
      return null;
    }

    const trimmed = formula.trim();
    const unwrapped =
      trimmed.startsWith("$") && trimmed.endsWith("$")
        ? trimmed.slice(1, -1)
        : trimmed;

    if (/\\|[_^]/.test(unwrapped)) {
      return unwrapped;
    }

    return `\\mathrm{${escapeForMath(unwrapped)}}`;
  }, [formula]);

  const unitExpression = useMemo(
    () => formatUnitLabelForMath(unitLabel),
    [unitLabel],
  );

  return (
    <section className="settings">
      <form className="settings__form" onSubmit={handleSubmit}>
        <header className="settings__header">
          <h1>{tr("State Explorer", "Explorador de estados")}</h1>
        </header>
        {startsAgain && (
          <div className="settings__resume">
            <p>
              {tr(
                "You have a workspace saved in this browser.",
                "Tienes un espacio de trabajo guardado en este navegador.",
              )}
            </p>
            <Link
              className="settings__resume-link"
              to={{ pathname: "/workspace", search: resume.search }}
            >
              {tr("Continue with", "Continuar con")} {resume.summary}{" "}
              <ArrowRight aria-hidden="true" />
            </Link>
            <p className="settings__resume-or">
              {tr(
                "Or choose a fluid and units below to start a new one.",
                "O elige abajo un fluido y unidades para empezar uno nuevo.",
              )}
            </p>
          </div>
        )}
        <div className="settings__fields">
          <div className="field">
            <label htmlFor="fluid">
              {tr("Working fluid", "Fluido de trabajo")}
            </label>
            <select
              id="fluid"
              name="fluid"
              value={formState.fluid}
              onChange={(event) => handleChange({ fluid: event.target.value })}
            >
              {catalog.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.display_name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="units">
              {tr("Unit system", "Sistema de unidades")}
            </label>
            <select
              id="units"
              name="units"
              value={formState.units}
              onChange={(event) => handleChange({ units: event.target.value })}
            >
              {UNIT_SYSTEMS.map((system) => (
                <option key={system.value} value={system.value}>
                  {system.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="settings__meta" aria-live="polite">
          <dl>
            <div>
              <dt>{tr("Aliases", "Alias")}</dt>
              <dd>
                {details?.aliases?.length
                  ? details.aliases.join(", ")
                  : NOT_PROVIDED}
              </dd>
            </div>
            <div>
              <dt>{tr("Formula", "Fórmula")}</dt>
              <dd>
                {formulaExpression ? (
                  <MathText
                    expression={formulaExpression}
                    ariaLabel={details?.formula}
                  />
                ) : (
                  NOT_PROVIDED
                )}
              </dd>
            </div>
            <div>
              <dt>{tr("Unit profile", "Perfil de unidades")}</dt>
              <dd>
                {unitExpression ? (
                  <MathText
                    expression={unitExpression}
                    ariaLabel={unitLabel ?? undefined}
                  />
                ) : (
                  (unitLabel ?? NOT_PROVIDED)
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="settings__actions">
          <Button type="submit">
            {startsAgain
              ? tr(
                  "Start a new workspace",
                  "Empezar un nuevo espacio de trabajo",
                )
              : tr("Continue to workspace", "Continuar al espacio de trabajo")}
            <ArrowRight />
          </Button>
        </div>
      </form>
    </section>
  );
}

const UNIT_SYMBOLS: Record<string, string> = {
  kelvin: "K",
  celsius: "{}^{\\circ}\\!C",
  fahrenheit: "{}^{\\circ}\\!F",
  rankine: "{}^{\\circ}\\!R",
  pascal: "Pa",
  kilopascal: "kPa",
  psi: "psi",
  bar: "bar",
  joule: "J",
  "british thermal unit": "BTU",
  btu: "BTU",
  "joule (kilogram)": "J",
  kilogram: "kg",
  lb: "lb",
  pound: "lb",
  mole: "mol",
  mol: "mol",
  watt: "W",
};

function escapeForMath(value: string) {
  return value.replace(/([{}_#%&$])/g, "\\$1").replace(/\s+/g, "\\ ");
}

function renderUnitToken(token: string) {
  const normalized = token.trim().toLowerCase();
  const replacement = UNIT_SYMBOLS[normalized] ?? token.trim();
  const sanitized = replacement.replace(/\s+/g, "\\ ");
  return `\\mathrm{${sanitized}}`;
}

function formatUnitExpression(unit: string) {
  const parts = unit
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return renderUnitToken(parts[0] ?? unit);
  }

  const [numerator, ...denominator] = parts;
  const denominatorExpr = denominator.map(renderUnitToken).join("\\,");
  return `\\frac{${renderUnitToken(numerator)}}{${denominatorExpr}}`;
}

function formatUnitLabelForMath(label: string | undefined | null) {
  if (!label) {
    return null;
  }

  const trimmed = label.trim();
  if (!trimmed.length) {
    return null;
  }

  const match = trimmed.match(/^([^()]+)(?:\((.+)\))?$/);
  const system = match?.[1]?.trim();
  const rawUnits = match?.[2]?.trim();

  const systemExpr = system ? `\\text{${system.replace(/\s+/g, " ")}}` : null;

  if (!rawUnits) {
    return systemExpr;
  }

  const unitExpressions = rawUnits
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map(formatUnitExpression);

  if (!unitExpressions.length) {
    return systemExpr;
  }

  const unitsExpr = unitExpressions.join(",\\ ");
  return systemExpr ? `${systemExpr}\\,(${unitsExpr})` : unitsExpr;
}
