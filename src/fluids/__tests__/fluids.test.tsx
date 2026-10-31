import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { CoolProp } from "@luisbedoia/coolprop-rs-wasm";
import { loadRealCoolProp } from "../../test-fixtures/realCoolProp";
import {
  fluidPage,
  fluidSlug,
  fluidSummaries,
  saturationPressures,
  saturationTemperatures,
  superheatedPressures,
  type FluidPage,
  type FluidSummary,
} from "../data";
import { localizedPath } from "../../i18n";

let cp: CoolProp;
let summaries: FluidSummary[];
let water: FluidPage;

beforeAll(async () => {
  cp = await loadRealCoolProp();
  const names = new Map(cp.catalog().map((f) => [f.name, f.display_name]));
  summaries = await fluidSummaries(cp, { en: names, es: names });
  water = await fluidPage(
    cp,
    summaries.find((f) => f.name === "Water")!,
    summaries,
  );
}, 60_000);

describe("fluids' addresses", () => {
  it("are one per fluid, the same in both languages", () => {
    const slugs = cp.catalog().map((f) => fluidSlug(f.name));
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(fluidSlug("R1234ze(E)")).toBe("r1234ze-e");
    expect(fluidSlug("CarbonDioxide")).toBe("carbondioxide");
  });

  it("have their counterpart in the other language", () => {
    expect(localizedPath("/fluids/r134a", "es")).toBe("/es/fluidos/r134a");
    expect(localizedPath("/es/fluidos/r134a/", "en")).toBe("/fluids/r134a");
    expect(localizedPath("/es/fluidos", "en")).toBe("/fluids");
    expect(localizedPath("/", "es")).toBe("/es");
    expect(localizedPath("/explorer", "es")).toBeNull();
  });
});

describe("a fluid's page", () => {
  it("tabulates round temperatures from the triple point to the critical one", () => {
    const ts = saturationTemperatures(273.16, 647.096).map((t) =>
      Math.round(t - 273.15),
    );
    expect(ts[0]).toBe(25);
    expect(ts[ts.length - 1]).toBe(350);
    expect(ts.length).toBeGreaterThan(10);
  });

  it("gives water's saturation table as the steam tables do", () => {
    const at100 = water.saturation.find((r) => Math.abs(r.T - 373.15) < 1e-6)!;
    // Çengel's Table A-4: 101.42 kPa, hf 419.17, hfg 2256.4, sg 7.3542.
    expect(at100.pf / 1000).toBeCloseTo(101.42, 1);
    expect(at100.hf / 1000).toBeCloseTo(419.17, 1);
    expect((at100.hg - at100.hf) / 1000).toBeCloseTo(2256.4, 0);
    expect(at100.sg / 1000).toBeCloseTo(7.354, 2);
    expect(water.critical.temperature).toBeCloseTo(647.096, 2);
  });

  it("tabulates round pressures from 1 kPa to the critical one", () => {
    const ps = saturationPressures(611.655, 22.064e6).map((p) => p / 1000);
    expect(ps.slice(0, 5)).toEqual([1, 2, 3, 5, 10]);
    expect(ps[ps.length - 1]).toBe(20000);
    expect(superheatedPressures(611.655, 22.064e6).map((p) => p / 1e6)).toEqual(
      [0.2, 0.5, 1, 2, 5, 10],
    );
  });

  it("gives water's saturation table by pressure as the steam tables do", () => {
    const at1MPa = water.saturationByPressure.find((r) => r.P === 1e6)!;
    // Çengel's Table A-5: 179.88 °C, hf 762.51, hfg 2014.6, sg 6.5850.
    expect(at1MPa.Tf - 273.15).toBeCloseTo(179.88, 1);
    expect(at1MPa.hf / 1000).toBeCloseTo(762.51, 0);
    expect((at1MPa.hg - at1MPa.hf) / 1000).toBeCloseTo(2014.6, 0);
    expect(at1MPa.sg / 1000).toBeCloseTo(6.585, 2);
  });

  it("gives water's superheated table as the steam tables do", () => {
    const block = water.superheated.find((b) => b.P === 1e6)!;
    const at300 = block.rows.find((r) => Math.abs(r.T - 573.15) < 1e-6)!;
    // Çengel's Table A-6: v 0.25799, u 2793.7, h 3051.6, s 7.1246.
    expect(1 / at300.rho).toBeCloseTo(0.25799, 4);
    expect(at300.u / 1000).toBeCloseTo(2793.7, 0);
    expect(at300.h / 1000).toBeCloseTo(3051.6, 0);
    expect(at300.s / 1000).toBeCloseTo(7.1246, 3);
    expect(block.sat.T - 273.15).toBeCloseTo(179.88, 1);
    // Every row is vapor, above its saturation.
    for (const b of water.superheated)
      for (const r of b.rows) expect(r.T).toBeGreaterThan(b.sat.T);
  });

  it("gives the normal boiling point, if it boils at 1 atm", async () => {
    expect(water.boiling!.bubble - 273.15).toBeCloseTo(99.97, 1);
    const co2 = await fluidPage(
      cp,
      summaries.find((f) => f.name === "CarbonDioxide")!,
      summaries,
    );
    // Solid CO₂ sublimates at 1 atm.
    expect(co2.boiling).toBeNull();
  });

  it("draws the p–h and T–s diagrams with their dome and isolines", () => {
    expect(water.charts.map((c) => c.id)).toEqual([
      "pressure_enthalpy",
      "temperature_entropy",
    ]);
    for (const c of water.charts) {
      expect(c.dome).toHaveLength(2);
      expect(c.isolines.length).toBeGreaterThan(3);
    }
  });

  it("has every fluid of the catalog, each with a table and diagrams", async () => {
    expect(summaries).toHaveLength(cp.catalog().length);
    for (const name of ["Air", "R410A", "Helium", "CarbonDioxide"]) {
      const page = await fluidPage(
        cp,
        summaries.find((f) => f.name === name)!,
        summaries,
      );
      expect(page.saturation.length, name).toBeGreaterThan(5);
      expect(page.saturationByPressure.length, name).toBeGreaterThan(5);
      expect(page.superheated.length, name).toBeGreaterThan(3);
      expect(page.charts, name).toHaveLength(2);
    }
  }, 60_000);
});

