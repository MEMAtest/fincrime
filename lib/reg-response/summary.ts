/**
 * Pure roll-up arithmetic over a regulator request's questions and
 * commitments. Kept dependency-free (no db) so it is unit testable directly,
 * mirroring lib/readiness/summary.ts. Used by regResponseSummary in
 * lib/repo/reg-requests.ts (the list view and the detail pack).
 *
 * due_date/deadline inputs are typed `string | Date | null` rather than just
 * `string`: the `pg` driver's default type parser (pg-types, registered for
 * oid 1082 "date") returns DATE columns as JS Date objects at RUNTIME, even
 * though the row interfaces in lib/repo/reg-requests.ts declare them as
 * `string` for the shape callers actually see on the wire (JSON-serialised
 * responses stringify Date). A naive string comparison or a `new Date(str)`
 * that assumes the input is always a string is exactly the "comparing a
 * request string to a pg Date" trap this codebase has hit before - see
 * toEpochMs below, which normalises either representation before comparing.
 */
import type { RegQuestionStatus, RegCommitmentStatus } from "../repo/reg-requests";
import { isTerminalCommitmentStatus } from "./validation";

export interface QuestionSummaryInput {
  status: RegQuestionStatus;
}

export interface CommitmentSummaryInput {
  status: RegCommitmentStatus;
  due_date: string | Date | null;
}

export interface RegResponseSummary {
  totalQuestions: number;
  questionsByStatus: Record<RegQuestionStatus, number>;
  answeredCount: number;
  unansweredCount: number;
  /** Percentage (0-100, rounded) of questions with status != 'unanswered'. */
  answeredPct: number;
  totalCommitments: number;
  commitmentsByStatus: Record<RegCommitmentStatus, number>;
  /** Non-terminal commitments (open/in_progress) whose due_date is in the past relative to `asOf`. */
  overdueCommitmentCount: number;
  /** Days from `asOf` to `deadline` (negative if the deadline has passed). Null if no deadline. */
  daysUntilDeadline: number | null;
}

const EMPTY_QUESTION_STATUS: Record<RegQuestionStatus, number> = { unanswered: 0, drafted: 0, reviewed: 0 };
const EMPTY_COMMITMENT_STATUS: Record<RegCommitmentStatus, number> = {
  open: 0,
  in_progress: 0,
  met: 0,
  missed: 0,
  withdrawn: 0,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Normalises a DATE-ish value (ISO string OR a pg-driver-parsed Date object) to epoch milliseconds at UTC midnight. Never do `value1 === value2` or `value1 < value2` directly on these - see the module doc comment. */
function toEpochMs(value: string | Date | null): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  const iso = String(value).slice(0, 10);
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime();
}

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function summarizeQuestions(questions: QuestionSummaryInput[]): {
  totalQuestions: number;
  questionsByStatus: Record<RegQuestionStatus, number>;
  answeredCount: number;
  unansweredCount: number;
  answeredPct: number;
} {
  const questionsByStatus: Record<RegQuestionStatus, number> = { ...EMPTY_QUESTION_STATUS };
  for (const q of questions) questionsByStatus[q.status] += 1;

  const totalQuestions = questions.length;
  const unansweredCount = questionsByStatus.unanswered;
  const answeredCount = totalQuestions - unansweredCount;
  const answeredPct = totalQuestions === 0 ? 0 : Math.round((answeredCount / totalQuestions) * 100);

  return { totalQuestions, questionsByStatus, answeredCount, unansweredCount, answeredPct };
}

/** True while a commitment is non-terminal and its due date has passed `asOf` (defaults to now). */
export function isOverdueCommitment(c: CommitmentSummaryInput, asOf: Date = new Date()): boolean {
  if (isTerminalCommitmentStatus(c.status)) return false;
  const dueMs = toEpochMs(c.due_date);
  if (dueMs === null) return false;
  return dueMs < startOfUtcDay(asOf);
}

export function summarizeCommitments(
  commitments: CommitmentSummaryInput[],
  asOf: Date = new Date()
): {
  totalCommitments: number;
  commitmentsByStatus: Record<RegCommitmentStatus, number>;
  overdueCommitmentCount: number;
} {
  const commitmentsByStatus: Record<RegCommitmentStatus, number> = { ...EMPTY_COMMITMENT_STATUS };
  let overdueCommitmentCount = 0;

  for (const c of commitments) {
    commitmentsByStatus[c.status] += 1;
    if (isOverdueCommitment(c, asOf)) overdueCommitmentCount += 1;
  }

  return { totalCommitments: commitments.length, commitmentsByStatus, overdueCommitmentCount };
}

/** Days from `asOf` to `deadline` (negative once the deadline has passed). Null if there is no deadline. */
export function daysUntilDeadline(deadline: string | Date | null, asOf: Date = new Date()): number | null {
  const deadlineMs = toEpochMs(deadline);
  if (deadlineMs === null) return null;
  return Math.round((deadlineMs - startOfUtcDay(asOf)) / MS_PER_DAY);
}

export function regResponseSummary(
  questions: QuestionSummaryInput[],
  commitments: CommitmentSummaryInput[],
  deadline: string | Date | null,
  asOf: Date = new Date()
): RegResponseSummary {
  const questionSummary = summarizeQuestions(questions);
  const commitmentSummary = summarizeCommitments(commitments, asOf);

  return {
    ...questionSummary,
    ...commitmentSummary,
    daysUntilDeadline: daysUntilDeadline(deadline, asOf),
  };
}
