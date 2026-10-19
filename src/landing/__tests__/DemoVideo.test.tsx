// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { DemoVideo } from "../DemoVideo";

/** A screen that answers these media queries. */
function screen(matching: string[]) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matching.includes(query),
  }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const source = (container: HTMLElement) =>
  container.querySelector("video")!.getAttribute("src");

describe("DemoVideo", () => {
  it.each([
    [[], "desktop"],
    [["(pointer: coarse)"], "tablet"],
    [["(max-width: 640px)", "(pointer: coarse)"], "phone"],
    // A narrow window shows the keypad too: the phone's recording.
    [["(max-width: 640px)"], "phone"],
  ])("shows the recording for %j: %s's", async (queries, device) => {
    screen(queries);
    const { container } = render(<DemoVideo name="worksheet" label="x" />);
    await waitFor(() =>
      expect(source(container)).toMatch(`/demos/worksheet-${device}.mp4`),
    );
    expect(container.querySelector("video")!.getAttribute("poster")).toMatch(
      `/demos/worksheet-${device}.jpg`,
    );
  });
});
