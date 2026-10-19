import { fromSI, getDisplayUnit, type UnitSystem } from "../lib/units";
import { convertTo, displayKind, siUnit, type Quantity } from "./units";

/**
 * A point for decimals and no thousands separator, whatever the browser's
 * language ("1046.16", never "1,046.16", read as 1.046 in much of the
 * world): two decimals, four under 1 (a quality, an efficiency: 0.8794),
 * and three significant digits under 0.01 rather than zeros (a liquid's
 * 0.00102 m³/kg).
 */
const fixed = (digits: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  });
const TWO_DECIMALS = fixed(2);
const FOUR_DECIMALS = fixed(4);
const SMALL = new Intl.NumberFormat("en-US", {
  maximumSignificantDigits: 3,
  useGrouping: false,
});

export function formatNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs > 0 && abs < 0.01) return SMALL.format(value);
  // -0 would show as "-0.0000".
  if (abs < 1) return FOUR_DECIMALS.format(value === 0 ? 0 : value);
  return TWO_DECIMALS.format(value);
}

/**
 * A quantity in the unit system: "4.12", "-10 °C", "7.35 kW"; or in `unit`,
 * a print's "in °F".
 */
export function formatQuantity(
  q: Quantity,
  system: UnitSystem,
  unit?: string,
): string {
  const converted = unit === undefined ? null : convertTo(q, unit);
  if (unit !== undefined && converted !== null) {
    const shown = unit
      .replace(/\*/g, "·")
      .replace(/\^2/g, "²")
      .replace(/\^3/g, "³");
    return unit === "%"
      ? `${formatNumber(converted)} %`
      : `${formatNumber(converted)} ${shown}`;
  }
  const kind = displayKind(q.dim);
  if (kind && "property" in kind) {
    if (kind.property === "temperature" && !q.absolute) {
      // A difference: kelvin, or Rankine degrees in imperial.
      return system === "imperial"
        ? `${formatNumber((q.value * 9) / 5)} °R`
        : `${formatNumber(q.value)} K`;
    }
    const unit = getDisplayUnit(kind.property, system).replace(/\*/g, "·");
    const value = formatNumber(fromSI(kind.property, q.value, system));
    return unit ? `${value} ${unit}` : value;
  }
  if (kind) return `${formatNumber(q.value / kind.scale)} ${kind.unit}`;
  return `${formatNumber(q.value)} ${siUnit(q.dim)}`;
}
