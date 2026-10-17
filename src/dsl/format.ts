import { fromSI, getDisplayUnit, type UnitSystem } from "../lib/units";
import { displayKind, siUnit, type Quantity } from "./units";

const NUMBER_FORMAT = new Intl.NumberFormat(undefined, {
  minimumSignificantDigits: 3,
  maximumSignificantDigits: 6,
});

export function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(value);
}

/** A quantity in the unit system: "4.12", "-10 °C", "7.35 kW". */
export function formatQuantity(q: Quantity, system: UnitSystem): string {
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
