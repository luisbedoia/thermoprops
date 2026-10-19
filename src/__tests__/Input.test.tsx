// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { SettingsView } from "../Input";
import { setCoolProp } from "../coolprop";
import { fakeCoolProp } from "../test-fixtures/fakeCoolProp";
import { encodeStates } from "../workspace/utils";

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{pathname + search}</p>;
}

const SAVED = `?fluid=Water&units=celsius&states=${encodeStates([
  {
    id: "s1",
    label: "State 1",
    property1: "temperature",
    value1: "300",
    property2: "pressure",
    value2: "101325",
  },
])}`;

function renderSettings() {
  render(
    <MemoryRouter initialEntries={["/explorer"]}>
      <Routes>
        <Route path="/explorer" element={<SettingsView />} />
        <Route path="/workspace" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  setCoolProp(fakeCoolProp().cp);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SettingsView, with a workspace saved in this browser", () => {
  it("offers to continue it", () => {
    localStorage.setItem("thermoprops.explorer", SAVED);
    renderSettings();
    fireEvent.click(
      screen.getByRole("link", { name: /Continue with Water · 1 state/ }),
    );
    expect(screen.getByTestId("where").textContent).toBe("/workspace" + SAVED);
  });

  it("asks before starting a new one, and keeps the saved one if not", () => {
    localStorage.setItem("thermoprops.explorer", SAVED);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderSettings();
    fireEvent.click(
      screen.getByRole("button", { name: /Start a new workspace/ }),
    );
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("Water · 1 state"),
    );
    expect(screen.queryByTestId("where")).toBeNull();
    expect(localStorage.getItem("thermoprops.explorer")).toBe(SAVED);
  });

  it("removes the saved one once the user agrees", () => {
    localStorage.setItem("thermoprops.explorer", SAVED);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderSettings();
    fireEvent.click(
      screen.getByRole("button", { name: /Start a new workspace/ }),
    );
    expect(screen.getByTestId("where").textContent).not.toContain("states=");
    expect(localStorage.getItem("thermoprops.explorer")).toBeNull();
  });
});

describe("SettingsView, with nothing saved", () => {
  it("opens the workspace without asking", () => {
    const confirm = vi.spyOn(window, "confirm");
    renderSettings();
    fireEvent.click(
      screen.getByRole("button", { name: /Continue to workspace/ }),
    );
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByTestId("where").textContent).toMatch(/^\/workspace\?/);
  });
});
