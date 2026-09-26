import { describe, it, expect } from "vitest";
import { applyFactBoundary, deriveKnownTerms } from "../fact-boundary";

describe("applyFactBoundary", () => {
  it("leaves a number alone when it is supported by the inputs", () => {
    const result = applyFactBoundary("The team reviews every 12 months.", ["The control is reviewed every 12 months by the second line."]);
    expect(result.text).toBe("The team reviews every 12 months.");
    expect(result.placeholders).toHaveLength(0);
  });

  it("replaces an invented frequency with a bracketed placeholder and logs it", () => {
    const result = applyFactBoundary("The team reviews every 3 months.", ["The control is reviewed periodically."]);
    expect(result.text).toContain("[unsupported figure - verify]");
    expect(result.text).not.toContain("every 3 months");
    expect(result.placeholders).toHaveLength(1);
    expect(result.placeholders[0].original.toLowerCase()).toContain("every 3 months");
  });

  it("replaces an invented percentage not present in the inputs", () => {
    const result = applyFactBoundary("Escalates when risk exceeds 40%.", ["Escalates when risk exceeds the agreed threshold."]);
    expect(result.placeholders.some((p) => p.original === "40%")).toBe(true);
  });

  it("replaces an invented amount not present in the inputs", () => {
    const result = applyFactBoundary("Transactions above £5000 are reviewed.", ["Transactions above the threshold are reviewed."]);
    expect(result.placeholders.some((p) => p.original.replace(/\s/g, "") === "£5000")).toBe(true);
  });

  it("flags an unsupported acronym without replacing it", () => {
    const result = applyFactBoundary("The check runs through the FCRM engine.", ["The check runs through the case management system."]);
    expect(result.text).toContain("FCRM");
    expect(result.flags.some((f) => f.term === "FCRM")).toBe(true);
  });

  it("flags an unsupported multi-word capitalised role/system name without replacing it", () => {
    const result = applyFactBoundary("The Senior Risk Committee approves the exception.", ["A nominated reviewer approves the exception."]);
    expect(result.text).toContain("Senior Risk Committee");
    expect(result.flags.some((f) => f.term === "Senior Risk Committee")).toBe(true);
  });

  it("does not flag a multi-word term that appears in the inputs", () => {
    const result = applyFactBoundary("The Compliance Monitoring Team reviews the case.", ["The Compliance Monitoring Team is notified of every case."]);
    expect(result.flags).toHaveLength(0);
  });

  it("derives known terms from inputs case-insensitively", () => {
    const known = deriveKnownTerms(["The Financial Crime Team reviews SARS weekly."]);
    expect(known.has("financial crime team")).toBe(true);
    expect(known.has("sars")).toBe(true);
  });
});
