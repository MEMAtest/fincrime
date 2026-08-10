import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createEvidence, listEvidenceBySubject } from "@/lib/repo/evidence";
import { isFinalIncidentStatus } from "@/lib/repo/incidents";
import { requirePerson } from "@/lib/pra/helpers";
import {
  ACTOR,
  SUBJECT_TYPE,
  badRequest,
  conflict,
  isIsoDate,
  isUuid,
  notFound,
  requireIncident,
  serverError,
} from "@/lib/incidents/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/incidents/[id]/evidence - evidence records attached to this incident. */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Incident not found");
    const incident = await requireIncident(workspace.id, id);
    if (!incident) return notFound("Incident not found");

    const evidence = await listEvidenceBySubject(workspace.id, SUBJECT_TYPE, id);
    return NextResponse.json({ evidence });
  } catch (error) {
    return serverError("Incident evidence list error", error);
  }
});

/**
 * POST /api/incidents/[id]/evidence - body {type, title, description?,
 * linkUrl?, evidenceDate?, addedByPersonId?}. Creates an evidence row
 * against this incident (subject_type 'incident'). An incident that is
 * already closed or cancelled is a historical record and 409s, matching the
 * control-tests evidence route.
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Incident not found");
    const incident = await requireIncident(workspace.id, id);
    if (!incident) return notFound("Incident not found");
    if (isFinalIncidentStatus(incident.status)) return conflict("Cannot add evidence to an incident that is already closed or cancelled");

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

    const evidence = await createEvidence(
      workspace.id,
      { subjectType: SUBJECT_TYPE, subjectId: id, type, title, description, linkUrl, evidenceDate, addedByPersonId },
      ACTOR
    );

    return NextResponse.json({ evidence }, { status: 201 });
  } catch (error) {
    return serverError("Incident evidence create error", error);
  }
});
