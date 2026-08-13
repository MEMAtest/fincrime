import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { deleteRegQuestion, updateRegQuestion, type UpdateRegQuestionInput } from "@/lib/repo/reg-requests";
import { badRequest, conflict, isRegQuestionStatus, isUuid, notFound, requireRegQuestion, requireRegRequest, serverError } from "@/lib/reg-response/helpers";

interface RouteContext {
  params: Promise<{ id: string; questionId: string }>;
}

/**
 * PATCH /api/reg-requests/[id]/questions/[questionId] - body {question?,
 * response?, exceptionNote?, status?}. NOT position - use
 * /questions/reorder, which is the only path that may change ordering.
 */
export const PATCH = withWorkspace<RouteContext>(async (request, workspace, context, actor) => {
  try {
    const { id, questionId } = await context.params;
    if (!isUuid(id) || !isUuid(questionId)) return notFound("Reg question not found");
    const reqRow = await requireRegRequest(workspace.id, id);
    if (!reqRow) return notFound("Reg request not found");
    const question = await requireRegQuestion(workspace.id, id, questionId);
    if (!question) return notFound("Reg question not found");

    const body = await request.json().catch(() => null);

    if (body?.position !== undefined) {
      return badRequest("position cannot be set via PATCH; use /questions/reorder");
    }

    const patch: UpdateRegQuestionInput = {};

    if (body?.question !== undefined) {
      const q = typeof body.question === "string" ? body.question.trim() : "";
      if (!q) return badRequest("question must be a non-empty string");
      patch.question = q;
    }

    if (body?.response !== undefined) {
      patch.response = typeof body.response === "string" && body.response.trim() ? body.response.trim() : null;
    }

    if (body?.exceptionNote !== undefined) {
      patch.exceptionNote = typeof body.exceptionNote === "string" && body.exceptionNote.trim() ? body.exceptionNote.trim() : null;
    }

    if (body?.status !== undefined) {
      if (!isRegQuestionStatus(body.status)) return badRequest("Invalid status: must be unanswered, drafted, or reviewed");
      patch.status = body.status;
    }

    const result = await updateRegQuestion(workspace.id, id, questionId, patch, actor);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Reg request not found");
      if (result.reason === "question_not_found") return notFound("Reg question not found");
      if (result.reason === "answer_required") {
        return badRequest("Cannot mark a question drafted or reviewed with no response and no exception note");
      }
      return conflict("Cannot update a question on a reg request that is already closed or cancelled");
    }

    return NextResponse.json({ question: result.question });
  } catch (error) {
    return serverError("Reg question update error", error);
  }
});

/** DELETE /api/reg-requests/[id]/questions/[questionId] - renumbers remaining questions to stay contiguous. */
export const DELETE = withWorkspace<RouteContext>(async (_request, workspace, context, actor) => {
  try {
    const { id, questionId } = await context.params;
    if (!isUuid(id) || !isUuid(questionId)) return notFound("Reg question not found");
    const reqRow = await requireRegRequest(workspace.id, id);
    if (!reqRow) return notFound("Reg request not found");
    const question = await requireRegQuestion(workspace.id, id, questionId);
    if (!question) return notFound("Reg question not found");

    const result = await deleteRegQuestion(workspace.id, id, questionId, actor);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Reg request not found");
      if (result.reason === "question_not_found") return notFound("Reg question not found");
      return conflict("Cannot delete a question on a reg request that is already closed or cancelled");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError("Reg question delete error", error);
  }
});
