import { afterEach, describe, expect, it } from "vitest";
import { prerender } from "../prerender";
import { pageTitle } from "../pages";
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

describe("pageTitle", () => {
  it("names each listed page, and the others as the landing", () => {
    expect(pageTitle("/explorer")).toBe("State Explorer – Thermoprops");
    expect(pageTitle("/worksheet/")).toBe("Worksheet – Thermoprops");
    expect(pageTitle("/")).toBe(pageTitle("/workspace"));
  });
});
