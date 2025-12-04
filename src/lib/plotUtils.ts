export function getParameterInfo(
  parameter: number | string,
  infoType: "IO" | "short" | "units" | "long",
): string {
  try {
    return window.CP.get_parameter_information(parameter, infoType);
  } catch (error) {
    console.error(`Error obteniendo info del parámetro ${parameter}:`, error);
    return "";
  }
}

export function scaleToPlotlyType(scale: 0 | 1): "linear" | "log" {
  return scale === 1 ? "log" : "linear";
}

export function buildIsolineLabel(parameter: number, value: number): string {
  const short = getParameterInfo(parameter, "short");
  const units = getParameterInfo(parameter, "units");

  const formatted = new Intl.NumberFormat(undefined, {
    maximumSignificantDigits: 4,
  }).format(value);

  const parts = [short, formatted];
  if (units && units !== "-") {
    parts.push(units);
  }

  return parts.join(" ");
}

export function buildAxisTitle(parameter: number): string {
  const short = getParameterInfo(parameter, "short");
  const units = getParameterInfo(parameter, "units");

  if (units && units !== "-") {
    return `${short} (${units})`;
  }

  return short;
}

/**
 * Verifica si una isolínea es una curva de saturación
 */
export function isSaturationCurve(parameter: number, value: number): boolean {
  // El parámetro 21 es Quality (Q)
  // Las curvas de saturación son Q=0 (líquido saturado) y Q=1 (vapor saturado)
  return parameter === 21 && (value === 0 || value === 1);
}

/**
 * Obtiene un label especial para curvas de saturación
 */
export function getSaturationLabel(value: number): string {
  if (value === 0) return "Saturated Liquid";
  if (value === 1) return "Saturated Vapor";
  return "";
}

/**
 * Genera valores equiespaciados en un rango
 */
export function generateEvenlySpacedValues(
  min: number,
  max: number,
  count: number,
): number[] {
  if (count <= 1) return [min];

  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + i * step);
}
