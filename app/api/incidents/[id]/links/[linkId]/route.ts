import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { deleteIncidentLink, isFinalIncidentStatus } from "@/lib/repo/incidents";
import { ACTOR, conflict, isUuid, notFound, requireIncident, requireIncidentLink, serverError } from "@/lib/incidents/helpers";

interface RouteContext {
  params: Promise<{ id: string; linkId: string }>;
}

/** DELETE /api/incidents/[id]/links/[linkId] */
export const DELETE = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id, linkId } = await context.params;
    if (!isUuid(id) || !isUuid(linkId)) return notFound("Incident or link not found");
    const incident = await requireIncident(workspace.id, id);
    if (!incident) return notFound("Incident not found");
    if (isFinalIncidentStatus(incident.status)) return conflict("Cannot remove links on an incident that is already closed or cancelled");

    const link = await requireIncidentLink(workspace.id, id, linkId);
    if (!link) return notFound("Link not found");

    await deleteIncidentLink(workspace.id, linkId, ACTOR);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError("Incident link delete error", error);
  }
});
