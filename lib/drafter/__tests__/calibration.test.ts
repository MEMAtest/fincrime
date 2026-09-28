import { describe, it, expect } from "vitest";
import { computeAgreement, passesThreshold, type CalibrationItem } from "../calibration";

describe("computeAgreement", () => {
  it("computes per-criterion and overall agreement", () => {
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
    ];

    const summary = computeAgreement(items);
    expect(summary.itemCount).toBe(2);
    expect(summary.invalidCount).toBe(0);
    expect(summary.agreementByCriterion.scope_stated).toEqual({ agree: 2, total: 2, pct: 100 });
    expect(summary.agreementByCriterion.tone_measured).toEqual({ agree: 0, total: 1, pct: 0 });
    expect(summary.overallAgreementPct).toBeCloseTo((2 / 3) * 100, 1);
  });

  it("counts a MISSING judge output as DISAGREEMENT for every criterion the human labelled - never a silent skip that would inflate agreement", () => {
    const items: CalibrationItem[] = [
      { id: "1", humanLabels: { scope_stated: "pass", tone_measured: "pass" }, judgeOutput: null },
      { id: "2", humanLabels: { scope_stated: "pass" }, judgeOutput: { criteria: { scope_stated: { quote: "x", pass: true, reason: "", suggestedRewrite: null } } } },
    ];
    const summary = computeAgreement(items);
    // Item 1 never got a judge verdict: both its labelled criteria count toward
    // the total (never counted as agreement), so the invalid item DRAGS the
    // score down instead of being excluded from measurement entirely.
    expect(summary.agreementByCriterion.scope_stated).toEqual({ agree: 1, total: 2, pct: 50 });
    expect(summary.agreementByCriterion.tone_measured).toEqual({ agree: 0, total: 1, pct: 0 });
    expect(summary.invalidCount).toBe(1);
  });

  it("counts an INVALID judge output (present but no criteria) as disagreement too, same as missing", () => {
    const items: CalibrationItem[] = [{ id: "1", humanLabels: { scope_stated: "pass" }, judgeOutput: null }];
    const summary = computeAgreement(items);
    expect(summary.agreementByCriterion.scope_stated).toEqual({ agree: 0, total: 1, pct: 0 });
    expect(summary.invalidCount).toBe(1);
  });

  it("skips a criterion the human never labelled, on both sides", () => {
    const items: CalibrationItem[] = [
      { id: "1", humanLabels: {}, judgeOutput: { criteria: { scope_stated: { quote: "x", pass: true, reason: "", suggestedRewrite: null } } } },
    ];
    const summary = computeAgreement(items);
    expect(summary.agreementByCriterion.scope_stated).toEqual({ agree: 0, total: 0, pct: 0 });
    expect(summary.invalidCount).toBe(0);
    expect(summary.overallAgreementPct).toBe(0);
  });

  it("returns 0% and no crash on an empty set", () => {
    const summary = computeAgreement([]);
    expect(summary.itemCount).toBe(0);
    expect(summary.overallAgreementPct).toBe(0);
    expect(summary.invalidCount).toBe(0);
  });
});

describe("passesThreshold", () => {
  it("never passes an empty run even if the (undefined) pct looks high", () => {
    expect(passesThreshold({ agreementByCriterion: {}, overallAgreementPct: 0, itemCount: 0, invalidCount: 0 }, 80, 20)).toBe(false);
  });

  it("fails below the minimum item count even when every critical criterion is strong", () => {
    const good = { agree: 10, total: 10, pct: 100 };
    const byCriterion = { mechanism_not_policy_restatement: good, trigger_actor_action_outcome: good, rationale_explains_risk: good, correct_section: good, scope_stated: good, tone_measured: good };
    const summary = { agreementByCriterion: byCriterion, overallAgreementPct: 100, itemCount: 10, invalidCount: 0 };
    expect(passesThreshold(summary, 85, 20)).toBe(false); // below minItems=20
    expect(passesThreshold({ ...summary, itemCount: 20 }, 85, 20)).toBe(true);
  });

  it("fails when a CRITICAL criterion is weak even though the overall/average looks fine - a strong average must never hide a weak critical criterion", () => {
    // trigger_actor_action_outcome (critical) is weak; the other 5 criteria
    // are perfect, so the naive overall average would be well above 85%.
    const strong = { agree: 20, total: 20, pct: 100 };
    const weakCritical = { agree: 10, total: 20, pct: 50 };
    const byCriterion = {
      mechanism_not_policy_restatement: strong,
      trigger_actor_action_outcome: weakCritical, // critical
      rationale_explains_risk: strong,
      correct_section: strong,
      scope_stated: strong, // not critical
      tone_measured: strong, // not critical
    };
    const totalAgree = 20 + 10 + 20 + 20 + 20 + 20;
    const totalCount = 20 * 6;
    const overallAgreementPct = Math.round((totalAgree / totalCount) * 1000) / 10; // ~91.7%, above 85
    const summary = { agreementByCriterion: byCriterion, overallAgreementPct, itemCount: 20, invalidCount: 0 };
    expect(summary.overallAgreementPct).toBeGreaterThan(85);
    expect(passesThreshold(summary, 85, 20)).toBe(false);
  });

  it("fails when a critical criterion was never measured (total 0), even if it is absent from the report entirely", () => {
    const strong = { agree: 20, total: 20, pct: 100 };
    const byCriterion = {
      mechanism_not_policy_restatement: strong,
      trigger_actor_action_outcome: { agree: 0, total: 0, pct: 0 }, // never labelled by any human
      rationale_explains_risk: strong,
      correct_section: strong,
      scope_stated: strong,
      tone_measured: strong,
    };
    const summary = { agreementByCriterion: byCriterion, overallAgreementPct: 100, itemCount: 20, invalidCount: 0 };
    expect(passesThreshold(summary, 85, 20)).toBe(false);
  });

  it("passes when at least minItems items are covered and every critical criterion meets the threshold - non-critical criteria never gate it", () => {
    const critical = { agree: 17, total: 20, pct: 85 };
    const weakNonCritical = { agree: 0, total: 20, pct: 0 }; // non-critical, badly disagreeing - must NOT block the pass
    const byCriterion = {
      mechanism_not_policy_restatement: critical,
      trigger_actor_action_outcome: critical,
      rationale_explains_risk: critical,
      correct_section: critical,
      scope_stated: weakNonCritical,
      tone_measured: weakNonCritical,
    };
    const summary = { agreementByCriterion: byCriterion, overallAgreementPct: 42.5, itemCount: 20, invalidCount: 0 };
    expect(passesThreshold(summary, 85, 20)).toBe(true);
  });
});
