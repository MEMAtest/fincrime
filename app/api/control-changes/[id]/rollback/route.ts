import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { rollbackControlChange } from "@/lib/repo/control-changes";
import { conflict, isUuid, notFound, requireControlChange, serverError } from "@/lib/control-changes/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/control-changes/[id]/rollback - runs rollbackControlChange:
 * restores the underlying workspace_control to the recorded `baseline`
 * values (via updateWorkspaceControl, so history is preserved as a new
 * version, never by rewriting history), stamps rolled_back_at, and moves
 * status to 'rolled_back'. 409 if the change is not currently 'implemented'.
 */
export const POST = withWorkspace<RouteContext>(async (_request, workspace, context, actor) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Control change not found");
    const change = await requireControlChange(workspace.id, id);
    if (!change) return notFound("Control change not found");

    const result = await rollbackControlChange(workspace.id, id, actor);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Control change or workspace control not found");
      return conflict("Control change must be implemented before it can be rolled back");
    }

    return NextResponse.json({ change: result.change, control: result.control });
  } catch (error) {
    return serverError("Control change rollback error", error);
  }
});
