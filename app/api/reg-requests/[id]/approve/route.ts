import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { approveResponse } from "@/lib/repo/reg-requests";
import { ACTOR, badRequest, isUuid, notFound, parseApprovalBody, requireRegRequest, serverError } from "@/lib/reg-response/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function approveConflict(message: string, reason: "already_final" | "wrong_status" | "unanswered_questions" | "no_questions"): NextResponse {
  return NextResponse.json({ error: message, reason }, { status: 409 });
}

/**
 * POST /api/reg-requests/[id]/approve - body {decidedByPersonId, rationale?,
 * conditions?[]}. Records an approval decision and moves the request to
 * 'approved'. Refuses (no_questions) a request with zero questions and
 * (unanswered_questions) while any question is still 'unanswered' - see
 * approveResponse in lib/repo/reg-requests.ts for why those guards exist.
 * Requires the request to be draft/in_progress/in_review (wrong_status
 * otherwise).
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Reg request not found");
    const reqRow = await requireRegRequest(workspace.id, id);
    if (!reqRow) return notFound("Reg request not found");

    const body = await request.json().catch(() => ({}));
    const parsed = await parseApprovalBody(workspace.id, body);
    if (!parsed.ok) return badRequest(parsed.error);

    const result = await approveResponse(workspace.id, id, parsed.decidedByPersonId, parsed.rationale, parsed.conditions, ACTOR);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Reg request not found");
      if (result.reason === "no_questions") {
        return approveConflict("Cannot approve a request with no questions recorded", "no_questions");
      }
      if (result.reason === "unanswered_questions") {
        return approveConflict("Cannot approve while any question is unanswered", "unanswered_questions");
      }
      if (result.reason === "wrong_status") {
        return approveConflict("Only a draft, in-progress, or in-review reg request can be approved", "wrong_status");
      }
      return approveConflict("Reg request is already closed or cancelled", "already_final");
    }

    return NextResponse.json({ request: result.request, decision: result.decision, conditions: result.conditions });
  } catch (error) {
    return serverError("Reg request approve error", error);
  }
});
