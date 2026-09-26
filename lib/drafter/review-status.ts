/**
 * Combines lint status + judge result into the single per-enhancement
 * status shown in the page viewer (SPEC.md "Page viewer and editing":
 * "Status marker per enhancement: pass / minor issues / critical issues /
 * NOT REVIEWED (never shown as pass until judged)").
 *
 * Rule: status is only ever "pass" when lint is clean AND a judge run
 * exists, is not stale, and its overall verdict is "pass". Anything else
 * that isn't outright critical is "minor". No judge yet, or a stale judge,
 * is "not_reviewed" - never silently upgraded to pass.
 */
import type { LintIssue } from "./lint";
import type { JudgeResult } from "./judge";

export type CombinedStatus = "pass" | "minor" | "critical" | "not_reviewed";

export interface JudgeInvalid {
  error: string;
  invalid: true;
}

export interface ReviewResult {
  lint: LintIssue[];
  judge: JudgeResult | JudgeInvalid | null;
  judgeStale: boolean;
  status: CombinedStatus;
  error?: string;
}

export function lintOnlyStatus(lintIssues: LintIssue[]): "pass" | "minor" | "critical" {
  if (lintIssues.some((i) => i.severity === "critical")) return "critical";
  if (lintIssues.length > 0) return "minor";
  return "pass";
}

export function isJudgeInvalid(judge: JudgeResult | JudgeInvalid | null): judge is JudgeInvalid {
  return Boolean(judge && "invalid" in judge && judge.invalid);
}

export function combineStatus(input: {
  lintIssues: LintIssue[];
  judge: JudgeResult | JudgeInvalid | null;
  judgeStale: boolean;
}): CombinedStatus {
  const lintStatus = lintOnlyStatus(input.lintIssues);
  if (lintStatus === "critical") return "critical";
  if (!input.judge || isJudgeInvalid(input.judge) || input.judgeStale) return "not_reviewed";
  if (input.judge.overall === "fail") return "critical";
  if (lintStatus === "minor") return "minor";
  // Judge passed overall (every critical criterion) but may still have a
  // failed non-critical criterion - that is a "minor" flag, not a hard pass.
  const hasNonCriticalFail = Object.values(input.judge.criteria).some((c) => !c.pass);
  return hasNonCriticalFail ? "minor" : "pass";
}
