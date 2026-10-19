// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Landing } from "../landing/Landing";
import { ScriptRedirect } from "../Router";
import { evaluate } from "../dsl/evaluate";
import { TEMPLATES } from "../dsl/templates";
import { loadRealCoolProp } from "../test-fixtures/realCoolProp";
import { encodeStates } from "../workspace/utils";
import { setCoolProp } from "../coolprop";
import { fakeCoolProp } from "../test-fixtures/fakeCoolProp";

afterEach(cleanup);

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{pathname + search}</p>;
}

describe("Landing", () => {
  it("opens either mode", () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
    // Each from the opening, and again from its own band.
    for (const [name, href] of [
      [/Open the Worksheet/, "/worksheet"],
      [/Open the State Explorer/, "/explorer"],
    ] as const) {
      const links = screen.getAllByRole("link", { name });
      expect(links).toHaveLength(2);
      for (const l of links) expect(l).toHaveAttribute("href", href);
    }
  });

  it("opens each example with its script", () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "Refrigeration" });
    const url = new URL(link.getAttribute("href")!, "http://x");
    expect(url.pathname).toBe("/worksheet");
    expect(url.searchParams.get("s")).toBe(
      TEMPLATES.find((t) => t.id === "refrigeration")!.source,
    );
  });

  it("shows a worksheet whose result is the one printed beside it", async () => {
    const { container } = render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
    const code = container.querySelector(".live__code code")!.textContent!;
    const r = evaluate(code, await loadRealCoolProp());
    expect(r.diagnostics).toEqual([]);
    const cop = r.values.find((v) => v.name === "COP")!.value!.value;
    const shown = container.querySelector(".live__cop strong")!.textContent;
    expect(cop.toFixed(2)).toBe(shown);
  });
});

describe("Landing, with work saved in this browser", () => {
  it("says what each mode has saved", async () => {
    setCoolProp(fakeCoolProp().cp);
    localStorage.setItem(
      "thermoprops.worksheet",
      "fluid R134a\n1: T = -10 °C, sat vapor\n2: P = 1 MPa, T = 50 °C\n",
    );
    localStorage.setItem(
      "thermoprops.explorer",
      `?fluid=Water&units=celsius&states=${encodeStates([
        {
          id: "s1",
          label: "State 1",
          property1: "temperature",
          value1: "300",
          property2: "pressure",
          value2: "101325",
        },
      ])}`,
    );
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
    // Read once the page is up, so the built page stays the same for all.
    const links = await screen.findAllByRole("link", {
      name: /Continue your worksheet/,
    });
    for (const l of links) expect(l).toHaveAttribute("href", "/worksheet");
    expect(screen.getByText(/R134a · 2 states/)).toBeInTheDocument();
    // The explorer's settings page offers to continue or to start again.
    for (const l of screen.getAllByRole("link", {
      name: /Open the State Explorer/,
    }))
      expect(l).toHaveAttribute("href", "/explorer");
    expect(screen.getByText(/Water · 1 state/)).toBeInTheDocument();
    localStorage.clear();
  });
});

describe("ScriptRedirect", () => {
  it("opens the worksheet's old address, script and all", () => {
    render(
      <MemoryRouter initialEntries={["/script?s=fluid%20Water"]}>
        <Routes>
          <Route path="/script" element={<ScriptRedirect />} />
          <Route path="/worksheet" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("where")).toHaveTextContent(
      "/worksheet?s=fluid%20Water",
    );
  });
});