// Each test loads the whole app again, in its language: slow under load.
describe("the built pages", { timeout: 30_000 }, () => {
  afterEach(() => {
    delete (globalThis as { name?: string }).name;
    vi.resetModules();
  });

  /** A fluid's page as the build writes it, in a language. */
  async function built(locale: "en" | "es", path: string, data: unknown) {
    (globalThis as { name?: string }).name = `prerender:${locale}`;
    vi.resetModules();
    const { setPageData } = await import("../pageData");
    const { prerender } = await import("../../prerender");
    const meta = await import("../meta");
    setPageData(path, data);
    return { html: prerender(path), meta };
  }

  it("write a fluid's page whole, in English", async () => {
    const { html, meta } = await built("en", "/fluids/water", water);
    expect(html).toContain("Saturation table");
    expect(html).toContain("101.42");
    expect(html).toContain("Saturation table by pressure");
    expect(html).toContain("Superheated vapor table");
    expect(html).toContain("Normal boiling point (1 atm)");
    expect(html).toContain("99.974 °C");
    expect(meta.fluidDescription(water)).toContain(
      "normal boiling point (99.97 °C)",
    );
    expect(html).toContain('href="/fluids/r134a"');
    expect(html).toContain("<svg");
    expect(meta.fluidTitle(water)).toMatch(/^Water \(R718\) – Thermodynamic/);
  });

  it("and in Spanish, with the Spanish addresses", async () => {
    const es = {
      ...water,
      fluid: { ...water.fluid, display: { en: "Water", es: "Agua" } },
    };
    const { html, meta } = await built("es", "/es/fluidos/water", es);
    expect(html).toContain("Tabla de saturación");
    expect(html).toContain("Tabla de vapor sobrecalentado");
    expect(html).toContain('href="/es/fluidos/r134a"');
    expect(meta.fluidTitle(es)).toMatch(/^Agua \(R718\) – Propiedades/);
  });

  it("write the index, with every fluid", async () => {
    const { html } = await built("en", "/fluids", summaries);
    expect(html).toContain("Fluids and refrigerants");
    expect(html).toContain('href="/fluids/carbondioxide"');
  });
});
