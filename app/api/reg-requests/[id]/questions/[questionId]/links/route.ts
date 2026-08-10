import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createRegQuestionLink, listRegQuestionLinks } from "@/lib/repo/reg-requests";
import { ACTOR, badRequest, conflict, isRegQuestionLinkType, isUuid, notFound, requireRegQuestion, requireRegRequest, serverError } from "@/lib/reg-response/helpers";

interface RouteContext {
  params: Promise<{ id: string; questionId: string }>;
}

/** GET /api/reg-requests/[id]/questions/[questionId]/links - substantiation links attached to this question. */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id, questionId } = await context.params;
    if (!isUuid(id) || !isUuid(questionId)) return notFound("Reg question not found");
    const reqRow = await requireRegRequest(workspace.id, id);
    if (!reqRow) return notFound("Reg request not found");
    const question = await requireRegQuestion(workspace.id, id, questionId);
    if (!question) return notFound("Reg question not found");

    const links = await listRegQuestionLinks(workspace.id, questionId);
    return NextResponse.json({ links });
  } catch (error) {
    return serverError("Reg question link list error", error);
  }
});

/**
 * POST /api/reg-requests/[id]/questions/[questionId]/links - body
 * {linkType, targetId, note?}. targetId must belong to this workspace AND
 * be a row of the table linkType claims (verified by
 * createRegQuestionLink) - a control_test id passed as 'incident' 400s, as
 * does a foreign workspace's id of the right kind.
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id, questionId } = await context.params;
    if (!isUuid(id) || !isUuid(questionId)) return notFound("Reg question not found");
    const reqRow = await requireRegRequest(workspace.id, id);
    if (!reqRow) return notFound("Reg request not found");
    const question = await requireRegQuestion(workspace.id, id, questionId);
    if (!question) return notFound("Reg question not found");

    const body = await request.json().catch(() => null);

    if (!isRegQuestionLinkType(body?.linkType)) {
      return badRequest(
        "Invalid linkType: must be workspace_control, control_test, control_change, incident, readiness_assessment, pra_assessment, or evidence"
      );
    }
    if (!isUuid(body?.targetId)) return badRequest("targetId must be a valid UUID");
    const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim() : null;

    const result = await createRegQuestionLink(workspace.id, id, questionId, { linkType: body.linkType, targetId: body.targetId, note }, ACTOR);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Reg request not found");
      if (result.reason === "question_not_found") return notFound("Reg question not found");
      if (result.reason === "invalid_target") {
        return badRequest("targetId does not belong to this workspace, or is not a row of the kind linkType claims");
      }
      if (result.reason === "duplicate") return conflict("This exact link already exists on this question", "duplicate");
      return conflict("Cannot add a link to a question on a reg request that is already closed or cancelled");
    }

    return NextResponse.json({ link: result.link }, { status: 201 });
  } catch (error) {
    return serverError("Reg question link create error", error);
  }
});
