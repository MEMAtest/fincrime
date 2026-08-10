import type { ControlRating } from "../controls/types";

/**
 * Control test effectiveness scoring: turns the raw counts recorded during a
 * test cycle (sample_size / samples_passed / samples_failed /
 * samples_partial) plus the findings raised into a deterministic
 * pass/fail/pass-with-findings result AND the ControlRating that gets
 * written back onto the live control. Deterministic and pure, mirroring
 * residual-risk.ts: no AI, no I/O, no randomness, no Date.now().
 */

export type FindingSeverity = "low" | "medium" | "high";

export interface TestFindingInput {
  severity: FindingSeverity;
}

export interface TestEffectivenessInput {
  sampleSize: number | null | undefined;
  samplesPassed: number | null | undefined;
  samplesFailed: number | null | undefined;
  samplesPartial: number | null | undefined;
  findings: TestFindingInput[];
}

export type TestResult = "pass" | "pass_with_findings" | "fail";

export interface TestEffectivenessResult {
  /** 0-1. A partial sample counts as half a pass. Divide-by-zero guarded to 0. */
  passRate: number;
  /** null when there were no samples recorded at all (not_assessed). */
  result: TestResult | null;
  rating: ControlRating;
}

/**
 * Rating/result decision table (evaluated top to bottom, first match wins):
 *
 *   condition                                          result               rating
 *   ---------------------------------------------------------------------------------
 *   no samples recorded at all                         null                 not_assessed
 *   any HIGH severity finding, OR passRate < 0.70       fail                 weak
 *   passRate >= 0.90 AND no medium/high findings        pass                 strong
 *   otherwise                                           pass_with_findings   adequate
 *
 * "No samples recorded at all" means sampleSize is missing/zero/negative, or
 * samplesPassed + samplesFailed + samplesPartial all resolve to 0 - there is
 * nothing to score. A HIGH severity finding always forces a fail regardless
 * of how good the raw pass rate looks (you cannot pass a control that let a
 * high-severity issue through). Negative or NaN counts are clamped to 0
 * before scoring rather than allowed to skew the rate.
 */
function clampCount(value: number | null | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function scoreTestEffectiveness(input: TestEffectivenessInput): TestEffectivenessResult {
  const passed = clampCount(input.samplesPassed);
  const failed = clampCount(input.samplesFailed);
  const partial = clampCount(input.samplesPartial);
  const findings = input.findings ?? [];

  const scoredSamples = passed + failed + partial;

  if (scoredSamples === 0) {
    return { passRate: 0, result: null, rating: "not_assessed" };
  }

  const passRate = (passed + partial * 0.5) / scoredSamples;

  const hasHighFinding = findings.some((f) => f.severity === "high");
  const hasMediumOrHighFinding = findings.some((f) => f.severity === "medium" || f.severity === "high");

  if (hasHighFinding || passRate < 0.7) {
    return { passRate, result: "fail", rating: "weak" };
  }

  if (passRate >= 0.9 && !hasMediumOrHighFinding) {
    return { passRate, result: "pass", rating: "strong" };
  }

  return { passRate, result: "pass_with_findings", rating: "adequate" };
}

/**
 * Cadence -> months-until-next-test mapping. Matched case-insensitively
 * against the library control's `reviewCadence` free-text field (e.g.
 * "Quarterly", "Annually", "Monthly", "Semi-annually"). Unrecognised or
 * missing cadence text defaults to 12 months.
 */
// "daily" and "weekly" are handled specially in nextTestDueFrom (day-based,
// not month-based) and are deliberately absent from this month-based table.
const CADENCE_MONTHS: Record<string, number> = {
  monthly: 1,
  "bi-monthly": 2,
  bimonthly: 2,
  quarterly: 3,
  "semi-annually": 6,
  "semi-annual": 6,
  "semiannually": 6,
  "half-yearly": 6,
  annually: 12,
  annual: 12,
  yearly: 12,
  biennially: 24,
  biennial: 24,
};

const DEFAULT_CADENCE_MONTHS = 12;

/**
 * Derives the next test due date from a testedAt date and a library
 * control's free-text reviewCadence, defaulting to 12 months when the
 * cadence text is missing or unrecognised. Pure: takes testedAt as a
 * parameter rather than reading Date.now() internally.
 */
export function nextTestDueFrom(testedAt: Date, reviewCadence: string | null | undefined): Date {
  const key = (reviewCadence ?? "").trim().toLowerCase();

  if (key === "daily") {
    const result = new Date(testedAt.getTime());
    result.setUTCDate(result.getUTCDate() + 1);
    return result;
  }
  if (key === "weekly") {
    const result = new Date(testedAt.getTime());
    result.setUTCDate(result.getUTCDate() + 7);
    return result;
  }

  const months = CADENCE_MONTHS[key] ?? DEFAULT_CADENCE_MONTHS;
  const result = new Date(testedAt.getTime());
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}
