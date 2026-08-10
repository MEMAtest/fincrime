import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { deleteRegQuestionLink } from "@/lib/repo/reg-requests";
import { ACTOR, conflict, isUuid, notFound, requireRegQuestion, requireRegQuestionLink, requireRegRequest, serverError } from "@/lib/reg-response/helpers";

interface RouteContext {
  params: Promise<{ id: string; questionId: string; linkId: string }>;
}

/** DELETE /api/reg-requests/[id]/questions/[questionId]/links/[linkId] */
export const DELETE = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id, questionId, linkId } = await context.params;
    if (!isUuid(id) || !isUuid(questionId) || !isUuid(linkId)) return notFound("Reg question link not found");
    const reqRow = await requireRegRequest(workspace.id, id);
    if (!reqRow) return notFound("Reg request not found");
    const question = await requireRegQuestion(workspace.id, id, questionId);
    if (!question) return notFound("Reg question not found");
    const link = await requireRegQuestionLink(workspace.id, questionId, linkId);
    if (!link) return notFound("Reg question link not found");

    const result = await deleteRegQuestionLink(workspace.id, id, linkId, ACTOR);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Reg request not found");
      if (result.reason === "link_not_found") return notFound("Reg question link not found");
      return conflict("Cannot delete a link on a reg request that is already closed or cancelled");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError("Reg question link delete error", error);
  }
});
