import { describe, it, expect } from "vitest";
import { applyFix, fieldForQuote } from "../apply-fix";

describe("applyFix", () => {
  it("replaces the quoted sentence with the suggestion", () => {
    const result = applyFix("A policy exists for this. It never says how.", "A policy exists for this.", "The reviewer checks each case before approval.");
    expect(result.applied).toBe(true);
    expect(result.text).toBe("The reviewer checks each case before approval. It never says how.");
  });

  it("does not apply when the quote is not present, and returns the text unchanged", () => {
    const result = applyFix("Some other text.", "not present anywhere", "replacement");
    expect(result.applied).toBe(false);
    expect(result.text).toBe("Some other text.");
  });

  it("does not apply for an empty quote", () => {
    const result = applyFix("Some text.", "", "replacement");
    expect(result.applied).toBe(false);
  });
});

describe("fieldForQuote", () => {
  it("finds the quote in control text", () => {
    expect(fieldForQuote("hello", "hello world", "goodbye")).toBe("control_text");
  });

  it("finds the quote in rationale when not in control text", () => {
    expect(fieldForQuote("goodbye", "hello world", "goodbye world")).toBe("rationale");
  });

  it("returns null when the quote is in neither", () => {
    expect(fieldForQuote("nowhere", "hello", "goodbye")).toBeNull();
  });
});
