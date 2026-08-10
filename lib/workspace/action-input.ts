/**
 * Pure validation helpers for the generic actions API
 * (app/api/workspace/actions/**) and the conditions PATCH endpoint
 * (app/api/workspace/conditions/[id]). Kept dependency-free (no db, no
 * NextResponse) so they can be unit tested directly - the routes only add
 * the workspace-scoped existence checks (requirePerson, requireAction, ...)
 * on top of what is validated here.
 */

import type { ActionPriority, ActionStatus } from "@/lib/repo/actions";
import type { ConditionStatus } from "@/lib/repo/decisions";

/** Subject types a generic action can be attached to. */
export const ACTION_SUBJECT_TYPES = ["pra_assessment", "control_change", "workspace_control", "monitoring", "incident"] as const;
export type ActionSubjectType = (typeof ACTION_SUBJECT_TYPES)[number];

export function isActionSubjectType(value: unknown): value is ActionSubjectType {
  return typeof value === "string" && (ACTION_SUBJECT_TYPES as readonly string[]).includes(value);
}

const ACTION_STATUSES: ActionStatus[] = ["open", "in_progress", "done", "cancelled"];
export function isActionStatus(value: unknown): value is ActionStatus {
  return typeof value === "string" && (ACTION_STATUSES as string[]).includes(value);
}

const ACTION_PRIORITIES: ActionPriority[] = ["high", "medium", "low"];
export function isActionPriority(value: unknown): value is ActionPriority {
  return typeof value === "string" && (ACTION_PRIORITIES as string[]).includes(value);
}

