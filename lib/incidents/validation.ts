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

/** Validates an ISO 8601 timestamp (date or date-time, anything Date.parse and JS Date round-trip agree on). */
export function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
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
 * Validates the affectedPopulation shape: {customersAffected?, transactionsAffected?,
 * valueGbp?} must each be a non-negative finite number when present;
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
  for (const key of ["customersAffected", "transactionsAffected", "valueGbp"] as const) {
    if (source[key] === undefined || source[key] === null) continue;
    const v = source[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      return { ok: false, error: `affectedPopulation.${key} must be a non-negative number` };
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
