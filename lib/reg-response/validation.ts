/**
 * Pure validation helpers for the app/api/reg-requests/** route handlers.
 * Kept dependency-free (no db, no NextResponse, no value imports of repo
 * modules) so they can be unit tested directly, mirroring
 * lib/readiness/validation.ts and lib/incidents/validation.ts.
 */
import type {
  RegRequestChannel,
  RegRequestStatus,
  RegQuestionStatus,
  RegQuestionLinkType,
  RegCommitmentStatus,
} from "../repo/reg-requests";

const CHANNELS: RegRequestChannel[] = ["email", "portal", "letter", "meeting", "s165", "other"];

export function isRegRequestChannel(value: unknown): value is RegRequestChannel {
  return typeof value === "string" && (CHANNELS as string[]).includes(value);
}

const STATUSES: RegRequestStatus[] = ["draft", "in_progress", "in_review", "approved", "submitted", "closed", "cancelled"];

export function isRegRequestStatus(value: unknown): value is RegRequestStatus {
  return typeof value === "string" && (STATUSES as string[]).includes(value);
}

const QUESTION_STATUSES: RegQuestionStatus[] = ["unanswered", "drafted", "reviewed"];

export function isRegQuestionStatus(value: unknown): value is RegQuestionStatus {
  return typeof value === "string" && (QUESTION_STATUSES as string[]).includes(value);
}

const LINK_TYPES: RegQuestionLinkType[] = [
  "workspace_control",
  "control_test",
  "control_change",
  "incident",
  "readiness_assessment",
  "pra_assessment",
  "evidence",
];

export function isRegQuestionLinkType(value: unknown): value is RegQuestionLinkType {
  return typeof value === "string" && (LINK_TYPES as string[]).includes(value);
}

const COMMITMENT_STATUSES: RegCommitmentStatus[] = ["open", "in_progress", "met", "missed", "withdrawn"];

export function isRegCommitmentStatus(value: unknown): value is RegCommitmentStatus {
  return typeof value === "string" && (COMMITMENT_STATUSES as string[]).includes(value);
}

/** Terminal commitment statuses: no further action is expected against them. */
export function isTerminalCommitmentStatus(status: RegCommitmentStatus): boolean {
  return status === "met" || status === "missed" || status === "withdrawn";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates a YYYY-MM-DD string that also parses to a real calendar date (rejects e.g. 2026-02-30). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === value;
}

export type StepParseResult = { ok: true; value: number | undefined } | { ok: false };

/** Parses an optional current_step field (1-6). */
export function parseOptionalStep(value: unknown): StepParseResult {
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 6) {
    return { ok: true, value };
  }
  return { ok: false };
}

export type PositionParseResult = { ok: true; value: number } | { ok: false };

/** Parses a required 1-based position field. */
export function parsePosition(value: unknown): PositionParseResult {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) {
    return { ok: true, value };
  }
  return { ok: false };
}
