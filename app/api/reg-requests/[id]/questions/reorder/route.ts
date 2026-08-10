import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { reorderRegQuestions } from "@/lib/repo/reg-requests";
import { ACTOR, badRequest, conflict, isUuid, notFound, requireRegRequest, serverError } from "@/lib/reg-response/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/reg-requests/[id]/questions/reorder - body
 * {orderedQuestionIds: string[]}. Must be exactly the request's current
 * question ids, each exactly once; renumbers atomically in a
 * negative-then-final two-pass update so the UNIQUE (request_id, position)
 * constraint is never tripped mid-reorder (see reorderRegQuestions).
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Reg request not found");
    const reqRow = await requireRegRequest(workspace.id, id);
    if (!reqRow) return notFound("Reg request not found");

    const body = await request.json().catch(() => null);
    const orderedQuestionIds = Array.isArray(body?.orderedQuestionIds) ? body.orderedQuestionIds : null;
    if (!orderedQuestionIds || orderedQuestionIds.length === 0) {
      return badRequest("orderedQuestionIds must be a non-empty array");
    }
    if (!orderedQuestionIds.every((v: unknown) => isUuid(v))) {
      return badRequest("orderedQuestionIds must contain only UUIDs");
    }
    if (new Set(orderedQuestionIds).size !== orderedQuestionIds.length) {
      return badRequest("orderedQuestionIds must not contain duplicates");
    }

    const result = await reorderRegQuestions(workspace.id, id, orderedQuestionIds, ACTOR);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Reg request not found");
      if (result.reason === "invalid_question_set") {
        return badRequest("orderedQuestionIds must be exactly the request's current question ids, each exactly once");
      }
      return conflict("Cannot reorder questions on a reg request that is already closed or cancelled");
    }

    return NextResponse.json({ questions: result.questions });
  } catch (error) {
    return serverError("Reg question reorder error", error);
  }
});
