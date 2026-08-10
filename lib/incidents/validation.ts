/**
 * Pure validation helpers for the app/api/incidents/** route handlers. Kept
 * dependency-free (no db, no NextResponse, no value imports of repo modules)
 * so they can be unit tested directly - lib/incidents/helpers.ts layers the
 * workspace-scoped existence checks and NextResponse helpers on top of what
 * is validated here, mirroring lib/control-tests/validation.ts and
 * lib/workspace/action-input.ts.
 */
import type {
  IncidentSource,
  IncidentSeverity,
  IncidentStatus,
  IncidentRootCauseCategory,
  AffectedPopulation,
} from "../repo/incidents";
import type { IncidentLinkType } from "../repo/incidents";

const INCIDENT_SOURCES: IncidentSource[] = [
  "internal_detection",
  "customer_complaint",
  "regulator",
  "third_party",
  "audit",
  "control_test",
  "other",
];

export function isIncidentSource(value: unknown): value is IncidentSource {
  return typeof value === "string" && (INCIDENT_SOURCES as string[]).includes(value);
}

const INCIDENT_SEVERITIES: IncidentSeverity[] = ["low", "medium", "high", "critical"];

export function isIncidentSeverity(value: unknown): value is IncidentSeverity {
  return typeof value === "string" && (INCIDENT_SEVERITIES as string[]).includes(value);
}

const INCIDENT_STATUSES: IncidentStatus[] = ["open", "contained", "investigating", "remediating", "closed", "cancelled"];

export function isIncidentStatus(value: unknown): value is IncidentStatus {
  return typeof value === "string" && (INCIDENT_STATUSES as string[]).includes(value);
}

/** Non-final statuses a PATCH may move an incident forward through. Closing and reopening have their own routes. */
const PATCHABLE_STATUSES: IncidentStatus[] = ["open", "contained", "investigating", "remediating"];

export function isPatchableIncidentStatus(value: unknown): value is IncidentStatus {
  return typeof value === "string" && (PATCHABLE_STATUSES as string[]).includes(value);
}

const ROOT_CAUSE_CATEGORIES: IncidentRootCauseCategory[] = [
  "control_design",
  "control_operation",
  "data_quality",
  "system_failure",
  "human_error",
  "third_party",
  "process_gap",
  "other",
];

export function isRootCauseCategory(value: unknown): value is IncidentRootCauseCategory {
  return typeof value === "string" && (ROOT_CAUSE_CATEGORIES as string[]).includes(value);
}

const INCIDENT_LINK_TYPES: IncidentLinkType[] = [
  "failed_control",
  "control_change",
  "control_test",
  "pra_assessment",
  "enforcement_case",
];

export function isIncidentLinkType(value: unknown): value is IncidentLinkType {
  return typeof value === "string" && (INCIDENT_LINK_TYPES as string[]).includes(value);
}

/** Link types that reference a workspace-owned row via target_id (as opposed to a static library reference via target_ref). */
const WORKSPACE_OWNED_LINK_TYPES: IncidentLinkType[] = ["failed_control", "control_change", "control_test", "pra_assessment"];

export function isWorkspaceOwnedLinkType(linkType: IncidentLinkType): boolean {
  return (WORKSPACE_OWNED_LINK_TYPES as string[]).includes(linkType);
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

/**
 * Full ISO 8601 timestamp: YYYY-MM-DDTHH:mm:ss[.sss](Z|+HH:mm|-HH:mm). Only
 * the fractional-seconds and offset parts are optional - unlike
 * `new Date(value)`, this does not accept a bare year ("2026"), a bare
 * number ("5"), or any other partial form Date.parse happens to tolerate.
 */
const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

/**
 * Validates a YYYY-MM-DD date or a full ISO 8601 timestamp, and round-trip
 * verifies it parses to a real calendar date/time (rejects e.g. "2026",
 * "0", "5", and "2026-02-30", all of which `new Date(value)` alone accepts
 * by rolling them over or defaulting missing fields).
 */
export function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  if (ISO_DATE_RE.test(value)) return isIsoDate(value);
  if (!ISO_TIMESTAMP_RE.test(value)) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  // Round-trip the date portion to reject calendar-invalid values like
  // 2026-02-30T00:00:00.000Z, which Date happily rolls over to March 2nd.
  const datePart = value.slice(0, 10);
  return d.toISOString().slice(0, 10) === datePart;
}

