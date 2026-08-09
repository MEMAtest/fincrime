import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createAction, listActions, listActionsBySubject } from "@/lib/repo/actions";
import { requirePerson } from "@/lib/pra/helpers";
import { isActionStatus, isActionSubjectType, isUuid, validateCreateActionInput } from "@/lib/workspace/action-input";
import { ACTOR, badRequest, serverError } from "@/lib/workspace/http";

/**
 * GET /api/workspace/actions - list actions across the workspace.
 * Optional filters: ?status=open|in_progress|done|cancelled and/or
 * ?subjectType=&subjectId= (both required together to scope to one subject).
 */
export const GET = withWorkspace(async (request, workspace) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const subjectType = searchParams.get("subjectType");
    const subjectId = searchParams.get("subjectId");

    if (status !== null && !isActionStatus(status)) {
      return badRequest("Invalid status: must be open, in_progress, done, or cancelled");
    }

    if (subjectType !== null || subjectId !== null) {
      if (!subjectType || !subjectId) {
        return badRequest("subjectType and subjectId must both be provided to filter by subject");
      }
      if (!isActionSubjectType(subjectType)) {
        return badRequest("Invalid subjectType");
      }
      if (!isUuid(subjectId)) {
        return badRequest("subjectId must be a valid UUID");
      }
      const actions = await listActionsBySubject(workspace.id, subjectType, subjectId);
      const filtered = status ? actions.filter((a) => a.status === status) : actions;
      return NextResponse.json({ actions: filtered });
    }

    const actions = await listActions(workspace.id, status ?? undefined);
    return NextResponse.json({ actions });
  } catch (error) {
    return serverError("Workspace actions list error", error);
  }
});

/**
 * POST /api/workspace/actions - creates a standalone trackable action against
 * any subject (a PRA assessment, a control change, a workspace control, or a
 * monitoring-plan row). This is the generic endpoint the Control Change
 * Lab's monitoring step, and any future caller, uses instead of only writing
 * to JSONB.
 */
export const POST = withWorkspace(async (request, workspace) => {
  try {
    const body = await request.json().catch(() => null);
    const result = validateCreateActionInput(body);
    if (!result.ok) return badRequest(result.error);
    const input = result.value;

    if (input.ownerPersonId) {
      const owner = await requirePerson(workspace.id, input.ownerPersonId);
      if (!owner) return badRequest("Unknown ownerPersonId for this workspace");
    }

    const action = await createAction(
      workspace.id,
      {
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        title: input.title,
        ownerPersonId: input.ownerPersonId,
        dueDate: input.dueDate,
        priority: input.priority,
        status: input.status,
      },
      ACTOR
    );

    return NextResponse.json({ action }, { status: 201 });
  } catch (error) {
    return serverError("Workspace action create error", error);
  }
});
