import { NextResponse } from "next/server";
import {
  getReadinessAssessment,
  getReadinessObligation,
  type ReadinessAssessmentRow,
  type ReadinessObligationRow,
} from "../repo/readiness";
import { getProduct, type ProductRow } from "../repo/products";
import { getWorkspaceControl, type WorkspaceControlRow } from "../repo/controls";
import { getPerson, type PersonRow } from "../repo/people";
import { isUuid as isUuidValidator, isIsoDate as isIsoDateValidator } from "./validation";

/**
 * Shared plumbing for the app/api/readiness/** route handlers, mirroring
 * lib/incidents/helpers.ts. No identity exists yet (anonymous workspace
 * only), so every mutation is attributed to this fixed actor string. The pure
 * request-body validators live in ./validation.ts (kept free of value
 * imports so they stay unit-testable without a db); this file re-exports
 * them alongside the db-touching lookups and NextResponse helpers.
 */
export const ACTOR = "workspace";

/** Subject type used for decisions/conditions/actions/evidence/comments attached to the assessment as a whole. */
export const SUBJECT_TYPE = "readiness_assessment";
/** Subject type used for evidence attached to a single obligation. */
export const OBLIGATION_SUBJECT_TYPE = "readiness_obligation";

export {
  isEntityType,
  isJurisdiction,
  isReadinessRiskLevel,
  isReadinessStatus,
  isReadinessGap,
  isUuid,
  isIsoDate,
  parseOptionalStep,
  type StepParseResult,
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

/** Loads a readiness assessment and implicitly verifies it belongs to the authed workspace. */
export async function requireReadinessAssessment(workspaceId: string, id: string): Promise<ReadinessAssessmentRow | null> {
  return getReadinessAssessment(workspaceId, id);
}

/** Loads an obligation and verifies it belongs to both the workspace AND the given assessment. */
export async function requireReadinessObligation(
  workspaceId: string,
  assessmentId: string,
  obligationId: string
): Promise<ReadinessObligationRow | null> {
  const obligation = await getReadinessObligation(workspaceId, obligationId);
  if (!obligation || obligation.assessment_id !== assessmentId) return null;
  return obligation;
}

/** Verifies a products id belongs to the authed workspace. */
export async function requireProduct(workspaceId: string, id: string): Promise<ProductRow | null> {
  return getProduct(workspaceId, id);
}

/** Verifies a workspace_controls id belongs to the authed workspace. */
export async function requireWorkspaceControl(workspaceId: string, id: string): Promise<WorkspaceControlRow | null> {
  return getWorkspaceControl(workspaceId, id);
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
 * Parses the shared body shape for the submit/approve-local/approve-global/
 * reject routes: {decidedByPersonId, rationale?, conditions?[]}. Mirrors the
 * inline parsing in app/api/pra/assessments/[id]/decision/route.ts, factored
 * out here since three readiness routes (approve-local, approve-global,
 * reject) share it verbatim.
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
