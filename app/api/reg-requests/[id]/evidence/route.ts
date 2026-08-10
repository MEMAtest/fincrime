import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createEvidence, listEvidenceBySubject } from "@/lib/repo/evidence";
import { withRegRequestLock, REG_REQUEST_SUBJECT_TYPE } from "@/lib/repo/reg-requests";
import { ACTOR, badRequest, conflict, isIsoDate, isUuid, notFound, requirePerson, requireRegRequest, serverError } from "@/lib/reg-response/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/reg-requests/[id]/evidence - evidence records attached to this request as a whole. */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Reg request not found");
    const reqRow = await requireRegRequest(workspace.id, id);
    if (!reqRow) return notFound("Reg request not found");

    const evidence = await listEvidenceBySubject(workspace.id, REG_REQUEST_SUBJECT_TYPE, id);
    return NextResponse.json({ evidence });
  } catch (error) {
    return serverError("Reg request evidence list error", error);
  }
});

/**
 * POST /api/reg-requests/[id]/evidence - body {type, title, description?,
 * linkUrl?, evidenceDate?, addedByPersonId?}. Locks the request row (SELECT
 * ... FOR UPDATE) and re-checks its status is non-final in the SAME
 * transaction as the evidence insert, so a concurrent approve/close/reject
 * cannot flip the request to final in the window between the check and the
 * write.
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Reg request not found");
    const existing = await requireRegRequest(workspace.id, id);
    if (!existing) return notFound("Reg request not found");

    const body = await request.json();

    const type = typeof body?.type === "string" ? body.type.trim() : "";
    if (!type) return badRequest("Missing required field: type");

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return badRequest("Missing required field: title");

    const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;
    const linkUrl = typeof body?.linkUrl === "string" && body.linkUrl.trim() ? body.linkUrl.trim() : null;

    let evidenceDate: string | null = null;
    if (body?.evidenceDate !== undefined && body.evidenceDate !== null) {
      if (!isIsoDate(body.evidenceDate)) return badRequest("Invalid evidenceDate: must be an ISO date (YYYY-MM-DD)");
      evidenceDate = body.evidenceDate;
    }

    let addedByPersonId: string | null = null;
    if (body?.addedByPersonId !== undefined && body.addedByPersonId !== null) {
      if (!isUuid(body.addedByPersonId)) return badRequest("Invalid addedByPersonId: must be a valid UUID");
      const person = await requirePerson(workspace.id, body.addedByPersonId);
      if (!person) return badRequest("Unknown addedByPersonId for this workspace");
      addedByPersonId = person.id;
    }

    const locked = await withRegRequestLock(workspace.id, id, async (client) =>
      createEvidence(
        workspace.id,
        { subjectType: REG_REQUEST_SUBJECT_TYPE, subjectId: id, type, title, description, linkUrl, evidenceDate, addedByPersonId },
        ACTOR,
        client
      )
    );
    if (!locked.ok) {
      if (locked.reason === "not_found") return notFound("Reg request not found");
      return conflict("Cannot add evidence to a reg request that is already closed or cancelled");
    }

    return NextResponse.json({ evidence: locked.result }, { status: 201 });
  } catch (error) {
    return serverError("Reg request evidence create error", error);
  }
});
