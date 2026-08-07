import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { applyControlChange } from "@/lib/repo/control-changes";
import { ACTOR, conflict, notFound, requireControlChange, serverError } from "@/lib/control-changes/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/control-changes/[id]/implement - runs applyControlChange: writes
 * the change's `proposed` values onto the underlying workspace_control (via
 * updateWorkspaceControl, so it version-bumps and snapshots), stamps
 * implemented_at / applied_version, and moves status to 'implemented'.
 * 409 if the change is not currently 'approved'.
 */
export const POST = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    const change = await requireControlChange(workspace.id, id);
    if (!change) return notFound("Control change not found");

    const result = await applyControlChange(workspace.id, id, ACTOR);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Control change or workspace control not found");
      return conflict("Control change must be approved before it can be implemented");
    }

    return NextResponse.json({ change: result.change, control: result.control });
  } catch (error) {
    return serverError("Control change implement error", error);
  }
});
