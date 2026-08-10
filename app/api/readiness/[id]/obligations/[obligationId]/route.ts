import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { updateReadinessObligation, type UpdateReadinessObligationInput } from "@/lib/repo/readiness";
import {
  ACTOR,
  badRequest,
  conflict,
  isIsoDate,
  isReadinessGap,
  isUuid,
  notFound,
  requirePerson,
  requireReadinessAssessment,
  requireReadinessObligation,
  requireWorkspaceControl,
  serverError,
} from "@/lib/readiness/helpers";

interface RouteContext {
  params: Promise<{ id: string; obligationId: string }>;
}

/**
 * PATCH /api/readiness/[id]/obligations/[obligationId] - body
 * {workspaceControlId?, controlNote?, gap?, blocker?, ownerPersonId?,
 * dueDate?, notes?}. workspaceControlId must resolve to a control in THIS
 * workspace. Refuses once the parent assessment is final.
 */
export const PATCH = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id, obligationId } = await context.params;
    if (!isUuid(id) || !isUuid(obligationId)) return notFound("Readiness obligation not found");
    const assessment = await requireReadinessAssessment(workspace.id, id);
    if (!assessment) return notFound("Readiness assessment not found");
    const obligation = await requireReadinessObligation(workspace.id, id, obligationId);
    if (!obligation) return notFound("Readiness obligation not found");

    const body = await request.json();
    const patch: UpdateReadinessObligationInput = {};

    if (body?.workspaceControlId !== undefined) {
      if (body.workspaceControlId === null) {
        patch.workspaceControlId = null;
      } else {
        if (!isUuid(body.workspaceControlId)) return badRequest("workspaceControlId must be a valid UUID or null");
        const control = await requireWorkspaceControl(workspace.id, body.workspaceControlId);
        if (!control) return badRequest("Unknown workspaceControlId for this workspace");
        patch.workspaceControlId = control.id;
      }
    }

    if (body?.controlNote !== undefined) {
      patch.controlNote = typeof body.controlNote === "string" && body.controlNote.trim() ? body.controlNote.trim() : null;
    }

    if (body?.gap !== undefined) {
      if (!isReadinessGap(body.gap)) return badRequest("Invalid gap: must be not_assessed, none, partial, or full");
      patch.gap = body.gap;
    }

    if (body?.blocker !== undefined) {
      if (typeof body.blocker !== "boolean") return badRequest("blocker must be a boolean");
      patch.blocker = body.blocker;
    }

    if (body?.ownerPersonId !== undefined) {
      if (body.ownerPersonId === null) {
        patch.ownerPersonId = null;
      } else {
        if (!isUuid(body.ownerPersonId)) return badRequest("ownerPersonId must be a valid UUID or null");
        const person = await requirePerson(workspace.id, body.ownerPersonId);
        if (!person) return badRequest("Unknown ownerPersonId for this workspace");
        patch.ownerPersonId = person.id;
      }
    }

    if (body?.dueDate !== undefined) {
      if (body.dueDate !== null && !isIsoDate(body.dueDate)) {
        return badRequest("Invalid dueDate: must be an ISO date (YYYY-MM-DD) or null");
      }
      patch.dueDate = body.dueDate;
    }

    if (body?.notes !== undefined) {
      patch.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
    }

    const result = await updateReadinessObligation(workspace.id, id, obligationId, patch, ACTOR);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Readiness obligation not found");
      return conflict("Cannot update an obligation on an assessment that is already approved_global, rejected, or cancelled");
    }

    return NextResponse.json({ obligation: result.obligation });
  } catch (error) {
    return serverError("Readiness obligation update error", error);
  }
});
