import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { deleteAction, getAction, updateAction } from "@/lib/repo/actions";
import { requirePerson } from "@/lib/pra/helpers";
import { getRegCommitment, updateRegCommitment, REG_COMMITMENT_SUBJECT_TYPE, isTerminalCommitmentStatus } from "@/lib/repo/reg-requests";
import { isUuid, validateUpdateActionInput } from "@/lib/workspace/action-input";
import { assertSubjectMutable } from "@/lib/workspace/subject-mutability";
import { ACTOR, badRequest, conflict, notFound, serverError } from "@/lib/workspace/http";

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
    if (!isUuid(id)) return notFound("Action not found");
    const existing = await getAction(workspace.id, id);
    if (!existing) return notFound("Action not found");

    const mutability = await assertSubjectMutable(workspace.id, existing.subject_type, existing.subject_id);
    if (!mutability.ok) {
      return conflict("Cannot modify an action whose subject is closed, complete, or implemented");
    }

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

    // Mirror: closing a commitment's tracked action from this generic side
    // door must not leave the commitment itself still 'open'/'in_progress'
    // (which would keep it blocking closeRequest and keep showing on the
    // workspace home) - route the mirror through updateRegCommitment so the
    // met/action-sync logic lives in exactly one place.
    if (updated.status === "done" && existing.subject_type === REG_COMMITMENT_SUBJECT_TYPE) {
      const commitment = await getRegCommitment(workspace.id, existing.subject_id);
      if (commitment && !isTerminalCommitmentStatus(commitment.status)) {
        await updateRegCommitment(workspace.id, commitment.request_id, commitment.id, { status: "met" }, ACTOR);
      }
    }

    return NextResponse.json({ action: updated });
  } catch (error) {
    return serverError("Workspace action update error", error);
  }
});

/**
 * DELETE /api/workspace/actions/[id] - refuses (subject_immutable) to
 * delete the tracked action of a reg_commitment that still has a due date:
 * the FK is ON DELETE SET NULL, so deleting straight through here would
 * silently leave the commitment open with action_id cleared - indistinguishable
 * from a commitment that never had a date, and no longer live overdue work
 * anywhere. Withdraw or mark the commitment missed/withdrawn instead, which
 * closes the action itself (see updateRegCommitment).
 */
export const DELETE = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Action not found");
    const existing = await getAction(workspace.id, id);
    if (!existing) return notFound("Action not found");

    const mutability = await assertSubjectMutable(workspace.id, existing.subject_type, existing.subject_id);
    if (!mutability.ok) {
      return conflict("Cannot modify an action whose subject is closed, complete, or implemented");
    }

    if (existing.subject_type === REG_COMMITMENT_SUBJECT_TYPE) {
      const commitment = await getRegCommitment(workspace.id, existing.subject_id);
      if (commitment && commitment.due_date) {
        return conflict("Cannot delete the tracked action of a commitment that still has a due date - update the commitment instead");
      }
    }

    await deleteAction(workspace.id, id, ACTOR);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError("Workspace action delete error", error);
  }
});
