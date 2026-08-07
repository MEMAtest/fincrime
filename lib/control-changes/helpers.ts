import { NextResponse } from "next/server";
import { getControlChange, type ControlChangeRow, type ControlChangeStatus, type ControlChangeType } from "@/lib/repo/control-changes";
import { getWorkspaceControl, type WorkspaceControlRow } from "@/lib/repo/controls";
import type { DecisionOutcome } from "@/lib/repo/decisions";

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
