import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createRegCommitment, listRegCommitments } from "@/lib/repo/reg-requests";
import { badRequest, conflict, isIsoDate, isUuid, notFound, requirePerson, requireRegRequest, serverError } from "@/lib/reg-response/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/reg-requests/[id]/commitments */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Reg request not found");
    const reqRow = await requireRegRequest(workspace.id, id);
    if (!reqRow) return notFound("Reg request not found");

    const commitments = await listRegCommitments(workspace.id, id);
    return NextResponse.json({ commitments });
  } catch (error) {
    return serverError("Reg commitment list error", error);
  }
});

/**
 * POST /api/reg-requests/[id]/commitments - body {questionId?, description,
 * dueDate?, ownerPersonId?, note?}. If dueDate is supplied, a tracked action
 * (subjectType 'reg_commitment') is created in the SAME transaction as the
 * commitment and its id stored on action_id - see createRegCommitment. No
 * dueDate means no action.
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context, actor) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Reg request not found");
    const reqRow = await requireRegRequest(workspace.id, id);
    if (!reqRow) return notFound("Reg request not found");

    const body = await request.json().catch(() => null);

    const description = typeof body?.description === "string" ? body.description.trim() : "";
    if (!description) return badRequest("Missing required field: description");

    let questionId: string | null = null;
    if (body?.questionId !== undefined && body.questionId !== null) {
      if (!isUuid(body.questionId)) return badRequest("questionId must be a valid UUID");
      questionId = body.questionId;
    }

    let dueDate: string | null = null;
    if (body?.dueDate !== undefined && body.dueDate !== null) {
      if (!isIsoDate(body.dueDate)) return badRequest("Invalid dueDate: must be an ISO date (YYYY-MM-DD)");
      dueDate = body.dueDate;
    }

    let ownerPersonId: string | null = null;
    if (body?.ownerPersonId !== undefined && body.ownerPersonId !== null) {
      if (!isUuid(body.ownerPersonId)) return badRequest("ownerPersonId must be a valid UUID");
      const person = await requirePerson(workspace.id, body.ownerPersonId);
      if (!person) return badRequest("Unknown ownerPersonId for this workspace");
      ownerPersonId = person.id;
    }

    const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim() : null;

    const result = await createRegCommitment(workspace.id, id, { questionId, description, dueDate, ownerPersonId, note }, actor);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Reg request not found");
      if (result.reason === "question_not_found") return badRequest("Unknown questionId for this reg request");
      return conflict("Cannot add commitments to a reg request that is already closed or cancelled");
    }

    return NextResponse.json({ commitment: result.commitment }, { status: 201 });
  } catch (error) {
    return serverError("Reg commitment create error", error);
  }
});
