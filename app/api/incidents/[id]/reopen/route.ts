import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { reopenIncident } from "@/lib/repo/incidents";
import { ACTOR, conflict, isUuid, notFound, requireIncident, serverError } from "@/lib/incidents/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** POST /api/incidents/[id]/reopen - moves a closed incident back to 'investigating'. 409 if the incident is not currently closed (including cancelled, which stays a dead record). */
export const POST = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Incident not found");
    const incident = await requireIncident(workspace.id, id);
    if (!incident) return notFound("Incident not found");

    const result = await reopenIncident(workspace.id, id, ACTOR);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Incident not found");
      return conflict("Incident is not currently closed");
    }

    return NextResponse.json({ incident: result.incident });
  } catch (error) {
    return serverError("Incident reopen error", error);
  }
});
