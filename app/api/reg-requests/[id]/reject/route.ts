import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { reject } from "@/lib/repo/reg-requests";
import { ACTOR, badRequest, isUuid, notFound, parseApprovalBody, requireRegRequest, serverError } from "@/lib/reg-response/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function rejectConflict(message: string): NextResponse {
  return NextResponse.json({ error: message, reason: "already_final" }, { status: 409 });
}

/**
 * POST /api/reg-requests/[id]/reject - body {decidedByPersonId, rationale?,
 * conditions?[]}. Records a reject decision and moves the request to
 * 'cancelled'. Allowed from any non-final status - not blocked by
 * unanswered questions, since a reviewer may reject a response precisely
 * because of them.
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

    const result = await reject(workspace.id, id, parsed.decidedByPersonId, parsed.rationale, parsed.conditions, ACTOR);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Reg request not found");
      return rejectConflict("Reg request is already closed or cancelled");
    }

    return NextResponse.json({ request: result.request, decision: result.decision, conditions: result.conditions });
  } catch (error) {
    return serverError("Reg request reject error", error);
  }
});
