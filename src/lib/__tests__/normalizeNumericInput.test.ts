import { describe, it, expect } from "vitest";
import { normalizeNumericInput } from "../normalizeNumericInput";

describe("normalizeNumericInput", () => {
  describe("empty / whitespace", () => {
    it("returns empty for empty string", () => {
      expect(normalizeNumericInput("")).toBe("");
    });

    it("returns empty for whitespace-only string", () => {
      expect(normalizeNumericInput("   ")).toBe("");
    });

    it("returns empty for non-string input", () => {
      expect(normalizeNumericInput(undefined as unknown as string)).toBe("");
      expect(normalizeNumericInput(null as unknown as string)).toBe("");
    });
  });

  describe("simple numbers", () => {
    it("passes through integer strings unchanged", () => {
      expect(normalizeNumericInput("300")).toBe("300");
    });

    it("passes through decimal strings with dot unchanged", () => {
      expect(normalizeNumericInput("300.5")).toBe("300.5");
    });

    it("passes through negative numbers", () => {
      expect(normalizeNumericInput("-40")).toBe("-40");
    });

    it("passes through scientific notation unchanged", () => {
      expect(normalizeNumericInput("1e5")).toBe("1e5");
    });
  });

  describe("whitespace handling", () => {
    it("trims leading and trailing whitespace", () => {
      expect(normalizeNumericInput("  300  ")).toBe("300");
    });

    it("removes internal spaces (thousands grouping)", () => {
      expect(normalizeNumericInput("1 000")).toBe("1000");
    });
  });

  describe("single comma as decimal separator", () => {
    it("converts single comma to decimal point", () => {
      expect(normalizeNumericInput("300,5")).toBe("300.5");
    });

    it("handles leading comma", () => {
      expect(normalizeNumericInput(",5")).toBe(".5");
    });
  });

  describe("multiple dots as thousands separator", () => {
    it("removes dots used as thousands separators", () => {
      expect(normalizeNumericInput("1.000.000")).toBe("1000000");
    });

    it("removes dot thousands separator with three-digit groups", () => {
      expect(normalizeNumericInput("1.234.567")).toBe("1234567");
    });
  });

  describe("multiple commas as thousands separator", () => {
    it("removes commas used as thousands separators", () => {
      expect(normalizeNumericInput("1,000,000")).toBe("1000000");
    });

    it("removes comma thousands separators with decimal dot", () => {
      expect(normalizeNumericInput("1,000,000")).toBe("1000000");
    });
  });

  describe("mixed separators — European format (dot=thousands, comma=decimal)", () => {
    it("handles 1.000,50 → 1000.50", () => {
      expect(normalizeNumericInput("1.000,50")).toBe("1000.50");
    });

    it("handles 1.234.567,89 → 1234567.89", () => {
      expect(normalizeNumericInput("1.234.567,89")).toBe("1234567.89");
    });
  });

  describe("mixed separators — US format (comma=thousands, dot=decimal)", () => {
    it("handles 1,000.50 → 1000.50", () => {
      expect(normalizeNumericInput("1,000.50")).toBe("1000.50");
    });

    it("handles 1,234,567.89 → 1234567.89", () => {
      expect(normalizeNumericInput("1,234,567.89")).toBe("1234567.89");
    });
  });

  describe("invalid inputs with consecutive separators", () => {
    it("returns empty for two consecutive dots", () => {
      expect(normalizeNumericInput("300..5")).toBe("");
    });

    it("returns empty for two consecutive commas", () => {
      expect(normalizeNumericInput("300,,5")).toBe("");
    });

    it("returns empty for mixed consecutive separators", () => {
      expect(normalizeNumericInput("300.,5")).toBe("");
      expect(normalizeNumericInput("300,.5")).toBe("");
    });
  });
});