const CONDITION_STATUSES: ConditionStatus[] = ["open", "met", "breached"];
export function isConditionStatus(value: unknown): value is ConditionStatus {
  return typeof value === "string" && (CONDITION_STATUSES as string[]).includes(value);
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

export type FieldValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface ValidatedCreateActionInput {
  subjectType: ActionSubjectType;
  subjectId: string;
  title: string;
  ownerPersonId: string | null;
  dueDate: string | null;
  priority: ActionPriority;
  status: ActionStatus;
}

/**
 * Validates the body of POST /api/workspace/actions. Does NOT check that
 * ownerPersonId resolves to a real person in this workspace - that requires
 * a db lookup and is left to the route (requirePerson).
 */
export function validateCreateActionInput(body: unknown): FieldValidationResult<ValidatedCreateActionInput> {
  const source = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

  if (!isActionSubjectType(source.subjectType)) {
    return { ok: false, error: `subjectType must be one of ${ACTION_SUBJECT_TYPES.join(", ")}` };
  }

  if (!isUuid(source.subjectId)) {
    return { ok: false, error: "subjectId must be a valid UUID" };
  }

  const title = typeof source.title === "string" ? source.title.trim() : "";
  if (!title) {
    return { ok: false, error: "title must be a non-empty string" };
  }

  let ownerPersonId: string | null = null;
  if (source.ownerPersonId !== undefined && source.ownerPersonId !== null) {
    if (!isUuid(source.ownerPersonId)) return { ok: false, error: "ownerPersonId must be a valid UUID" };
    ownerPersonId = source.ownerPersonId;
  }

  let dueDate: string | null = null;
  if (source.dueDate !== undefined && source.dueDate !== null) {
    if (!isIsoDate(source.dueDate)) return { ok: false, error: "dueDate must be an ISO date (YYYY-MM-DD)" };
    dueDate = source.dueDate;
  }

  let priority: ActionPriority = "medium";
  if (source.priority !== undefined) {
    if (!isActionPriority(source.priority)) {
      return { ok: false, error: `priority must be one of ${ACTION_PRIORITIES.join(", ")}` };
    }
    priority = source.priority;
  }

  // Accepted on create so an action can start life already in progress.
  // Validated rather than ignored: silently dropping a supplied value is how
  // a caller ends up believing it was stored.
  let status: ActionStatus = "open";
  if (source.status !== undefined) {
    if (!isActionStatus(source.status)) {
      return { ok: false, error: `status must be one of ${ACTION_STATUSES.join(", ")}` };
    }
    status = source.status;
  }

  return {
    ok: true,
    value: { subjectType: source.subjectType, subjectId: source.subjectId, title, ownerPersonId, dueDate, priority, status },
  };
}

export interface ValidatedUpdateActionInput {
  title?: string;
  ownerPersonId?: string | null;
  dueDate?: string | null;
  status?: ActionStatus;
  priority?: ActionPriority;
}

/** Validates the body of PATCH /api/workspace/actions/[id]. Every field is optional; only supplied fields are validated/returned. */
export function validateUpdateActionInput(body: unknown): FieldValidationResult<ValidatedUpdateActionInput> {
  const source = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const patch: ValidatedUpdateActionInput = {};

  if (source.title !== undefined) {
    const title = typeof source.title === "string" ? source.title.trim() : "";
    if (!title) return { ok: false, error: "title must be a non-empty string" };
    patch.title = title;
  }

  if (source.ownerPersonId !== undefined) {
    if (source.ownerPersonId === null) {
      patch.ownerPersonId = null;
    } else if (isUuid(source.ownerPersonId)) {
      patch.ownerPersonId = source.ownerPersonId;
    } else {
      return { ok: false, error: "ownerPersonId must be a valid UUID or null" };
    }
  }

  if (source.dueDate !== undefined) {
    if (source.dueDate === null) {
      patch.dueDate = null;
    } else if (isIsoDate(source.dueDate)) {
      patch.dueDate = source.dueDate;
    } else {
      return { ok: false, error: "dueDate must be an ISO date (YYYY-MM-DD) or null" };
    }
  }

  if (source.status !== undefined) {
    if (!isActionStatus(source.status)) {
      return { ok: false, error: `status must be one of ${ACTION_STATUSES.join(", ")}` };
    }
    patch.status = source.status;
  }

  if (source.priority !== undefined) {
    if (!isActionPriority(source.priority)) {
      return { ok: false, error: `priority must be one of ${ACTION_PRIORITIES.join(", ")}` };
    }
    patch.priority = source.priority;
  }

  return { ok: true, value: patch };
}

export interface ValidatedUpdateConditionInput {
  description?: string;
  dueDate?: string | null;
  status?: ConditionStatus;
  ownerPersonId?: string | null;
}

/** Validates the body of PATCH /api/workspace/conditions/[id]. */
export function validateUpdateConditionInput(body: unknown): FieldValidationResult<ValidatedUpdateConditionInput> {
  const source = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const patch: ValidatedUpdateConditionInput = {};

  if (source.description !== undefined) {
    const description = typeof source.description === "string" ? source.description.trim() : "";
    if (!description) return { ok: false, error: "description must be a non-empty string" };
    patch.description = description;
  }

  if (source.dueDate !== undefined) {
    if (source.dueDate === null) {
      patch.dueDate = null;
    } else if (isIsoDate(source.dueDate)) {
      patch.dueDate = source.dueDate;
    } else {
      return { ok: false, error: "dueDate must be an ISO date (YYYY-MM-DD) or null" };
    }
  }

  if (source.status !== undefined) {
    if (!isConditionStatus(source.status)) {
      return { ok: false, error: `status must be one of ${CONDITION_STATUSES.join(", ")}` };
    }
    patch.status = source.status;
  }

  if (source.ownerPersonId !== undefined) {
    if (source.ownerPersonId === null) {
      patch.ownerPersonId = null;
    } else if (isUuid(source.ownerPersonId)) {
      patch.ownerPersonId = source.ownerPersonId;
    } else {
      return { ok: false, error: "ownerPersonId must be a valid UUID or null" };
    }
  }

  return { ok: true, value: patch };
}
