import { NextResponse } from "next/server";
import {
  getRegRequest,
  getRegQuestion,
  getRegCommitment,
  getRegQuestionLink,
  type RegRequestRow,
  type RegQuestionRow,
  type RegCommitmentRow,
  type RegQuestionLinkRow,
} from "../repo/reg-requests";
import { getPerson, type PersonRow } from "../repo/people";
import { isUuid as isUuidValidator, isIsoDate as isIsoDateValidator } from "./validation";

/**
 * Shared plumbing for the app/api/reg-requests/** route handlers, mirroring
 * lib/readiness/helpers.ts and lib/pra/helpers.ts. No identity exists yet
 * (anonymous workspace only), so every mutation is attributed to this fixed
 * actor string. The pure request-body validators live in ./validation.ts
 * (kept free of value imports so they stay unit-testable without a db);
 * this file re-exports them alongside the db-touching lookups and
 * NextResponse helpers.
 */
export const ACTOR = "workspace";

export {
  isRegRequestChannel,
  isRegRequestStatus,
  isRegQuestionStatus,
  isRegQuestionLinkType,
  isRegCommitmentStatus,
  isTerminalCommitmentStatus,
  isUuid,
  isIsoDate,
  parseOptionalStep,
  parsePosition,
  type StepParseResult,
  type PositionParseResult,
} from "./validation";

export function notFound(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function conflict(message: string, reason?: string): NextResponse {
  return NextResponse.json(reason ? { error: message, reason } : { error: message }, { status: 409 });
}

export function serverError(context: string, error: unknown): NextResponse {
  console.error(`${context}:`, error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** Loads a reg_request and implicitly verifies it belongs to the authed workspace. */
export async function requireRegRequest(workspaceId: string, id: string): Promise<RegRequestRow | null> {
  return getRegRequest(workspaceId, id);
}

/** Loads a question and verifies it belongs to both the workspace AND the given request. */
export async function requireRegQuestion(workspaceId: string, requestId: string, questionId: string): Promise<RegQuestionRow | null> {
  const question = await getRegQuestion(workspaceId, questionId);
  if (!question || question.request_id !== requestId) return null;
  return question;
}

/** Loads a commitment and verifies it belongs to both the workspace AND the given request. */
export async function requireRegCommitment(workspaceId: string, requestId: string, commitmentId: string): Promise<RegCommitmentRow | null> {
  const commitment = await getRegCommitment(workspaceId, commitmentId);
  if (!commitment || commitment.request_id !== requestId) return null;
  return commitment;
}

/** Loads a question link and verifies it belongs to both the workspace AND the given question. */
export async function requireRegQuestionLink(workspaceId: string, questionId: string, linkId: string): Promise<RegQuestionLinkRow | null> {
  const link = await getRegQuestionLink(workspaceId, linkId);
  if (!link || link.question_id !== questionId) return null;
  return link;
}

/** Loads a workspace_people row and verifies it belongs to the authed workspace, for owner/approver references. */
export async function requirePerson(workspaceId: string, id: string): Promise<PersonRow | null> {
  return getPerson(workspaceId, id);
}

export interface ConditionInput {
  description: string;
  dueDate: string | null;
  ownerPersonId: string | null;
}

export type ParseApprovalBodyResult =
  | { ok: true; decidedByPersonId: string; rationale: string | null; conditions: ConditionInput[] }
  | { ok: false; error: string };

/**
 * Parses the shared body shape for the approve/reject routes:
 * {decidedByPersonId, rationale?, conditions?[]}. Mirrors
 * lib/readiness/helpers.ts parseApprovalBody verbatim (kept as its own copy
 * per module, matching the existing convention of lib/pra/helpers.ts /
 * lib/readiness/helpers.ts each carrying their own rather than sharing one
 * cross-module import).
 */
export async function parseApprovalBody(workspaceId: string, body: unknown): Promise<ParseApprovalBodyResult> {
  const b = (body ?? {}) as Record<string, unknown>;

  const decidedByPersonId = typeof b.decidedByPersonId === "string" ? b.decidedByPersonId : "";
  if (!decidedByPersonId) return { ok: false, error: "Missing required field: decidedByPersonId" };
  if (!isUuidValidator(decidedByPersonId)) return { ok: false, error: "decidedByPersonId must be a valid UUID" };
  const decider = await requirePerson(workspaceId, decidedByPersonId);
  if (!decider) return { ok: false, error: "Unknown decidedByPersonId for this workspace" };

  const rationale = typeof b.rationale === "string" && b.rationale.trim() ? b.rationale.trim() : null;

  const rawConditions: unknown[] = Array.isArray(b.conditions) ? b.conditions : [];
  const conditions: ConditionInput[] = [];
  for (const raw of rawConditions) {
    const c = (raw ?? {}) as Record<string, unknown>;
    const description = typeof c.description === "string" ? c.description.trim() : "";
    if (!description) return { ok: false, error: "Each condition requires a non-empty description" };

    let ownerPersonId: string | null = null;
    if (c.ownerPersonId !== undefined && c.ownerPersonId !== null) {
      if (typeof c.ownerPersonId !== "string" || !isUuidValidator(c.ownerPersonId)) {
        return { ok: false, error: "Invalid ownerPersonId on a condition" };
      }
      const owner = await requirePerson(workspaceId, c.ownerPersonId);
      if (!owner) return { ok: false, error: "Unknown ownerPersonId on a condition" };
      ownerPersonId = owner.id;
    }
    let dueDate: string | null = null;
    if (c.dueDate !== undefined && c.dueDate !== null && c.dueDate !== "") {
      if (typeof c.dueDate !== "string" || !isIsoDateValidator(c.dueDate)) {
        return { ok: false, error: "Invalid dueDate on a condition: must be an ISO date (YYYY-MM-DD)" };
      }
      dueDate = c.dueDate;
    }
    conditions.push({ description, dueDate, ownerPersonId });
  }

  return { ok: true, decidedByPersonId: decider.id, rationale, conditions };
}
