// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { track, trackOnce } from "../analytics";

afterEach(() => {
  delete window.gtag;
});

describe("analytics", () => {
  it("sends nothing where GA is not loaded", () => {
    expect(() => track("explorer_state")).not.toThrow();
  });

  it("sends an event with its parameters", () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    track("explorer_state", { fluid: "R134a" });
    expect(gtag).toHaveBeenCalledWith("event", "explorer_state", {
      fluid: "R134a",
    });
  });

  it("sends a once-event only once per page load", () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    trackOnce("worksheet_solve");
    trackOnce("worksheet_solve");
    expect(gtag).toHaveBeenCalledTimes(1);
  });

  it("never lets GA break the app", () => {
    window.gtag = () => {
      throw new Error("blocked");
    };
    expect(() => track("export_csv")).not.toThrow();
  });
});
