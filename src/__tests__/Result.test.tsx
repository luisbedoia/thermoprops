// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceView } from "../Result";
import { encodeStates } from "../workspace/utils";
import type { StateDefinition } from "../workspace/types";
import { setCoolProp } from "../coolprop";
import { fakeCoolProp } from "../test-fixtures/fakeCoolProp";

vi.mock("../Plot", () => ({
  ThermoPlot: () => <div data-testid="thermo-plot" />,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

let fake: ReturnType<typeof fakeCoolProp>;

function renderWorkspace(params = "fluid=Water&units=kelvin&view=table") {
  return render(
    <MemoryRouter initialEntries={[`/workspace?${params}`]}>
      <Routes>
        <Route path="/workspace" element={<WorkspaceView />} />
        <Route path="/" element={<div data-testid="settings-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

function makeState(overrides: Partial<StateDefinition> = {}): StateDefinition {
  return {
    id: "s1",
    label: "State 1",
    property1: "temperature",
    value1: "300",
    property2: "pressure",
    value2: "101325",
    ...overrides,
  };
}

// Open the Add state modal and wait for the first input to be visible.
async function openModal() {
  fireEvent.click(screen.getByRole("button", { name: /add state/i }));
  await waitFor(() => expect(screen.getByLabelText("Property A")).toBeInTheDocument());
}

/** The value fields of properties A and B. */
function valueFields() {
  const [a, b] = screen.getAllByLabelText("Value") as HTMLInputElement[];
  return { a, b };
}

const selected = (label: string) => (screen.getByLabelText(label) as HTMLSelectElement).value;

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("WorkspaceView", () => {
  beforeEach(() => {
    fake = fakeCoolProp();
    setCoolProp(fake.cp);
    vi.stubGlobal(
      "ResizeObserver",
      vi.fn(function ResizeObserverMock(this: object) {
        Object.assign(this, {
          observe: vi.fn(),
          disconnect: vi.fn(),
          unobserve: vi.fn(),
        });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  // ── Routing ────────────────────────────────────────────────────────────────

  describe("routing", () => {
    it("redirects to the settings page when fluid is absent from URL", async () => {
      renderWorkspace("units=kelvin&view=table");
      await waitFor(() => {
        expect(screen.getByTestId("settings-page")).toBeInTheDocument();
      });
    });

    it("renders the workspace when fluid is present", () => {
      renderWorkspace();
      expect(screen.getByRole("heading", { name: "Water" })).toBeInTheDocument();
    });
  });

  // ── Header ─────────────────────────────────────────────────────────────────

  describe("header", () => {
    it("shows the fluid name in the page heading", () => {
      renderWorkspace("fluid=Ammonia&units=kelvin&view=table");
      expect(screen.getByRole("heading", { name: "Ammonia", level: 1 })).toBeInTheDocument();
    });

    it("shows the unit system in the subtitle", () => {
      renderWorkspace();
      expect(screen.getByText(/Kelvin units/)).toBeInTheDocument();
    });

    it("falls back to the default unit system for unknown ones", () => {
      renderWorkspace("fluid=Water&units=si&view=table");
      expect(screen.getByText(/Default units/)).toBeInTheDocument();
    });

    it("shows 'No states tracked yet' in the subtitle when empty", () => {
      renderWorkspace();
      // Header subtitle contains "SI units · No states tracked yet"
      expect(screen.getByText(/Kelvin units · No states tracked yet/)).toBeInTheDocument();
    });

    it("shows state count in subtitle when states are present", () => {
      const states = [makeState(), makeState({ id: "s2", label: "State 2" })];
      renderWorkspace(`fluid=Water&units=kelvin&view=table&states=${encodeStates(states)}`);
      expect(screen.getByText(/Kelvin units · 2 states tracked/)).toBeInTheDocument();
    });
  });

  // ── URL state loading ──────────────────────────────────────────────────────

  describe("URL state loading", () => {
    it("loads states encoded in URL and shows their labels", () => {
      const states = [makeState({ label: "State 1" })];
      renderWorkspace(`fluid=Water&units=kelvin&view=table&states=${encodeStates(states)}`);
      // State label appears in both StateRow (table) and StateCard (mobile) —
      // verify at least one is present.
      expect(screen.getAllByText("State 1").length).toBeGreaterThan(0);
    });

    it("shows the state table when view=table is in the URL", () => {
      renderWorkspace("fluid=Water&units=kelvin&view=table");
      expect(screen.getByRole("heading", { name: "Tracked states" })).toBeInTheDocument();
      expect(screen.queryByTestId("thermo-plot")).not.toBeInTheDocument();
    });
  });

  // ── Add state ──────────────────────────────────────────────────────────────

  describe("add state", () => {
    it("opens the state modal when 'Add state' is clicked", async () => {
      renderWorkspace();
      fireEvent.click(screen.getByRole("button", { name: /add state/i }));
      await waitFor(() => {
        expect(screen.getByText("Add thermodynamic state")).toBeInTheDocument();
      });
    });

    it("closes the modal when Cancel is clicked", async () => {
      renderWorkspace();
      await openModal();
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      await waitFor(() => {
        expect(screen.queryByText("Add thermodynamic state")).not.toBeInTheDocument();
      });
    });

    it("adds a state to the list when valid values are submitted", async () => {
      renderWorkspace();
      await openModal();

      // value1 placeholder "e.g. 300", value2 placeholder "e.g. 101325"
      fireEvent.change(valueFields().a, {
        target: { value: "300" },
      });
      fireEvent.change(valueFields().b, {
        target: { value: "101325" },
      });
      fireEvent.click(screen.getByRole("button", { name: /add to workspace/i }));

      await waitFor(() => {
        expect(screen.getAllByText("State 1").length).toBeGreaterThan(0);
      });
    });

    it("closes the modal after a successful add", async () => {
      renderWorkspace();
      await openModal();
      fireEvent.change(valueFields().a, {
        target: { value: "300" },
      });
      fireEvent.change(valueFields().b, {
        target: { value: "101325" },
      });
      fireEvent.click(screen.getByRole("button", { name: /add to workspace/i }));

      await waitFor(() => {
        expect(screen.queryByText("Add thermodynamic state")).not.toBeInTheDocument();
      });
    });

    it("offers every input in both selectors", async () => {
      renderWorkspace();
      await openModal();
      const options = (id: string) =>
        [...screen.getByLabelText(id).querySelectorAll("option")].map((o) => o.value);
      const all = fake.cp.inputs().map((i) => i.name);
      expect(options("Property A")).toEqual(all);
      expect(options("Property B")).toEqual(all);
    });

    it("hints each value with its unit or bounds", async () => {
      renderWorkspace();
      await openModal();
      expect(valueFields().a).toHaveAttribute("placeholder", "in kPa");
      fireEvent.change(screen.getByLabelText("Property B"), { target: { value: "quality" } });
      expect(valueFields().b).toHaveAttribute("placeholder", "0 – 1");
    });

    it("swaps A and B, values included", async () => {
      renderWorkspace();
      await openModal();
      fireEvent.change(valueFields().a, { target: { value: "101.3" } });
      fireEvent.change(valueFields().b, { target: { value: "300" } });
      fireEvent.click(screen.getByRole("button", { name: /swap properties/i }));
      expect([selected("Property A"), selected("Property B")]).toEqual(["temperature", "pressure"]);
      expect([valueFields().a.value, valueFields().b.value]).toEqual(["300", "101.3"]);
      // Picking the other selector's input swaps too.
      fireEvent.change(screen.getByLabelText("Property A"), { target: { value: "pressure" } });
      expect([selected("Property A"), selected("Property B")]).toEqual(["pressure", "temperature"]);
    });

    it("keeps an unsolvable pick and explains the input it changed", async () => {
      renderWorkspace();
      await openModal();
      fireEvent.change(valueFields().b, { target: { value: "300" } });
      // B = temperature; enthalpy and temperature do not fix a state.
      fireEvent.change(screen.getByLabelText("Property A"), { target: { value: "enthalpy" } });
      expect([selected("Property A"), selected("Property B")]).toEqual(["enthalpy", "pressure"]);
      expect(valueFields().b.value).toBe("");
      expect(screen.getByRole("status")).toHaveTextContent(
        "Property B changed from T to p: h and T do not fix a state together.",
      );
      // The next change clears the notice.
      fireEvent.change(screen.getByLabelText("Property B"), { target: { value: "entropy" } });
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("shows 'Both values must be numeric' when values are empty", async () => {
      renderWorkspace();
      await openModal();
      // Bypass HTML5 required-field validation by submitting the form directly
      const form = screen.getByRole("button", { name: /add to workspace/i }).closest("form")!;
      fireEvent.submit(form);
      await waitFor(() => {
        expect(screen.getByText("Both values must be numeric.")).toBeInTheDocument();
      });
    });

    it("shows CoolProp error when the state cannot be solved", async () => {
      fake.cp.fluid("Water").state = vi.fn().mockImplementation(() => {
        throw new Error("CoolProp failure");
      });

      renderWorkspace();
      await openModal();
      fireEvent.change(valueFields().a, {
        target: { value: "300" },
      });
      fireEvent.change(valueFields().b, {
        target: { value: "101325" },
      });
      fireEvent.click(screen.getByRole("button", { name: /add to workspace/i }));

      await waitFor(() => {
        expect(screen.getByText(/CoolProp rejected these inputs/)).toBeInTheDocument();
      });
    });
  });

  // ── Legacy links ───────────────────────────────────────────────────────────

  describe("legacy links", () => {
    it("explains that states from an earlier version cannot be opened", () => {
      const old = [{ ...makeState(), property1: "T", property2: "P" }];
      renderWorkspace(`fluid=Water&units=kelvin&view=table&states=${btoa(JSON.stringify(old))}`);
      expect(screen.getByRole("status")).toHaveTextContent(/earlier version/);
      expect(screen.getAllByText(/No states tracked yet/).length).toBeGreaterThan(0);
    });

    it("can be dismissed", () => {
      const old = [{ ...makeState(), property1: "T", property2: "P" }];
      renderWorkspace(`fluid=Water&units=kelvin&view=table&states=${btoa(JSON.stringify(old))}`);
      fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("does not show for current links", () => {
      renderWorkspace(`fluid=Water&units=kelvin&view=table&states=${encodeStates([makeState()])}`);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  // ── Remove state ───────────────────────────────────────────────────────────

  describe("export", () => {
    it("exports the tracked states as CSV", async () => {
      const blobs: Blob[] = [];
      vi.stubGlobal("URL", {
        ...URL,
        createObjectURL: vi.fn((blob: Blob) => {
          blobs.push(blob);
          return "blob:states";
        }),
        revokeObjectURL: vi.fn(),
      });
      const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      const states = [makeState(), makeState({ id: "s2", label: "State 2" })];
      renderWorkspace(`fluid=Water&units=kelvin&view=table&states=${encodeStates(states)}`);
      fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
      expect(click).toHaveBeenCalledTimes(1);
      const csv = await blobs[0].text();
      const lines = csv.replace(/^\ufeff/, "").trimEnd().split("\r\n");
      expect(lines).toHaveLength(3);
      expect(lines[0]).toMatch(/^State,Defined by,Pressure p \(kPa\),Temperature T \(K\)/);
      expect(lines[1]).toMatch(/^State 1,"T, p",/);
    });
  });

  describe("remove state", () => {
    it("removes a state when its Remove button is clicked", async () => {
      const states = [makeState({ label: "State 1" })];
      renderWorkspace(
        `fluid=Water&units=kelvin&view=table&states=${encodeStates(states)}`,
      );

      expect(screen.getAllByText("State 1").length).toBeGreaterThan(0);

      // StateRow and StateCard both render a "Remove State 1" button
      const removeButtons = screen.getAllByRole("button", { name: "Remove State 1" });
      fireEvent.click(removeButtons[0]);

      await waitFor(() => {
        expect(screen.queryAllByText("State 1")).toHaveLength(0);
      });
    });
  });

  // ── Clear all ──────────────────────────────────────────────────────────────

  describe("clear all", () => {
    it("clears all states when window.confirm returns true", async () => {
      vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
      const states = [makeState(), makeState({ id: "s2", label: "State 2" })];
      renderWorkspace(
        `fluid=Water&units=kelvin&view=table&states=${encodeStates(states)}`,
      );

      expect(screen.getAllByText("State 1").length).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole("button", { name: /clear all/i }));

      await waitFor(() => {
        expect(screen.queryAllByText("State 1")).toHaveLength(0);
        expect(screen.queryAllByText("State 2")).toHaveLength(0);
      });
    });

    it("keeps states when window.confirm returns false", async () => {
      vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
      const states = [makeState()];
      renderWorkspace(
        `fluid=Water&units=kelvin&view=table&states=${encodeStates(states)}`,
      );

      fireEvent.click(screen.getByRole("button", { name: /clear all/i }));

      // States should still be there after canceling the confirm
      expect(screen.getAllByText("State 1").length).toBeGreaterThan(0);
    });
  });

  // ── View mode ──────────────────────────────────────────────────────────────

  describe("view mode", () => {
    it("renders ThermoPlot when view=graph", () => {
      renderWorkspace("fluid=Water&units=kelvin&view=graph");
      expect(screen.getByTestId("thermo-plot")).toBeInTheDocument();
    });

    it("does not render ThermoPlot when view=table", () => {
      renderWorkspace("fluid=Water&units=kelvin&view=table");
      expect(screen.queryByTestId("thermo-plot")).not.toBeInTheDocument();
    });

    it("switches from graph to table when the Table button is clicked", async () => {
      renderWorkspace("fluid=Water&units=kelvin&view=graph");
      expect(screen.getByTestId("thermo-plot")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /^table$/i }));

      await waitFor(() => {
        expect(screen.queryByTestId("thermo-plot")).not.toBeInTheDocument();
      });
    });

    it("switches from table to graph when the Chart button is clicked", async () => {
      renderWorkspace("fluid=Water&units=kelvin&view=table");
      expect(screen.queryByTestId("thermo-plot")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /^chart$/i }));

      await waitFor(() => {
        expect(screen.getByTestId("thermo-plot")).toBeInTheDocument();
      });
    });
  });
});
