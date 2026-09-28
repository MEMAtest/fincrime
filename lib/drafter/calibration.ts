/**
 * Calibration agreement maths (SPEC.md calibration: "run the judge over it,
 * show agreement per criterion vs the threshold in settings"). Pure - no
 * DB/model access.
 */
import { JUDGE_CRITERIA, type JudgeCriterionResult } from "./judge";

export interface CalibrationItem {
  id: string;
  humanLabels: Record<string, "pass" | "fail">;
  /**
   * The item's judge output, only when it was judged VALIDLY under the
   * model + prompt version this summary is being computed for. `null`
   * covers both "never judged" and "judged but the response was invalid" -
   * both are treated identically as a missing verdict, never as a pass.
   */
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
  /** Items with a human label but no valid judge verdict for at least one labelled criterion (missing or invalid judge output). */
  invalidCount: number;
}

/**
 * Agreement = the judge's pass/fail matches the human label, per criterion,
 * across every item that has a human label for that criterion.
 *
 * An item with NO judge output (never judged, or the judge call/response
 * was invalid) still counts toward the total for every criterion the human
 * labelled - and counts as DISAGREEMENT, never as a silent skip. Counting it
 * as "not measured" would inflate agreement by only ever scoring the judge
 * on the items it managed to answer; a missing/invalid verdict is itself a
 * failure to agree with the human, per BUILD-DECISIONS "absence must never
 * render as a pass".
 */
export function computeAgreement(items: CalibrationItem[]): CalibrationRunSummary {
  const agreementByCriterion: Record<string, CriterionAgreement> = {};
  for (const def of JUDGE_CRITERIA) {
    agreementByCriterion[def.key] = { agree: 0, total: 0, pct: 0 };
  }

  let invalidCount = 0;
  for (const item of items) {
    const hasValidJudge = Boolean(item.judgeOutput && item.judgeOutput.criteria);
    let itemHasMissingCriterion = false;

    for (const def of JUDGE_CRITERIA) {
      const humanLabel = item.humanLabels[def.key];
      if (!humanLabel) continue; // nothing to measure - the human never labelled this criterion

      const bucket = agreementByCriterion[def.key];
      bucket.total += 1;

      const judgeCriterion = hasValidJudge ? item.judgeOutput!.criteria[def.key] : undefined;
      if (!judgeCriterion) {
        // Missing/invalid judge verdict for a labelled criterion: counts
        // toward the total, never toward agreement.
        itemHasMissingCriterion = true;
        continue;
      }
      const judgeLabel = judgeCriterion.pass ? "pass" : "fail";
      if (judgeLabel === humanLabel) bucket.agree += 1;
    }

    if (itemHasMissingCriterion) invalidCount += 1;
  }

  for (const key of Object.keys(agreementByCriterion)) {
    const bucket = agreementByCriterion[key];
    bucket.pct = bucket.total > 0 ? Math.round((bucket.agree / bucket.total) * 1000) / 10 : 0;
  }

  const totals = Object.values(agreementByCriterion).reduce((acc, b) => ({ agree: acc.agree + b.agree, total: acc.total + b.total }), { agree: 0, total: 0 });
  const overallAgreementPct = totals.total > 0 ? Math.round((totals.agree / totals.total) * 1000) / 10 : 0;

  return { agreementByCriterion, overallAgreementPct, itemCount: items.length, invalidCount };
}

/**
 * SPEC.md: "Tune the prompt until agreement on critical criteria reaches an
 * agreed threshold (setting)." The pass rule is NOT the overall average
 * (which a few strong non-critical criteria - or many easy items - can drag
 * up while a critical criterion is quietly weak). A run passes only when:
 *   1. it covers at least `minItems` labelled items, and
 *   2. EVERY critical criterion, on its own, has been measured (total > 0)
 *      and meets `thresholdPct`.
 * Non-critical criteria are reported but never gate the pass/fail verdict.
 */
export function passesThreshold(summary: CalibrationRunSummary, thresholdPct: number, minItems: number): boolean {
  if (summary.itemCount < minItems) return false;
  return JUDGE_CRITERIA.filter((def) => def.critical).every((def) => {
    const bucket = summary.agreementByCriterion[def.key];
    return Boolean(bucket) && bucket.total > 0 && bucket.pct >= thresholdPct;
  });
}
