import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { deleteAction, getAction, updateAction } from "@/lib/repo/actions";
import { requirePerson } from "@/lib/pra/helpers";
import { validateUpdateActionInput } from "@/lib/workspace/action-input";
import { ACTOR, badRequest, notFound, serverError } from "@/lib/workspace/http";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/workspace/actions/[id] - the endpoint that closes the gap the
 * workspace home's "Overdue Actions" list previously dead-ended into: an
 * action created by a decision (or the monitoring plan) can now be
 * reassigned, re-dated, re-prioritised, or moved through
 * open -> in_progress -> done/cancelled.
 */
export const PATCH = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id } = await context.params;
    const existing = await getAction(workspace.id, id);
    if (!existing) return notFound("Action not found");

    const body = await request.json().catch(() => null);
    const result = validateUpdateActionInput(body);
    if (!result.ok) return badRequest(result.error);
    const patch = result.value;

    if (patch.ownerPersonId) {
      const owner = await requirePerson(workspace.id, patch.ownerPersonId);
      if (!owner) return badRequest("Unknown ownerPersonId for this workspace");
    }

    const updated = await updateAction(workspace.id, id, patch, ACTOR);
    if (!updated) return notFound("Action not found");

    return NextResponse.json({ action: updated });
  } catch (error) {
    return serverError("Workspace action update error", error);
  }
});

/** DELETE /api/workspace/actions/[id] */
export const DELETE = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    const existing = await getAction(workspace.id, id);
    if (!existing) return notFound("Action not found");

    await deleteAction(workspace.id, id, ACTOR);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError("Workspace action delete error", error);
  }
});
