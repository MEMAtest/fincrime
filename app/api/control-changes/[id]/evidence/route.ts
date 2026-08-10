import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createEvidence, listEvidenceBySubject } from "@/lib/repo/evidence";
import { requirePerson } from "@/lib/pra/helpers";
import { ACTOR, SUBJECT_TYPE, badRequest, isUuid, notFound, requireControlChange, serverError } from "@/lib/control-changes/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/control-changes/[id]/evidence - evidence records attached to this change. */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Control change not found");
    const change = await requireControlChange(workspace.id, id);
    if (!change) return notFound("Control change not found");

    const evidence = await listEvidenceBySubject(workspace.id, SUBJECT_TYPE, id);
    return NextResponse.json({ evidence });
  } catch (error) {
    return serverError("Control change evidence list error", error);
  }
});

/**
 * POST /api/control-changes/[id]/evidence - body {type, title, description?,
 * linkUrl?, evidenceDate?, addedByPersonId?}. Creates an evidence row against
 * this change (subject_type 'control_change').
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Control change not found");
    const change = await requireControlChange(workspace.id, id);
    if (!change) return notFound("Control change not found");

    const body = await request.json();

    const type = typeof body?.type === "string" ? body.type.trim() : "";
    if (!type) return badRequest("Missing required field: type");

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return badRequest("Missing required field: title");

    const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;
    const linkUrl = typeof body?.linkUrl === "string" && body.linkUrl.trim() ? body.linkUrl.trim() : null;
    const evidenceDate = typeof body?.evidenceDate === "string" && body.evidenceDate ? body.evidenceDate : null;

    let addedByPersonId: string | null = null;
    if (body?.addedByPersonId !== undefined && body.addedByPersonId !== null) {
      if (typeof body.addedByPersonId !== "string") return badRequest("Invalid addedByPersonId");
      const person = await requirePerson(workspace.id, body.addedByPersonId);
      if (!person) return badRequest("Unknown addedByPersonId for this workspace");
      addedByPersonId = person.id;
    }

    const evidence = await createEvidence(
      workspace.id,
      { subjectType: SUBJECT_TYPE, subjectId: id, type, title, description, linkUrl, evidenceDate, addedByPersonId },
      ACTOR
    );

    return NextResponse.json({ evidence }, { status: 201 });
  } catch (error) {
    return serverError("Control change evidence create error", error);
  }
});
