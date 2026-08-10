import { describe, expect, it } from "vitest";
import { scoreTestEffectiveness, nextTestDueFrom } from "../test-effectiveness";
import { allControls } from "../../controls";

/** Same recognised-cadence-word check the implementation uses, kept independent so the test isn't just re-asserting the production regex list. */
const CADENCE_WORD_RE = /\b(daily|weekly|monthly|bi-?monthly|quarterly|semi-?annual(?:ly)?|half-yearly|annual(?:ly)?|yearly|biennial(?:ly)?)\b/i;

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

  it("scans free text and uses the SHORTEST cadence word found, not the first or the default", () => {
    // Real shape of data/controls/*.ts reviewCadence text: quarterly appears
    // first in the sentence, but annually is also present - quarterly (the
    // shorter interval) must win.
    const due = nextTestDueFrom(
      testedAt,
      "Threshold and segment calibration reviewed quarterly; scenario logic reviewed annually or on material product change."
    );
    expect(due.toISOString().slice(0, 10)).toBe("2026-04-15");
  });

  it("a daily/weekly mention beats a monthly mention elsewhere in the same text", () => {
    const due = nextTestDueFrom(
      testedAt,
      "Reconciliation results reviewed daily/weekly by operations; coverage attestation reviewed by the MLRO monthly and audited annually."
    );
    expect(due.toISOString().slice(0, 10)).toBe("2026-01-16"); // +1 day, daily wins
  });

  it("recognises semi-annually as 6 months even though 'annually' also matches inside it", () => {
    const due = nextTestDueFrom(testedAt, "Category scope reviewed semi-annually.");
    expect(due.toISOString().slice(0, 10)).toBe("2026-07-15");
  });

  it("clamps month-end overflow instead of rolling into the following month (31 Jan + 1 month -> 28 Feb, not 3 Mar)", () => {
    const endOfJan = new Date("2026-01-31T00:00:00.000Z");
    const due = nextTestDueFrom(endOfJan, "Monthly");
    expect(due.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("clamps month-end overflow for a leap-year February (31 Jan 2024 + 1 month -> 29 Feb)", () => {
    const endOfJan = new Date("2024-01-31T00:00:00.000Z");
    const due = nextTestDueFrom(endOfJan, "Monthly");
    expect(due.toISOString().slice(0, 10)).toBe("2024-02-29");
  });

  it("real library: every control whose reviewCadence contains a recognised cadence word gets a due date other than the flat 12-month default (unless the word genuinely maps to 12)", () => {
    const controlsWithCadenceWord = allControls.filter((c) => CADENCE_WORD_RE.test(c.reviewCadence ?? ""));
    expect(controlsWithCadenceWord.length).toBeGreaterThan(0);

    const defaultDue = nextTestDueFrom(testedAt, null).toISOString().slice(0, 10);

    for (const control of controlsWithCadenceWord) {
      const due = nextTestDueFrom(testedAt, control.reviewCadence).toISOString().slice(0, 10);
      const impliesTwelveMonths = /\b(annual(?:ly)?|yearly)\b/i.test(control.reviewCadence ?? "") &&
        !/\b(daily|weekly|monthly|bi-?monthly|quarterly|semi-?annual(?:ly)?|half-yearly|biennial(?:ly)?)\b/i.test(
          control.reviewCadence ?? ""
        );
      if (!impliesTwelveMonths) {
        expect(due, `${control.slug}: "${control.reviewCadence}" resolved to the 12-month default`).not.toBe(defaultDue);
      }
    }
  });
});
