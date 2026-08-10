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
 * "No samples recorded at all" means samplesPassed + samplesFailed +
 * samplesPartial all resolve to 0 - there is nothing to score. (Whether
 * sampleSize itself reconciles with those counts is a separate concern,
 * enforced where a test is completed - see completeControlTest in
 * lib/repo/control-tests.ts - not here.) A HIGH severity finding always forces a fail regardless
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
 * Cadence -> months (or days) -until-next-test mapping. The real
 * `reviewCadence` field on library controls is free prose, not a single
 * keyword - e.g. "Threshold and segment calibration reviewed quarterly;
 * scenario logic reviewed annually or on material product change." So this
 * is a KEYWORD SCAN over the whole string, not an exact match: every
 * recognised cadence word present is detected, and the SHORTEST interval
 * among them wins. That is the conservative choice for assurance - a control
 * described partly as "quarterly" must be tested quarterly even if some
 * other part of the same control is only reviewed annually; testing less
 * often than the shortest stated cadence would under-test the control.
 *
 * Rules are listed shortest-first and the first (i.e. shortest) match wins,
 * which also means day-based cadences (daily/weekly) always beat any
 * month-based cadence found in the same text. All patterns use \b word
 * boundaries so e.g. "annually" cannot match a bare substring of an
 * unrelated word; "semi-annually"/"half-yearly" are matched by their own,
 * more specific patterns ahead of the plain annual/yearly ones so a
 * semi-annual mention is picked up as 6 months in its own right (the
 * fact that \bannually\b also happens to match inside "semi-annually" is
 * harmless here precisely because we take the shortest match, not the
 * first-checked one that isn't also the shortest).
 *
 * Missing cadence text, or text with no recognised cadence word at all,
 * defaults to 12 months.
 */
type CadenceRule = { regex: RegExp; kind: "days" | "months"; amount: number };

const CADENCE_RULES: CadenceRule[] = [
  { regex: /\bdaily\b/i, kind: "days", amount: 1 },
  { regex: /\bweekly\b/i, kind: "days", amount: 7 },
  { regex: /\bmonthly\b/i, kind: "months", amount: 1 },
  { regex: /\bbi-?monthly\b/i, kind: "months", amount: 2 },
  { regex: /\bquarterly\b/i, kind: "months", amount: 3 },
  { regex: /\bsemi-?annual(?:ly)?\b/i, kind: "months", amount: 6 },
  { regex: /\bhalf-yearly\b/i, kind: "months", amount: 6 },
  { regex: /\bannual(?:ly)?\b/i, kind: "months", amount: 12 },
  { regex: /\byearly\b/i, kind: "months", amount: 12 },
  { regex: /\bbiennial(?:ly)?\b/i, kind: "months", amount: 24 },
];

const DEFAULT_CADENCE_MONTHS = 12;

/** Adds `months` to `base`, clamping the day-of-month to the last day of the target month rather than overflowing into the following month (e.g. 31 Jan + 1 month -> 28/29 Feb, not 3 Mar). */
function addMonthsClamped(base: Date, months: number): Date {
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const day = base.getUTCDate();

  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + months + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfTargetMonth);

  return new Date(
    Date.UTC(
      year,
      month + months,
      clampedDay,
      base.getUTCHours(),
      base.getUTCMinutes(),
      base.getUTCSeconds(),
      base.getUTCMilliseconds()
    )
  );
}

/**
 * Derives the next test due date from a testedAt date and a library
 * control's free-text reviewCadence, scanning for every recognised cadence
 * word and using the shortest interval found (see CADENCE_RULES doc above).
 * Defaults to 12 months when the cadence text is missing or no recognised
 * cadence word is present. Pure: takes testedAt as a parameter rather than
 * reading Date.now() internally.
 */
export function nextTestDueFrom(testedAt: Date, reviewCadence: string | null | undefined): Date {
  const text = reviewCadence ?? "";

  for (const rule of CADENCE_RULES) {
    if (!rule.regex.test(text)) continue;
    if (rule.kind === "days") {
      const result = new Date(testedAt.getTime());
      result.setUTCDate(result.getUTCDate() + rule.amount);
      return result;
    }
    return addMonthsClamped(testedAt, rule.amount);
  }

  return addMonthsClamped(testedAt, DEFAULT_CADENCE_MONTHS);
}
