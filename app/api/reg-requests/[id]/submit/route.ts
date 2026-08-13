import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { markSubmitted } from "@/lib/repo/reg-requests";
import { isUuid, notFound, requireRegRequest, serverError } from "@/lib/reg-response/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function submitConflict(message: string, reason: "already_final" | "not_approved"): NextResponse {
  return NextResponse.json({ error: message, reason }, { status: 409 });
}

/** POST /api/reg-requests/[id]/submit - marks the request submitted. Requires status = 'approved'. */
export const POST = withWorkspace<RouteContext>(async (_request, workspace, context, actor) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Reg request not found");
    const reqRow = await requireRegRequest(workspace.id, id);
    if (!reqRow) return notFound("Reg request not found");

    const result = await markSubmitted(workspace.id, id, actor);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Reg request not found");
      if (result.reason === "not_approved") return submitConflict("Cannot mark a reg request submitted before it is approved", "not_approved");
      return submitConflict("Reg request is already closed or cancelled", "already_final");
    }

    return NextResponse.json({ request: result.request });
  } catch (error) {
    return serverError("Reg request submit error", error);
  }
});
