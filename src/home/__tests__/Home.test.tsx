// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Home } from "../Home";
import { AppRoutes } from "../../Router";
import { encodeStates } from "../../workspace/utils";
import { appTitle, pageTitle } from "../../pages";

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("Home", () => {
  it("opens each mode, and the worksheet's examples", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: /Open the Worksheet/ }),
    ).toHaveAttribute("href", "/worksheet");
    expect(
      screen.getByRole("link", { name: /Open the State Explorer/ }),
    ).toHaveAttribute("href", "/explorer");
    expect(screen.getByRole("link", { name: "Brayton cycle" })).toBeVisible();
    expect(screen.queryByRole("link", { name: /Blank/ })).toBeNull();
  });

  it("offers to continue what this browser saved", async () => {
    localStorage.setItem(
      "thermoprops.worksheet",
      "fluid R134a\n1: T = 0 °C, x = 1\n",
    );
    const search = `?fluid=Water&units=celsius&states=${encodeStates([
      {
        id: "a",
        label: "A",
        property1: "temperature",
        value1: "300",
        property2: "pressure",
        value2: "101325",
      },
    ])}`;
    localStorage.setItem("thermoprops.explorer", search);
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("link", { name: /Continue your worksheet/ }),
    ).toBeVisible();
    expect(screen.getByText(/Saved: R134a · 1 state/)).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Continue with Water · 1 state/ }),
    ).toHaveAttribute("href", `/workspace${search}`);
    expect(
      screen.getByRole("link", { name: "Start a new workspace" }),
    ).toHaveAttribute("href", "/explorer");
  });

  it("stands in for the landing in the installed app", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: q.includes("display-mode: standalone"),
      addEventListener() {},
      removeEventListener() {},
    }));
    renderAt("/");
    expect((await screen.findByTestId("where")).textContent).toBe("/home");
    expect(pageTitle("/home")).toBe("Thermoprops");
  });

  it("takes over when the landing is installed while open", async () => {
    // A tab moved into the app's window: no new load, the display mode changes.
    let app = false;
    const listeners: (() => void)[] = [];
    vi.stubGlobal("matchMedia", (q: string) => ({
      get matches() {
        return app && q.includes("display-mode: standalone");
      },
      addEventListener: (_: string, f: () => void) => listeners.push(f),
      removeEventListener() {},
    }));
    renderAt("/");
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Thermodynamic states, worked out",
    );
    app = true;
    act(() => listeners.forEach((f) => f()));
    expect((await screen.findByTestId("where")).textContent).toBe("/home");
  });
});

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/home" element={<Where />} />
        <Route path="*" element={<AppRoutes />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("appTitle", () => {
  it("names the page alone: the app's window puts the app's name first", () => {
    expect(appTitle("/worksheet")).toBe("Worksheet");
    expect(appTitle("/workspace")).toBe("State Explorer");
    expect(appTitle("/explorer/")).toBe("State Explorer");
    expect(appTitle("/home")).toBe("Home");
    // The browser keeps the full title, for its tabs and search results.
    expect(pageTitle("/worksheet")).toBe("Worksheet – Thermoprops");
  });
});
