/**
 * Pure validation helpers for the app/api/readiness/** route handlers. Kept
 * dependency-free (no db, no NextResponse, no value imports of repo modules)
 * so they can be unit tested directly, mirroring lib/incidents/validation.ts.
 *
 * entity_type and jurisdiction are validated here against the REAL data/kyc
 * enums (data/kyc/types.ts EntityType / Jurisdiction) rather than a DB CHECK -
 * see the comment at the top of db/migrations/006_market_readiness.sql.
 */
import type { EntityType, Jurisdiction } from "../../data/kyc/types";
import { ENTITY_ORDER, JURISDICTION_ORDER } from "../../data/kyc/types";
import type { ReadinessRiskLevel, ReadinessStatus, ReadinessGap } from "../repo/readiness";

const ENTITY_TYPES = new Set<string>(ENTITY_ORDER);
const JURISDICTIONS = new Set<string>(JURISDICTION_ORDER);

export function isEntityType(value: unknown): value is EntityType {
  return typeof value === "string" && ENTITY_TYPES.has(value);
}

export function isJurisdiction(value: unknown): value is Jurisdiction {
  return typeof value === "string" && JURISDICTIONS.has(value);
}

const RISK_LEVELS: ReadinessRiskLevel[] = ["low", "medium", "high"];

export function isReadinessRiskLevel(value: unknown): value is ReadinessRiskLevel {
  return typeof value === "string" && (RISK_LEVELS as string[]).includes(value);
}

const STATUSES: ReadinessStatus[] = ["draft", "in_review", "approved_local", "approved_global", "rejected", "cancelled"];

export function isReadinessStatus(value: unknown): value is ReadinessStatus {
  return typeof value === "string" && (STATUSES as string[]).includes(value);
}

const GAPS: ReadinessGap[] = ["not_assessed", "none", "partial", "full"];

export function isReadinessGap(value: unknown): value is ReadinessGap {
  return typeof value === "string" && (GAPS as string[]).includes(value);
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
