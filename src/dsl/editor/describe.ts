/** Short texts about solved states, for completions and hover cards. */
import { fromSI, getDisplayUnit, type UnitSystem } from "../../lib/units";
import type { ScriptState } from "../evaluate";
import { formatNumber } from "../format";

function unitOf(field: string, units: UnitSystem): string {
  return getDisplayUnit(field, units).replace(/\*/g, "·");
}

/** "61.38 °C", or undefined when the state lacks it (x outside the dome). */
export function propertyValue(
  st: ScriptState,
  field: string,
  units: UnitSystem,
): string | undefined {
  const s = st.state;
  if (!s) return undefined;
  const raw =
    field === "specific_volume"
      ? 1 / s.density
      : (s[field as keyof typeof s] as number | null | undefined);
  if (typeof raw !== "number") return undefined;
  const unit = unitOf(field, units);
  const value = formatNumber(fromSI(field, raw, units));
  return unit ? `${value} ${unit}` : value;
}

export function phaseLabel(phase: string | null | undefined): string {
  return phase ? phase.replace(/_/g, "-") : "";
}

/** "-10 °C · 200.6 kPa · two-phase". */
export function stateSummary(st: ScriptState, units: UnitSystem): string {
  if (!st.state) return st.error ?? "not solved";
  return [
    propertyValue(st, "temperature", units),
    propertyValue(st, "pressure", units),
    phaseLabel(st.state.phase),
  ]
    .filter(Boolean)
    .join(" · ");
}
