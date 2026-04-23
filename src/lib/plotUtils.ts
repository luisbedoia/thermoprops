export function getParameterInfo(
  parameter: number ,
  infoType: "IO" | "short" | "units" | "long",
): string {
  try {
    return window.CP.getParameterInformation(parameter, infoType);
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
 * Calcula el rango [min, max] de un parámetro dentro de la campana de saturación,
 * muestreando ambas curvas de saturación (Q=0 y Q=1) desde Ttriple hasta Tcrit.
 * Recibe el nombre corto del parámetro (e.g. "T", "Hmass", "S") para usarlo con propsSI.
 */
export function computeSaturationDomeRange(
  parameterShort: string,
  fluid: string,
): { min: number; max: number } | null {
  try {
    // Las propiedades triviales no necesitan estado — strings vacíos funcionan en CoolProp
    const tCrit = window.CP.propsSI("Tcrit", "", 0, "", 0, fluid);
    const tTriple = window.CP.propsSI("Ttriple", "", 0, "", 0, fluid);
    if (!isFinite(tCrit) || !isFinite(tTriple)) return null;

    // T es trivialmente acotada y no puede usarse como salida cuando T es la entrada
    if (parameterShort === "T") {
      return { min: tTriple, max: tCrit };
    }

    const tStart = tTriple * 1.001;
    const tEnd = tCrit * 0.999;
    const steps = 15;
    const values: number[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = tStart + ((tEnd - tStart) * i) / steps;
      const liq = window.CP.propsSI(parameterShort, "Q", 0, "T", t, fluid);
      const vap = window.CP.propsSI(parameterShort, "Q", 1, "T", t, fluid);
      if (isFinite(liq)) values.push(liq);
      if (isFinite(vap)) values.push(vap);
    }

    if (values.length < 2) return null;
    return { min: Math.min(...values), max: Math.max(...values) };
  } catch {
    return null;
  }
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
