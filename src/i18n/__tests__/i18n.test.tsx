// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// The language is read once, when the module loads: each test loads it anew.
async function load(saved?: string) {
  if (saved) localStorage.setItem("thermoprops.locale", saved);
  vi.resetModules();
  return import("../index");
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("locale", () => {
  it("is English unless Spanish was chosen", async () => {
    expect((await load()).locale).toBe("en");
    expect((await load("fr")).locale).toBe("en");
    const es = await load("es");
    expect(es.locale).toBe("es");
    expect(es.tr("Close", "Cerrar")).toBe("Cerrar");
    expect(es.workerName("script")).toBe("script:es");
  });

  it("counts in the language's words", async () => {
    const { count } = await load();
    expect(count(1, "state", "states")).toBe("1 state");
    expect(count(3, "state", "states")).toBe("3 states");
  });

  it("saves a new choice and loads the page in it", async () => {
    const { setLocale } = await load();
    const reload = vi.fn();
    const assign = vi.fn();
    vi.stubGlobal("location", {
      pathname: "/explorer",
      search: "",
      reload,
      assign,
    });
    setLocale("es");
    expect(localStorage.getItem("thermoprops.locale")).toBe("es");
    expect(reload).toHaveBeenCalledOnce();
    reload.mockClear();
    setLocale("en"); // the page's own language: nothing to do
    expect(reload).not.toHaveBeenCalled();
  });

  it("takes the landing to its address in the other language", async () => {
    const { setLocale } = await load();
    const assign = vi.fn();
    vi.stubGlobal("location", { pathname: "/", search: "?x=1", assign });
    setLocale("es");
    expect(assign).toHaveBeenCalledWith("/es/?x=1");

    const es = await load("es");
    vi.stubGlobal("location", { pathname: "/es/", search: "", assign });
    es.setLocale("en");
    expect(assign).toHaveBeenLastCalledWith("/");
    expect(localStorage.getItem("thermoprops.locale")).toBe("en");
  });

  it("is Spanish on the Spanish landing, even unsaved", async () => {
    vi.stubGlobal("location", { pathname: "/es/", search: "" });
    const { locale, landingPath } = await load();
    expect(locale).toBe("es");
    expect(landingPath()).toBe("/es");
  });
});

describe("the app in Spanish", () => {
  it("names its modes and switches back to English", async () => {
    await load("es");
    const { Home } = await import("../../home/Home");
    const { AppLayout } = await import("../../layout/AppLayout");
    render(
      <MemoryRouter>
        <AppLayout />
        <Home />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: "¿En qué estás trabajando?" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Abrir la Hoja de trabajo/ }),
    ).toHaveAttribute("href", "/worksheet");
    expect(screen.getByRole("link", { name: "Ciclo Brayton" })).toBeVisible();
    expect(screen.getByRole("button", { name: /English/ })).toHaveAttribute(
      "lang",
      "en",
    );
  });

  it("names how each state was reached in Spanish", async () => {
    await load("es");
    const { evaluate } = await import("../../dsl/evaluate");
    const { loadRealCoolProp } =
      await import("../../test-fixtures/realCoolProp");
    const r = evaluate(
      "fluid Water\n1: P = 10 kPa, sat liquid\n2: from 1, compressed to P = 1 MPa, eta = 80%\n",
      await loadRealCoolProp(),
    );
    expect(r.states.map((s) => s.how)).toEqual(["P, x", "compresión desde 1"]);
  });

  it("explains the worksheet's mistakes in Spanish", async () => {
    await load("es");
    const { parse } = await import("../../dsl/parser");
    expect(parse("1: T = 25").diagnostics[0].message).toBe(
      "Un estado necesita dos propiedades, p. ej. T = 25 °C, P = 1 bar",
    );
  });
});
