import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createAction, type ActionPriority } from "@/lib/repo/actions";
import { isFinalReadinessStatus } from "@/lib/repo/readiness";
import {
  ACTOR,
  OBLIGATION_SUBJECT_TYPE,
  badRequest,
  conflict,
  isIsoDate,
  isUuid,
  notFound,
  requirePerson,
  requireReadinessAssessment,
  requireReadinessObligation,
  serverError,
} from "@/lib/readiness/helpers";

interface RouteContext {
  params: Promise<{ id: string; obligationId: string }>;
}

const VALID_PRIORITIES: ActionPriority[] = ["high", "medium", "low"];
function isActionPriority(value: unknown): value is ActionPriority {
  return typeof value === "string" && (VALID_PRIORITIES as string[]).includes(value);
}

/**
 * POST /api/readiness/[id]/obligations/[obligationId]/action - body
 * {title, ownerPersonId?, dueDate?, priority?}. Creates a remediation action
 * against this obligation specifically (subjectType 'readiness_obligation'),
 * distinct from an action against the assessment as a whole.
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id, obligationId } = await context.params;
    if (!isUuid(id) || !isUuid(obligationId)) return notFound("Readiness obligation not found");
    const assessment = await requireReadinessAssessment(workspace.id, id);
    if (!assessment) return notFound("Readiness assessment not found");
    if (isFinalReadinessStatus(assessment.status)) {
      return conflict("Cannot add actions to an obligation on an assessment that is already approved_global, rejected, or cancelled");
    }
    const obligation = await requireReadinessObligation(workspace.id, id, obligationId);
    if (!obligation) return notFound("Readiness obligation not found");

    const body = await request.json();

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return badRequest("Missing required field: title");

    let ownerPersonId: string | null = null;
    if (body?.ownerPersonId !== undefined && body.ownerPersonId !== null) {
      if (!isUuid(body.ownerPersonId)) return badRequest("ownerPersonId must be a valid UUID");
      const person = await requirePerson(workspace.id, body.ownerPersonId);
      if (!person) return badRequest("Unknown ownerPersonId for this workspace");
      ownerPersonId = person.id;
    }

    let dueDate: string | null = null;
    if (body?.dueDate !== undefined && body.dueDate !== null) {
      if (!isIsoDate(body.dueDate)) return badRequest("Invalid dueDate: must be an ISO date (YYYY-MM-DD)");
      dueDate = body.dueDate;
    }

    let priority: ActionPriority = "medium";
    if (body?.priority !== undefined) {
      if (!isActionPriority(body.priority)) return badRequest("Invalid priority: must be high, medium, or low");
      priority = body.priority;
    }

    const action = await createAction(
      workspace.id,
      { subjectType: OBLIGATION_SUBJECT_TYPE, subjectId: obligationId, title, ownerPersonId, dueDate, priority },
      ACTOR
    );

    return NextResponse.json({ action }, { status: 201 });
  } catch (error) {
    return serverError("Readiness obligation action create error", error);
  }
});
