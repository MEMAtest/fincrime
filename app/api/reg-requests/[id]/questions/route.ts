import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createRegQuestion, listRegQuestions } from "@/lib/repo/reg-requests";
import { ACTOR, badRequest, conflict, isUuid, notFound, requireRegRequest, serverError } from "@/lib/reg-response/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/reg-requests/[id]/questions - the request's questions, in position order. */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Reg request not found");
    const reqRow = await requireRegRequest(workspace.id, id);
    if (!reqRow) return notFound("Reg request not found");

    const questions = await listRegQuestions(workspace.id, id);
    return NextResponse.json({ questions });
  } catch (error) {
    return serverError("Reg question list error", error);
  }
});

/**
 * POST /api/reg-requests/[id]/questions - body {question, response?,
 * exceptionNote?}. Always appended at the next position - position is only
 * ever changed via the dedicated reorder endpoint.
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Reg request not found");
    const reqRow = await requireRegRequest(workspace.id, id);
    if (!reqRow) return notFound("Reg request not found");

    const body = await request.json();

    if (body?.position !== undefined) {
      return badRequest("position cannot be set directly; questions are appended, then reordered via /questions/reorder");
    }

    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question) return badRequest("Missing required field: question");

    const response = typeof body?.response === "string" && body.response.trim() ? body.response.trim() : null;
    const exceptionNote = typeof body?.exceptionNote === "string" && body.exceptionNote.trim() ? body.exceptionNote.trim() : null;

    const result = await createRegQuestion(workspace.id, id, { question, response, exceptionNote }, ACTOR);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Reg request not found");
      return conflict("Cannot add questions to a reg request that is already closed or cancelled");
    }

    return NextResponse.json({ question: result.question }, { status: 201 });
  } catch (error) {
    return serverError("Reg question create error", error);
  }
});
