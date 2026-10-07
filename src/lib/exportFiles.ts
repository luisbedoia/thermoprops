import type { ComputedState } from "../workspace/types";
import { phaseInfo, quantityInfo, quantityValue, tableQuantities } from "./quantities";
import { fromSI, getDisplayUnit } from "./units";
import type { UnitSystem } from "./units";
import { unitToPlain } from "./unitsFormat";

/** One CSV field, quoted when it holds a separator, quote or line break. */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * The tracked states as CSV: one row per state with every quantity of the
 * table, in the display units, and its phase. A state that could not be
 * solved keeps its row, with its error and no values.
 */
export function statesToCsv(states: ComputedState[], units: UnitSystem): string {
  const quantities = tableQuantities();
  const header = [
    "State",
    "Defined by",
    ...quantities.map((q) => {
      const unit = unitToPlain(getDisplayUnit(q, units));
      const { description, symbol } = quantityInfo(q);
      return unit ? `${description} ${symbol} (${unit})` : `${description} ${symbol}`;
    }),
    "Phase",
  ];
  const rows = states.map(({ definition, state, error }) => {
    const definedBy = [definition.property1, definition.property2]
      .map((q) => quantityInfo(q).symbol)
      .join(", ");
    if (!state) {
      return [definition.label, definedBy, ...quantities.map(() => ""), error ?? "error"];
    }
    return [
      definition.label,
      definedBy,
      ...quantities.map((q) => {
        const si = quantityValue(state, q);
        return si === null ? "" : String(fromSI(q, si, units));
      }),
      phaseInfo(state.phase)?.label ?? "",
    ];
  });
  return [header, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}

/** A file name from parts: "thermoprops-r134a-states". */
export function fileName(...parts: string[]): string {
  return ["thermoprops", ...parts]
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Saves `text` as a file. A UTF-8 byte order mark is prepended so Excel reads
 * symbols such as °C and ρ correctly.
 */
export function downloadText(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob(["﻿", text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
