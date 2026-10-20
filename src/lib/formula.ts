/** Formulas as CoolProp writes them, for text. */

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

/**
 * A formula as CoolProp writes it for LaTeX ("C_{2}F_{4}H_{2}") in plain
 * text, with subscript digits and no 1s: "C₂F₄H₂", "H₂O".
 */
export function plainFormula(formula: string | null | undefined) {
  if (!formula) return undefined;
  return formula
    .replace(/[$\\]/g, "")
    .replace(/_\{(\d+)\}/g, (_, n: string) =>
      n === "1" ? "" : [...n].map((d) => SUBSCRIPTS[Number(d)]).join(""),
    );
}
