import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { deleteRegCommitment, updateRegCommitment, type UpdateRegCommitmentInput } from "@/lib/repo/reg-requests";
import { badRequest,
  conflict,
  isIsoDate,
  isNotFutureIsoDate,
  isRegCommitmentStatus,
  isUuid,
  notFound,
  requirePerson,
  requireRegCommitment,
  requireRegRequest,
  serverError,
} from "@/lib/reg-response/helpers";

interface RouteContext {
  params: Promise<{ id: string; commitmentId: string }>;
}

/**
 * PATCH /api/reg-requests/[id]/commitments/[commitmentId] - body
 * {description?, dueDate?, ownerPersonId?, status?, note?, metAt?}. A
 * status transition into 'met' closes the linked action in the same
 * transaction (see updateRegCommitment).
 */
export const PATCH = withWorkspace<RouteContext>(async (request, workspace, context, actor) => {
  try {
    const { id, commitmentId } = await context.params;
    if (!isUuid(id) || !isUuid(commitmentId)) return notFound("Reg commitment not found");
    const reqRow = await requireRegRequest(workspace.id, id);
    if (!reqRow) return notFound("Reg request not found");
    const commitment = await requireRegCommitment(workspace.id, id, commitmentId);
    if (!commitment) return notFound("Reg commitment not found");

    const body = await request.json().catch(() => null);

    const patch: UpdateRegCommitmentInput = {};

    if (body?.description !== undefined) {
      const description = typeof body.description === "string" ? body.description.trim() : "";
      if (!description) return badRequest("description must be a non-empty string");
      patch.description = description;
    }

    if (body?.dueDate !== undefined) {
      if (body.dueDate !== null && !isIsoDate(body.dueDate)) return badRequest("Invalid dueDate: must be an ISO date (YYYY-MM-DD) or null");
      patch.dueDate = body.dueDate;
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

    if (body?.status !== undefined) {
      if (!isRegCommitmentStatus(body.status)) return badRequest("Invalid status: must be open, in_progress, met, missed, or withdrawn");
      patch.status = body.status;
    }

    if (body?.note !== undefined) {
      patch.note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
    }

    if (body?.metAt !== undefined) {
      if (body.metAt !== null && !isIsoDate(body.metAt)) return badRequest("Invalid metAt: must be an ISO date (YYYY-MM-DD) or null");
      if (body.metAt !== null && !isNotFutureIsoDate(body.metAt)) return badRequest("Invalid metAt: cannot be in the future");
      patch.metAt = body.metAt;
    }

    const result = await updateRegCommitment(workspace.id, id, commitmentId, patch, actor);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Reg request not found");
      if (result.reason === "commitment_not_found") return notFound("Reg commitment not found");
      return conflict("Cannot update a commitment on a reg request that is already closed or cancelled");
    }

    return NextResponse.json({ commitment: result.commitment });
  } catch (error) {
    return serverError("Reg commitment update error", error);
  }
});

/** DELETE /api/reg-requests/[id]/commitments/[commitmentId] */
export const DELETE = withWorkspace<RouteContext>(async (_request, workspace, context, actor) => {
  try {
    const { id, commitmentId } = await context.params;
    if (!isUuid(id) || !isUuid(commitmentId)) return notFound("Reg commitment not found");
    const reqRow = await requireRegRequest(workspace.id, id);
    if (!reqRow) return notFound("Reg request not found");
    const commitment = await requireRegCommitment(workspace.id, id, commitmentId);
    if (!commitment) return notFound("Reg commitment not found");

    const result = await deleteRegCommitment(workspace.id, id, commitmentId, actor);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Reg request not found");
      if (result.reason === "commitment_not_found") return notFound("Reg commitment not found");
      return conflict("Cannot delete a commitment on a reg request that is already closed or cancelled");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError("Reg commitment delete error", error);
  }
});
