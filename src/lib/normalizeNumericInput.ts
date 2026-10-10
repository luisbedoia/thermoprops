/** A plain decimal number, as `Number()` should read it: no hex, no Infinity. */
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** An integer part grouped in thousands with `sep`: "1.234.567". */
function groupedBy(sep: string, integer: string): boolean {
  const s = sep === "." ? "\\." : sep;
  return new RegExp(`^[+-]?\\d{1,3}(${s}\\d{3})+$`).test(integer);
}

/**
 * Normalizes a number as people type it into a plain decimal string, or ""
 * when it is not a number.
 *
 * - Spaces (thousands grouping) are dropped; the typographic minus "−" is a
 *   minus sign.
 * - A single comma is the decimal separator ("300,5").
 * - Repeated dots or commas are thousands separators, and only in groups of
 *   three ("1.000.000", "1,000,000"); anything else ("1.2.3") is rejected
 *   rather than guessed.
 * - With both, the last one is the decimal separator ("1.000,50",
 *   "1,000.50").
 */
export function normalizeNumericInput(value: string): string {
  if (typeof value !== "string") {
    return "";
  }

  const compact = value
    .trim()
    .replace(/[\u2212\u2012\u2013\uFE63\uFF0D]/g, "-")
    .replace(/[\s\u00A0\u202F\u2009]+/g, "");
  if (!compact || /[.,]{2,}/.test(compact)) {
    return "";
  }

  const commas = (compact.match(/,/g) ?? []).length;
  const dots = (compact.match(/\./g) ?? []).length;
  let plain = compact;

  if (commas > 0 && dots > 0) {
    const decimal =
      compact.lastIndexOf(",") > compact.lastIndexOf(".") ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    const at = compact.lastIndexOf(decimal);
    const integer = compact.slice(0, at);
    if (
      compact.slice(at + 1).includes(thousands) ||
      !groupedBy(thousands, integer)
    ) {
      return "";
    }
    plain = integer.split(thousands).join("") + "." + compact.slice(at + 1);
  } else if (commas === 1) {
    plain = compact.replace(",", ".");
  } else if (commas > 1 || dots > 1) {
    const sep = commas > 1 ? "," : ".";
    const [mantissa, exponent] = compact.split(/(?=[eE])/);
    if (!groupedBy(sep, mantissa)) {
      return "";
    }
    plain = mantissa.split(sep).join("") + (exponent ?? "");
  }

  return DECIMAL.test(plain) ? plain : "";
}
