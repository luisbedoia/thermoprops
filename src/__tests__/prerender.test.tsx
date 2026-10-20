import { afterEach, describe, expect, it, vi } from "vitest";
import { prerender } from "../prerender";
import { createRoutesFromChildren, matchRoutes } from "react-router-dom";
import type { ReactElement } from "react";
import { BUILT_PAGES, pageTitle } from "../pages";
import { AppRoutes } from "../Router";
import { setCoolProp } from "../coolprop";

afterEach(() => setCoolProp(null));

describe("prerender", () => {
  it("writes the landing whole, for search engines and a steady first paint", () => {
    setCoolProp(null);
    const html = prerender("/");
    expect(html).toContain("Thermodynamic states, worked out");
    expect(html).toContain("30 fluids and refrigerants");
    expect(html).toContain('href="/worksheet"');
  });

  it("writes the computing pages as they look while CoolProp loads", () => {
    setCoolProp(null);
    for (const path of ["/explorer", "/worksheet"]) {
      const html = prerender(path);
      expect(html).toContain("Loading calculator…");
      expect(html).toContain("Thermoprops");
    }
  });
});

describe("prerender in Spanish", { timeout: 30_000 }, () => {
  afterEach(() => {
    delete (globalThis as { name?: string }).name;
    vi.resetModules();
  });

  it("writes the Spanish landing, linking its pages by their own addresses", async () => {
    // As the build names the Spanish render (scripts/postbuild.mjs).
    (globalThis as { name?: string }).name = "prerender:es";
    vi.resetModules();
    const { prerender } = await import("../prerender");
    const { LANDING } = await import("../pages");
    const html = prerender("/es");
    expect(html).toContain("Estados termodinámicos, resueltos");
    expect(html).toContain("Abrir la Hoja de trabajo");
    expect(html).toContain('href="/worksheet"');
    expect(LANDING.title).toContain("Calculadora");
  });
});

describe("BUILT_PAGES", () => {
  it("are all routes of the app, none taken by the catch-all", () => {
    // <Routes> around the layout's <Route>: the route tree, as the app has it.
    const tree = (AppRoutes() as ReactElement<{ children: ReactElement }>).props
      .children;
    const routes = createRoutesFromChildren(tree);
    const last = (path: string) => matchRoutes(routes, path)?.pop()?.route.path;
    for (const page of BUILT_PAGES)
      expect(last(`/${page}`), `/${page}`).not.toBe("*");
    expect(last("/nowhere")).toBe("*");
    for (const path of ["/fluids", "/fluids/r134a", "/es/fluidos/water"])
      expect(last(path), path).not.toBe("*");
  });
});

describe("pageTitle", () => {
  it("names each listed page, and the others as the landing", () => {
    expect(pageTitle("/explorer")).toBe("State Explorer – Thermoprops");
    expect(pageTitle("/worksheet/")).toBe("Worksheet – Thermoprops");
    expect(pageTitle("/workspace")).toBe("State Explorer – Thermoprops");
    expect(pageTitle("/")).toBe(pageTitle("/nowhere"));
  });
});
