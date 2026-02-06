import { describe, expect, it } from "vitest";
import { createPosterFilename, validatePosterContent } from "@/utils/posterExport";

describe("validatePosterContent", () => {
  it("rejects empty name and quote", () => {
    const res = validatePosterContent({ name: "", quote: "", description: "" });
    expect(res.ok).toBe(false);
    if (res.ok === false) {
      expect(res.errors.name).toBeTruthy();
      expect(res.errors.quote).toBeTruthy();
    }
  });

  it("accepts valid name and quote", () => {
    const res = validatePosterContent({ name: "Ada", quote: "Hello", description: "" });
    expect(res.ok).toBe(true);
  });

  it("enforces length limits", () => {
    const longName = "a".repeat(61);
    const longQuote = "b".repeat(501);
    const res = validatePosterContent({ name: longName, quote: longQuote, description: "" });
    expect(res.ok).toBe(false);
    if (res.ok === false) {
      expect(res.errors.name).toBeTruthy();
      expect(res.errors.quote).toBeTruthy();
    }
  });
});

describe("createPosterFilename", () => {
  it("generates deterministic filename with provided date", () => {
    const d = new Date(2026, 1, 6, 9, 8, 7);
    const name = createPosterFilename({ ext: "png", date: d });
    expect(name).toBe("quote-20260206-090807.png");
  });
});

