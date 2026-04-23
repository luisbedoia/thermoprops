export function normalizeNumericInput(value: string): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const compact = trimmed.replace(/\s+/g, "");
  if (/[.,]{2,}/.test(compact)) {
    return "";
  }
  const commaCount = (compact.match(/,/g) ?? []).length;
  const dotCount = (compact.match(/\./g) ?? []).length;

  if (commaCount > 0 && dotCount > 0) {
    const lastComma = compact.lastIndexOf(",");
    const lastDot = compact.lastIndexOf(".");

    if (lastComma > lastDot) {
      // European format: dots = thousands, comma = decimal (e.g. 1.000,50)
      const withoutDots = compact.replace(/\./g, "");
      return withoutDots.replace(/,/g, ".");
    }
    // US format: commas = thousands, dot = decimal (e.g. 1,000.50)
    return compact.replace(/,/g, "");
  }

  if (commaCount > 1) {
    return compact.replace(/,/g, "");
  }

  if (commaCount === 1) {
    return compact.replace(/,/g, ".");
  }

  if (dotCount > 1) {
    return compact.replace(/\./g, "");
  }

  return compact;
}
