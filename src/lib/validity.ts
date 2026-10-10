import type { FluidData, State } from "@luisbedoia/coolprop-rs-wasm";
import { fromSI, getDisplayUnit } from "./units";
import type { UnitSystem } from "./units";
import { unitToPlain } from "./unitsFormat";

const LIMIT_FORMAT = new Intl.NumberFormat(undefined, {
  maximumSignificantDigits: 6,
});

/** Rounding slack, so states right at a limit (the triple point) pass. */
const SLACK = 1e-6;

/**
 * Why `state` is outside the range where the fluid's equation of state is
 * valid (from its triple point up to `t_max` and `p_max`), or null when it
 * is inside. CoolProp extrapolates past these limits without complaint, so
 * the values there are not to be trusted.
 */
export function validityError(
  state: State,
  data: FluidData,
  units: UnitSystem,
): string | null {
  const { temperature: t, pressure: p } = state;
  const inside =
    t >= data.t_triple * (1 - SLACK) &&
    t <= data.t_max * (1 + SLACK) &&
    p <= data.p_max * (1 + SLACK);
  if (inside) return null;
  const show = (name: string, si: number) => {
    const unit = unitToPlain(getDisplayUnit(name, units));
    return `${LIMIT_FORMAT.format(fromSI(name, si, units))}${unit ? ` ${unit}` : ""}`;
  };
  return (
    `Outside the range of ${data.name}'s equation of state: ` +
    `T from ${show("temperature", data.t_triple)} to ${show("temperature", data.t_max)}, ` +
    `p up to ${show("pressure", data.p_max)}.`
  );
}
