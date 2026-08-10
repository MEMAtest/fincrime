/**
 * Pure validation helpers for the app/api/control-tests/** route handlers.
 * Kept dependency-free (no db, no NextResponse, no value imports of repo
 * modules) so they can be unit tested directly - lib/control-tests/helpers.ts
 * layers the workspace-scoped existence checks and NextResponse helpers on
 * top of what is validated here, mirroring lib/workspace/action-input.ts.
 */
import type { ControlTestMethod } from "../repo/control-tests";
import type { FindingSeverity } from "../../data/scoring/test-effectiveness";

const CONTROL_TEST_METHODS: ControlTestMethod[] = ["sample", "walkthrough", "reperformance", "data_analysis", "other"];

export function isControlTestMethod(value: unknown): value is ControlTestMethod {
  return typeof value === "string" && (CONTROL_TEST_METHODS as string[]).includes(value);
}

const FINDING_SEVERITIES: FindingSeverity[] = ["low", "medium", "high"];

export function isFindingSeverity(value: unknown): value is FindingSeverity {
  return typeof value === "string" && (FINDING_SEVERITIES as string[]).includes(value);
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

/** True for a value that is a non-negative integer (used for sample counts). */
export function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export type StepParseResult = { ok: true; value: number | undefined } | { ok: false };

/** Parses an optional current_step field (1-5). */
export function parseOptionalStep(value: unknown): StepParseResult {
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5) {
    return { ok: true, value };
  }
  return { ok: false };
}

export type CountParseResult = { ok: true; value: number | null | undefined } | { ok: false };

/**
 * Parses an optional non-negative-integer count field. Distinguishes "not
 * provided" (leave unchanged) from "explicit null" (clear it) from an
 * invalid value (reject).
 */
export function parseOptionalCount(value: unknown): CountParseResult {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null) return { ok: true, value: null };
  if (isNonNegativeInt(value)) return { ok: true, value };
  return { ok: false };
}