/**
 * Normalises a timestamp-ish value to epoch milliseconds for comparison.
 * Postgres timestamptz columns come back from `pg` as JS Date objects (no
 * type parsers are registered - see lib/db.ts), not strings, while request
 * bodies are always strings. Comparing those two representations directly
 * (e.g. `a > b`) coerces both to numbers via JS's default ToPrimitive
 * behaviour - `Number("2026-05-01")` is NaN - so the comparison is silently
 * always false. Converting both sides through this function first makes the
 * comparison actually work, regardless of which representation either side
 * is in. Returns null for anything absent or unparseable, so callers can
 * treat "unknown" the same as "not supplied" rather than as epoch 0.
 */
export function toEpochMillis(value: string | Date | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export type StepParseResult = { ok: true; value: number | undefined } | { ok: false };

/** Parses an optional current_step field (1-7). */
export function parseOptionalStep(value: unknown): StepParseResult {
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 7) {
    return { ok: true, value };
  }
  return { ok: false };
}

export type AffectedPopulationParseResult = { ok: true; value: AffectedPopulation } | { ok: false; error: string };

/**
 * Upper bound for any affectedPopulation numeric field. Number.isFinite
 * alone lets through values like Number.MAX_VALUE (~1.8e308), which is
 * meaningless as a customer/transaction count or a GBP amount and would
 * round-trip through the numeric(...) or jsonb column with precision loss.
 * Number.MAX_SAFE_INTEGER is a generous ceiling (over 9 quadrillion) that
 * still guarantees exact integer arithmetic.
 */
const MAX_AFFECTED_POPULATION_VALUE = Number.MAX_SAFE_INTEGER;

/**
 * Validates the affectedPopulation shape: {customersAffected?, transactionsAffected?,
 * valueGbp?} must each be a non-negative, finite number within
 * MAX_AFFECTED_POPULATION_VALUE when present; the two count fields must
 * additionally be integers (half a customer is not a valid count);
 * identificationMethod?/notes? must be strings when present. Unknown keys are
 * rejected rather than silently dropped.
 */
export function parseAffectedPopulation(value: unknown): AffectedPopulationParseResult {
  if (value === undefined || value === null) return { ok: true, value: {} };
  if (typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "affectedPopulation must be an object" };
  }
  const source = value as Record<string, unknown>;
  const allowedKeys = ["customersAffected", "transactionsAffected", "valueGbp", "identificationMethod", "notes"];
  for (const key of Object.keys(source)) {
    if (!allowedKeys.includes(key)) {
      return { ok: false, error: `Unknown affectedPopulation field: ${key}` };
    }
  }

  const result: AffectedPopulation = {};
  const integerKeys: readonly string[] = ["customersAffected", "transactionsAffected"];
  for (const key of ["customersAffected", "transactionsAffected", "valueGbp"] as const) {
    if (source[key] === undefined || source[key] === null) continue;
    const v = source[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > MAX_AFFECTED_POPULATION_VALUE) {
      return { ok: false, error: `affectedPopulation.${key} must be a non-negative number` };
    }
    if (integerKeys.includes(key) && !Number.isInteger(v)) {
      return { ok: false, error: `affectedPopulation.${key} must be a whole number` };
    }
    result[key] = v;
  }
  for (const key of ["identificationMethod", "notes"] as const) {
    if (source[key] === undefined || source[key] === null) continue;
    const v = source[key];
    if (typeof v !== "string") {
      return { ok: false, error: `affectedPopulation.${key} must be a string` };
    }
    result[key] = v;
  }

  return { ok: true, value: result };
}
