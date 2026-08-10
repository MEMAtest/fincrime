import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { closeRequest } from "@/lib/repo/reg-requests";
import { ACTOR, isUuid, notFound, requireRegRequest, serverError } from "@/lib/reg-response/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function closeConflict(message: string, reason: "already_final" | "not_submitted" | "open_commitments"): NextResponse {
  return NextResponse.json({ error: message, reason }, { status: 409 });
}

/**
 * POST /api/reg-requests/[id]/close - closes the request. Requires status =
 * 'submitted' (not_submitted otherwise) AND every commitment to be in a
 * terminal state (met/missed/withdrawn) - see closeRequest in
 * lib/repo/reg-requests.ts for why: an open commitment means the matter is
 * not actually closed.
 */
export const POST = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Reg request not found");
    const reqRow = await requireRegRequest(workspace.id, id);
    if (!reqRow) return notFound("Reg request not found");

    const result = await closeRequest(workspace.id, id, ACTOR);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Reg request not found");
      if (result.reason === "not_submitted") return closeConflict("Cannot close a reg request before it has been submitted", "not_submitted");
      if (result.reason === "open_commitments") {
        return closeConflict("Cannot close a reg request while any commitment is still open, in progress, or otherwise non-terminal", "open_commitments");
      }
      return closeConflict("Reg request is already closed or cancelled", "already_final");
    }

    return NextResponse.json({ request: result.request });
  } catch (error) {
    return serverError("Reg request close error", error);
  }
});
