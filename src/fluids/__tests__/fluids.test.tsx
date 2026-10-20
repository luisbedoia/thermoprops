import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { CoolProp } from "@luisbedoia/coolprop-rs-wasm";
import { loadRealCoolProp } from "../../test-fixtures/realCoolProp";
import {
  fluidPage,
  fluidSlug,
  fluidSummaries,
  saturationTemperatures,
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
    expect(html).toContain('href="/es/fluidos/r134a"');
    expect(meta.fluidTitle(es)).toMatch(/^Agua \(R718\) – Propiedades/);
  });

  it("write the index, with every fluid", async () => {
    const { html } = await built("en", "/fluids", summaries);
    expect(html).toContain("Fluids and refrigerants");
    expect(html).toContain('href="/fluids/carbondioxide"');
  });
});
