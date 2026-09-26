import { describe, it, expect } from "vitest";
import { computeAgreement, passesThreshold, type CalibrationItem } from "../calibration";

describe("computeAgreement", () => {
  it("computes per-criterion and overall agreement, ignoring items without a judge output", () => {
    const items: CalibrationItem[] = [
      {
        id: "1",
        humanLabels: { scope_stated: "pass", tone_measured: "fail" },
        judgeOutput: {
          criteria: {
            scope_stated: { quote: "x", pass: true, reason: "", suggestedRewrite: null },
            tone_measured: { quote: "x", pass: true, reason: "", suggestedRewrite: null }, // judge disagrees here
          },
        },
      },
      {
        id: "2",
        humanLabels: { scope_stated: "fail" },
        judgeOutput: { criteria: { scope_stated: { quote: "x", pass: false, reason: "", suggestedRewrite: null } } },
      },
      {
        id: "3",
        humanLabels: { scope_stated: "pass" },
        judgeOutput: null, // judge call failed - must not count toward the total
      },
    ];

    const summary = computeAgreement(items);
    expect(summary.itemCount).toBe(3);
    expect(summary.agreementByCriterion.scope_stated).toEqual({ agree: 2, total: 2, pct: 100 });
    expect(summary.agreementByCriterion.tone_measured).toEqual({ agree: 0, total: 1, pct: 0 });
    // 2 agreements out of 3 total labelled+judged pairs
    expect(summary.overallAgreementPct).toBeCloseTo((2 / 3) * 100, 1);
  });

  it("returns 0% and no crash on an empty set", () => {
    const summary = computeAgreement([]);
    expect(summary.itemCount).toBe(0);
    expect(summary.overallAgreementPct).toBe(0);
  });
});

describe("passesThreshold", () => {
  it("never passes an empty run even if the (undefined) pct looks high", () => {
    expect(passesThreshold({ agreementByCriterion: {}, overallAgreementPct: 0, itemCount: 0 }, 80)).toBe(false);
  });

  it("passes when overall agreement meets or exceeds the threshold", () => {
    expect(passesThreshold({ agreementByCriterion: {}, overallAgreementPct: 80, itemCount: 5 }, 80)).toBe(true);
    expect(passesThreshold({ agreementByCriterion: {}, overallAgreementPct: 79.9, itemCount: 5 }, 80)).toBe(false);
  });
});
