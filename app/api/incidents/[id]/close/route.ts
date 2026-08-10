import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { closeIncident } from "@/lib/repo/incidents";
import { ACTOR, conflict, isUuid, notFound, requireIncident, serverError } from "@/lib/incidents/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/incidents/[id]/close - closes the incident inside a single
 * transaction (see closeIncident in lib/repo/incidents.ts for the full
 * guard). 409 with a specific reason: already closed/cancelled, an open
 * remediation action still attached, or no root cause recorded.
 */
export const POST = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Incident not found");
    const incident = await requireIncident(workspace.id, id);
    if (!incident) return notFound("Incident not found");

    const result = await closeIncident(workspace.id, id, ACTOR);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Incident not found");
      if (result.reason === "open_actions") {
        return conflict("Cannot close an incident with open remediation actions attached");
      }
      if (result.reason === "no_root_cause") {
        return conflict("Cannot close an incident with no root cause recorded");
      }
      return conflict("Incident is already closed or cancelled");
    }

    return NextResponse.json({ incident: result.incident });
  } catch (error) {
    return serverError("Incident close error", error);
  }
});
