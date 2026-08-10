import { NextResponse } from "next/server";
import {
  CONTROL_FIELD_WHITELIST,
  getControlChange,
  type ControlChangeRow,
  type ControlChangeStatus,
  type ControlChangeType,
  type ControlFieldValues,
} from "@/lib/repo/control-changes";
import { getWorkspaceControl, type WorkspaceControlRow, type ControlLifecycleStatus, type ControlEffectivenessRating } from "@/lib/repo/controls";
import type { DecisionOutcome } from "@/lib/repo/decisions";
import { requirePerson } from "@/lib/pra/helpers";

/**
 * Shared plumbing for the app/api/control-changes/** route handlers, mirroring
 * lib/pra/helpers.ts. No identity exists yet (anonymous workspace only), so
 * every mutation is attributed to this fixed actor string.
 */
export const ACTOR = "workspace";

/** Subject type used across decisions/conditions/actions/evidence/comments for a control change. */
export const SUBJECT_TYPE = "control_change";

const CONTROL_CHANGE_TYPES: ControlChangeType[] = [
  "threshold",
  "rule_logic",
  "scope",
  "ownership",
  "frequency",
  "system",
  "decommission",
  "other",
];

export function isControlChangeType(value: unknown): value is ControlChangeType {
  return typeof value === "string" && (CONTROL_CHANGE_TYPES as string[]).includes(value);
}

const CONTROL_CHANGE_STATUSES: ControlChangeStatus[] = [
  "draft",
  "in_review",
  "approved",
  "rejected",
  "implemented",
  "rolled_back",
];

export function isControlChangeStatus(value: unknown): value is ControlChangeStatus {
  return typeof value === "string" && (CONTROL_CHANGE_STATUSES as string[]).includes(value);
}

const DECISION_OUTCOMES: DecisionOutcome[] = ["approve", "approve_with_conditions", "reject"];

export function isDecisionOutcome(value: unknown): value is DecisionOutcome {
  return typeof value === "string" && (DECISION_OUTCOMES as string[]).includes(value);
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

export function notFound(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function conflict(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function serverError(context: string, error: unknown): NextResponse {
  console.error(`${context}:`, error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** Loads a control change and implicitly verifies it belongs to the authed workspace. */
export async function requireControlChange(workspaceId: string, id: string): Promise<ControlChangeRow | null> {
  return getControlChange(workspaceId, id);
}

/** Loads the workspace_control a change targets, verifying it belongs to the same workspace. */
export async function requireChangeControl(change: ControlChangeRow): Promise<WorkspaceControlRow | null> {
  return getWorkspaceControl(change.workspace_id, change.workspace_control_id);
}

const CONTROL_LIFECYCLE_STATUSES: ControlLifecycleStatus[] = [
  "not_started",
  "in_progress",
  "needs_review",
  "gaps",
  "implemented",
];

const CONTROL_EFFECTIVENESS_RATINGS: ControlEffectivenessRating[] = ["strong", "adequate", "weak", "not_assessed"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

const STRING_OR_NULL_FIELDS = ["objective", "threshold", "operatingFrequency"] as const;
const STRING_ARRAY_FIELDS = ["systems", "dataInputs", "productApplicability", "typologySlugs"] as const;
const PERSON_REF_FIELDS = ["ownerPersonId", "approverPersonId"] as const;

export type FieldValidationResult = { ok: true; value: ControlFieldValues } | { ok: false; error: string };

/**
 * Validates a `proposed` (or `baseline`, if it is ever made patchable) object
 * field-by-field against CONTROL_FIELD_WHITELIST, returning either the
 * cleaned/trimmed object or a descriptive error. Unknown keys are silently
 * skipped (defensive, matching pickControlFields); every whitelisted key that
 * IS present must pass its type check or the whole patch is rejected - this
 * runs BEFORE the value is ever persisted, so a bad value can never reach
 * `control_changes.proposed` and 500 the implement step later.
 *
 * ownerPersonId / approverPersonId are resolved against requirePerson() so a
 * UUID from another workspace (or one that doesn't exist) is rejected here,
 * not silently written and cross-tenant-applied at implement time.
 */
export async function validateControlFieldValues(workspaceId: string, input: unknown): Promise<FieldValidationResult> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "must be an object" };
  }
  const source = input as Record<string, unknown>;
  const cleaned: ControlFieldValues = {};

  for (const key of CONTROL_FIELD_WHITELIST) {
    if (!(key in source)) continue;
    const value = source[key];

    if ((STRING_OR_NULL_FIELDS as readonly string[]).includes(key)) {
      if (value === null) {
        cleaned[key] = null;
      } else if (typeof value === "string") {
        cleaned[key] = value.trim();
      } else {
        return { ok: false, error: `${key} must be a string or null` };
      }
      continue;
    }

    if (key === "status") {
      if (typeof value !== "string" || !CONTROL_LIFECYCLE_STATUSES.includes(value as ControlLifecycleStatus)) {
        return { ok: false, error: `status must be one of ${CONTROL_LIFECYCLE_STATUSES.join(", ")}` };
      }
      cleaned.status = value;
      continue;
    }

    if (key === "effectivenessRating") {
      if (typeof value !== "string" || !CONTROL_EFFECTIVENESS_RATINGS.includes(value as ControlEffectivenessRating)) {
        return { ok: false, error: `effectivenessRating must be one of ${CONTROL_EFFECTIVENESS_RATINGS.join(", ")}` };
      }
      cleaned.effectivenessRating = value;
      continue;
    }

    if ((STRING_ARRAY_FIELDS as readonly string[]).includes(key)) {
      if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
        return { ok: false, error: `${key} must be an array of strings` };
      }
      cleaned[key] = value as string[];
      continue;
    }

    if ((PERSON_REF_FIELDS as readonly string[]).includes(key)) {
      if (value === null) {
        cleaned[key] = null;
        continue;
      }
      if (typeof value !== "string" || !UUID_RE.test(value)) {
        return { ok: false, error: `${key} must be a UUID or null` };
      }
      const person = await requirePerson(workspaceId, value);
      if (!person) {
        return { ok: false, error: `${key} does not reference a person in this workspace` };
      }
      cleaned[key] = value;
      continue;
    }
  }

  return { ok: true, value: cleaned };
}
