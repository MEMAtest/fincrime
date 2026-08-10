import { describe, expect, it } from "vitest";
import { scoreTestEffectiveness, nextTestDueFrom } from "../test-effectiveness";

describe("scoreTestEffectiveness", () => {
  it("returns not_assessed with a null result when no samples are recorded at all", () => {
    const result = scoreTestEffectiveness({
      sampleSize: null,
      samplesPassed: null,
      samplesFailed: null,
      samplesPartial: null,
      findings: [],
    });
    expect(result.result).toBeNull();
    expect(result.rating).toBe("not_assessed");
    expect(result.passRate).toBe(0);
  });

  it("returns not_assessed when all counts are zero (guards divide-by-zero)", () => {
    const result = scoreTestEffectiveness({
      sampleSize: 10,
      samplesPassed: 0,
      samplesFailed: 0,
      samplesPartial: 0,
      findings: [],
    });
    expect(result.result).toBeNull();
    expect(result.rating).toBe("not_assessed");
  });

  it("boundary: passRate exactly 0.70 is NOT a fail (fail is strictly < 0.70)", () => {
    // 7 passed, 3 failed -> passRate = 0.70
    const result = scoreTestEffectiveness({
      sampleSize: 10,
      samplesPassed: 7,
      samplesFailed: 3,
      samplesPartial: 0,
      findings: [],
    });
    expect(result.passRate).toBeCloseTo(0.7);
    expect(result.result).toBe("pass_with_findings");
    expect(result.rating).toBe("adequate");
  });

  it("boundary: passRate just under 0.70 is a fail", () => {
    // 69 passed, 31 failed -> passRate = 0.69
    const result = scoreTestEffectiveness({
      sampleSize: 100,
      samplesPassed: 69,
      samplesFailed: 31,
      samplesPartial: 0,
      findings: [],
    });
    expect(result.passRate).toBeCloseTo(0.69);
    expect(result.result).toBe("fail");
    expect(result.rating).toBe("weak");
  });

  it("boundary: passRate exactly 0.90 with no medium/high findings is a strong pass", () => {
    const result = scoreTestEffectiveness({
      sampleSize: 10,
      samplesPassed: 9,
      samplesFailed: 1,
      samplesPartial: 0,
      findings: [],
    });
    expect(result.passRate).toBeCloseTo(0.9);
    expect(result.result).toBe("pass");
    expect(result.rating).toBe("strong");
  });

  it("boundary: passRate just under 0.90 is pass_with_findings, not strong", () => {
    const result = scoreTestEffectiveness({
      sampleSize: 100,
      samplesPassed: 89,
      samplesFailed: 11,
      samplesPartial: 0,
      findings: [],
    });
    expect(result.passRate).toBeCloseTo(0.89);
    expect(result.result).toBe("pass_with_findings");
    expect(result.rating).toBe("adequate");
  });

  it("a single HIGH severity finding overrides an otherwise perfect pass rate", () => {
    const result = scoreTestEffectiveness({
      sampleSize: 10,
      samplesPassed: 10,
      samplesFailed: 0,
      samplesPartial: 0,
      findings: [{ severity: "high" }],
    });
    expect(result.passRate).toBe(1);
    expect(result.result).toBe("fail");
    expect(result.rating).toBe("weak");
  });

  it("a medium severity finding downgrades a >=0.90 pass rate to pass_with_findings, not fail", () => {
    const result = scoreTestEffectiveness({
      sampleSize: 10,
      samplesPassed: 10,
      samplesFailed: 0,
      samplesPartial: 0,
      findings: [{ severity: "medium" }],
    });
    expect(result.passRate).toBe(1);
    expect(result.result).toBe("pass_with_findings");
    expect(result.rating).toBe("adequate");
  });

  it("a low severity finding does not prevent a strong pass", () => {
    const result = scoreTestEffectiveness({
      sampleSize: 10,
      samplesPassed: 10,
      samplesFailed: 0,
      samplesPartial: 0,
      findings: [{ severity: "low" }],
    });
    expect(result.result).toBe("pass");
    expect(result.rating).toBe("strong");
  });

  it("partial samples count as half a pass", () => {
    // 4 passed, 0 failed, 4 partial out of 8 scored -> (4 + 4*0.5) / 8 = 0.75
    const result = scoreTestEffectiveness({
      sampleSize: 8,
      samplesPassed: 4,
      samplesFailed: 0,
      samplesPartial: 4,
      findings: [],
    });
    expect(result.passRate).toBeCloseTo(0.75);
    expect(result.result).toBe("pass_with_findings");
    expect(result.rating).toBe("adequate");
  });

  it("clamps negative counts to zero rather than letting them skew the rate", () => {
    const result = scoreTestEffectiveness({
      sampleSize: 10,
      samplesPassed: 10,
      samplesFailed: -5,
      samplesPartial: 0,
      findings: [],
    });
    expect(result.passRate).toBe(1);
    expect(result.result).toBe("pass");
  });

  it("clamps NaN counts to zero", () => {
    const result = scoreTestEffectiveness({
      sampleSize: 10,
      samplesPassed: Number.NaN,
      samplesFailed: 8,
      samplesPartial: 0,
      findings: [],
    });
    // passed treated as 0, so passRate = 0/8 = 0
    expect(result.passRate).toBe(0);
    expect(result.result).toBe("fail");
    expect(result.rating).toBe("weak");
  });
});

describe("nextTestDueFrom", () => {
  const testedAt = new Date("2026-01-15T00:00:00.000Z");

  it("maps Monthly to +1 month", () => {
    const due = nextTestDueFrom(testedAt, "Monthly");
    expect(due.toISOString().slice(0, 10)).toBe("2026-02-15");
  });

  it("maps Quarterly to +3 months", () => {
    const due = nextTestDueFrom(testedAt, "Quarterly");
    expect(due.toISOString().slice(0, 10)).toBe("2026-04-15");
  });

  it("maps Semi-annually to +6 months", () => {
    const due = nextTestDueFrom(testedAt, "Semi-annually");
    expect(due.toISOString().slice(0, 10)).toBe("2026-07-15");
  });

  it("maps Annually to +12 months", () => {
    const due = nextTestDueFrom(testedAt, "Annually");
    expect(due.toISOString().slice(0, 10)).toBe("2027-01-15");
  });

  it("maps Weekly to +7 days", () => {
    const due = nextTestDueFrom(testedAt, "Weekly");
    expect(due.toISOString().slice(0, 10)).toBe("2026-01-22");
  });

  it("maps Daily to +1 day", () => {
    const due = nextTestDueFrom(testedAt, "Daily");
    expect(due.toISOString().slice(0, 10)).toBe("2026-01-16");
  });

  it("is case-insensitive", () => {
    const due = nextTestDueFrom(testedAt, "QUARTERLY");
    expect(due.toISOString().slice(0, 10)).toBe("2026-04-15");
  });

  it("defaults to +12 months for an unrecognised cadence", () => {
    const due = nextTestDueFrom(testedAt, "Whenever we feel like it");
    expect(due.toISOString().slice(0, 10)).toBe("2027-01-15");
  });

  it("defaults to +12 months when cadence is missing", () => {
    const due = nextTestDueFrom(testedAt, null);
    expect(due.toISOString().slice(0, 10)).toBe("2027-01-15");
  });
});
