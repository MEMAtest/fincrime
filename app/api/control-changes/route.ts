import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createControlChange, listControlChanges } from "@/lib/repo/control-changes";
import { listWorkspaceControls } from "@/lib/repo/controls";
import { badRequest, isControlChangeType, serverError } from "@/lib/control-changes/helpers";

/**
 * GET /api/control-changes - list the workspace's control changes, one row
 * per change with the underlying control's name resolved for display.
 */
export const GET = withWorkspace(async (_request, workspace) => {
  try {
    const [changes, controls] = await Promise.all([
      listControlChanges(workspace.id),
      listWorkspaceControls(workspace.id),
    ]);
    const controlById = new Map(controls.map((c) => [c.id, c]));

    const items = changes.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      currentStep: c.current_step,
      changeType: c.change_type,
      controlName: controlById.get(c.workspace_control_id)?.name ?? "Unknown control",
      updatedAt: c.updated_at,
    }));

    return NextResponse.json({ changes: items });
  } catch (error) {
    return serverError("Control changes list error", error);
  }
});

/**
 * POST /api/control-changes - body {workspaceControlId, title, rationale?,
 * changeType?}. Snapshots the control's CURRENT whitelisted field values
 * into `baseline` at creation time (the "current version" side of the
 * before/after comparison) and returns the new row.
 */
export const POST = withWorkspace(async (request, workspace, _context, actor) => {
  try {
    const body = await request.json();

    const workspaceControlId = typeof body?.workspaceControlId === "string" ? body.workspaceControlId : "";
    if (!workspaceControlId) return badRequest("Missing required field: workspaceControlId");

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return badRequest("Missing required field: title");

    const rationale = typeof body?.rationale === "string" && body.rationale.trim() ? body.rationale.trim() : null;

    let changeType = null;
    if (body?.changeType !== undefined && body.changeType !== null) {
      if (!isControlChangeType(body.changeType)) {
        return badRequest(
          "Invalid changeType: must be threshold, rule_logic, scope, ownership, frequency, system, decommission, or other"
        );
      }
      changeType = body.changeType;
    }

    const change = await createControlChange(workspace.id, { workspaceControlId, title, rationale, changeType }, actor);
    if (!change) return badRequest("Unknown workspaceControlId for this workspace");

    return NextResponse.json({ change }, { status: 201 });
  } catch (error) {
    return serverError("Control change create error", error);
  }
});
