/**
 * Calibration agreement maths (SPEC.md calibration: "run the judge over it,
 * show agreement per criterion vs the threshold in settings"). Pure - no
 * DB/model access.
 */
import { JUDGE_CRITERIA, type JudgeCriterionResult } from "./judge";

export interface CalibrationItem {
  id: string;
  humanLabels: Record<string, "pass" | "fail">;
  judgeOutput: { criteria: Record<string, JudgeCriterionResult> } | null;
}

export interface CriterionAgreement {
  agree: number;
  total: number;
  pct: number;
}

export interface CalibrationRunSummary {
  agreementByCriterion: Record<string, CriterionAgreement>;
  overallAgreementPct: number;
  itemCount: number;
}

/**
 * Agreement = the judge's pass/fail matches the human label, per criterion,
 * across every item that has BOTH a human label and a judge output for that
 * criterion. An item with no judge output for a criterion (e.g. the judge
 * call failed) does not count toward that criterion's total - it is not
 * counted as agreement, which would silently inflate the score.
 */
export function computeAgreement(items: CalibrationItem[]): CalibrationRunSummary {
  const agreementByCriterion: Record<string, CriterionAgreement> = {};
  for (const def of JUDGE_CRITERIA) {
    agreementByCriterion[def.key] = { agree: 0, total: 0, pct: 0 };
  }

  for (const item of items) {
    if (!item.judgeOutput) continue;
    for (const def of JUDGE_CRITERIA) {
      const humanLabel = item.humanLabels[def.key];
      const judgeCriterion = item.judgeOutput.criteria[def.key];
      if (!humanLabel || !judgeCriterion) continue;
      const bucket = agreementByCriterion[def.key];
      bucket.total += 1;
      const judgeLabel = judgeCriterion.pass ? "pass" : "fail";
      if (judgeLabel === humanLabel) bucket.agree += 1;
    }
  }

  for (const key of Object.keys(agreementByCriterion)) {
    const bucket = agreementByCriterion[key];
    bucket.pct = bucket.total > 0 ? Math.round((bucket.agree / bucket.total) * 1000) / 10 : 0;
  }

  const totals = Object.values(agreementByCriterion).reduce((acc, b) => ({ agree: acc.agree + b.agree, total: acc.total + b.total }), { agree: 0, total: 0 });
  const overallAgreementPct = totals.total > 0 ? Math.round((totals.agree / totals.total) * 1000) / 10 : 0;

  return { agreementByCriterion, overallAgreementPct, itemCount: items.length };
}

export function passesThreshold(summary: CalibrationRunSummary, thresholdPct: number): boolean {
  return summary.itemCount > 0 && summary.overallAgreementPct >= thresholdPct;
}
