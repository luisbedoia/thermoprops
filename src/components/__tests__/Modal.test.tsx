// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { Modal } from "../Modal";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.removeAttribute("style");
});

function scrolledTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  return vi.spyOn(window, "scrollTo").mockImplementation(() => {});
}

describe("Modal", () => {
  it("pins the page where it was while open, and restores it on close", () => {
    const scrollTo = scrolledTo(400);
    const { rerender } = render(
      <Modal isOpen onClose={() => {}}>
        content
      </Modal>,
    );
    // iOS Safari ignores overflow: hidden for touch scrolling; a fixed body
    // cannot scroll at all.
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-400px");
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overscrollBehavior).toBe("none");

    rerender(
      <Modal isOpen={false} onClose={() => {}}>
        content
      </Modal>,
    );
    expect(document.body.style.position).toBe("");
    expect(document.body.style.top).toBe("");
    expect(document.documentElement.style.overflow).toBe("");
    expect(scrollTo).toHaveBeenCalledWith(0, 400);
  });

  it("keeps the page locked across re-renders with a new onClose", () => {
    const scrollTo = scrolledTo(120);
    const { rerender } = render(
      <Modal isOpen onClose={() => {}}>
        a
      </Modal>,
    );
    const latest = vi.fn();
    rerender(
      <Modal isOpen onClose={latest}>
        b
      </Modal>,
    );
    // Not unlocked and relocked: that would lose the scroll position.
    expect(scrollTo).not.toHaveBeenCalled();
    expect(document.body.style.top).toBe("-120px");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(latest).toHaveBeenCalledTimes(1);
  });
});
