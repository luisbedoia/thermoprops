import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getFluidDetails, getFluidsList } from "./lib";
import "./Input.css";
import { MathText } from "./components/MathText";
import { Button } from "./components/Button";

const UNIT_SYSTEMS = [
  { value: "si", label: "SI (kelvin, pascal, joule/kg)" },
  { value: "imperial", label: "Imperial (fahrenheit, psi, btu/lb)" },
];

type FormState = {
  fluid: string;
  units: string;
};

export function SettingsView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [fluids, setFluids] = useState<string[]>([]);
  const [details, setDetails] = useState<{
    aliases: string[];
    formula?: string;
  } | null>(null);
  const [formState, setFormState] = useState<FormState>(() => ({
    fluid: searchParams.get("fluid") ?? "",
    units: searchParams.get("units") ?? UNIT_SYSTEMS[0].value,
  }));

  const searchSnapshot = useMemo(() => searchParams.toString(), [searchParams]);
  const statesParam = useMemo(() => searchParams.get("states"), [searchParams]);

  useEffect(() => {
    let active = true;
    const loadFluids = async () => {
      try {
        const list = await getFluidsList();
        if (!active) {
          return;
        }
        setFluids(list);

        setFormState((prev) => {
          const chosen =
            prev.fluid && list.includes(prev.fluid)
              ? prev.fluid
              : (list[0] ?? "");
          if (chosen === prev.fluid) {
            return prev;
          }
          return { ...prev, fluid: chosen };
        });
      } catch (error) {
        console.error("Unable to load fluids", error);
      }
    };
    void loadFluids();
    return () => {
      active = false;
    };
  }, []);

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

  useEffect(() => {
    let active = true;
    if (!formState.fluid) {
      setDetails(null);
      return;
    }

    const loadDetails = async () => {
      try {
        const info = await getFluidDetails(formState.fluid);
        if (!active) {
          return;
        }
        setDetails(info);
      } catch (error) {
        console.error("Unable to load fluid metadata", error);
      }
    };

    void loadDetails();
    return () => {
      active = false;
    };
  }, [formState.fluid]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

  const formulaExpression = useMemo(() => {
    if (!details?.formula) {
      return null;
    }

    const trimmed = details.formula.trim();
    const unwrapped =
      trimmed.startsWith("$") && trimmed.endsWith("$")
        ? trimmed.slice(1, -1)
        : trimmed;

    if (/\\|[_^]/.test(unwrapped)) {
      return unwrapped;
    }

    return `\\mathrm{${escapeForMath(unwrapped)}}`;
  }, [details?.formula]);

  const unitExpression = useMemo(
    () => formatUnitLabelForMath(unitLabel),
    [unitLabel],
  );

  return (
    <section className="settings">
      <form className="settings__form" onSubmit={handleSubmit}>
        <header className="settings__header">
          <h1>Settings</h1>
        </header>
        <div className="settings__fields">
          <div className="field">
            <label htmlFor="fluid">Working fluid</label>
            <select
              id="fluid"
              name="fluid"
              value={formState.fluid}
              onChange={(event) => handleChange({ fluid: event.target.value })}
            >
              {fluids.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="units">Unit system</label>
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
              <dt>Aliases</dt>
              <dd>
                {details?.aliases?.length
                  ? details.aliases.join(", ")
                  : "Not provided"}
              </dd>
            </div>
            <div>
              <dt>Formula</dt>
              <dd>
                {formulaExpression ? (
                  <MathText
                    expression={formulaExpression}
                    ariaLabel={details?.formula}
                  />
                ) : (
                  "Not provided"
                )}
              </dd>
            </div>
            <div>
              <dt>Unit profile</dt>
              <dd>
                {unitExpression ? (
                  <MathText
                    expression={unitExpression}
                    ariaLabel={unitLabel ?? undefined}
                  />
                ) : (
                  (unitLabel ?? "Not provided")
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="settings__actions">
          <Button type="submit">Continue to workspace</Button>
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
