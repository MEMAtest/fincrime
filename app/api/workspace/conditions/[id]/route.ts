import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { getCondition, updateCondition } from "@/lib/repo/decisions";
import { requirePerson } from "@/lib/pra/helpers";
import { validateUpdateConditionInput } from "@/lib/workspace/action-input";
import { badRequest, notFound, serverError } from "@/lib/workspace/http";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/workspace/conditions/[id] - lets an approver mark a condition
 * attached to a decision as met or breached (or edit its description, due
 * date, owner). Previously conditions could only be created alongside a
 * decision and never touched again, which is what made the workspace home's
 * "Overdue Conditions" list read-only.
 */
export const PATCH = withWorkspace<RouteContext>(async (request, workspace, context, actor) => {
  try {
    const { id } = await context.params;
    // A non-UUID id would raise 22P02 in Postgres and surface as a 500.
    if (!UUID_RE.test(id)) return notFound("Condition not found");
    const existing = await getCondition(workspace.id, id);
    if (!existing) return notFound("Condition not found");

    const body = await request.json().catch(() => null);
    const result = validateUpdateConditionInput(body);
    if (!result.ok) return badRequest(result.error);
    const patch = result.value;

    if (patch.ownerPersonId) {
      const owner = await requirePerson(workspace.id, patch.ownerPersonId);
      if (!owner) return badRequest("Unknown ownerPersonId for this workspace");
    }

    const updated = await updateCondition(workspace.id, id, patch, actor);
    if (!updated) return notFound("Condition not found");

    return NextResponse.json({ condition: updated });
  } catch (error) {
    return serverError("Workspace condition update error", error);
  }
});
