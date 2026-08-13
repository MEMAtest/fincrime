import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { closeIncident } from "@/lib/repo/incidents";
import { isUuid, notFound, requireIncident, serverError } from "@/lib/incidents/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Machine-readable reason a close failed, alongside the human-readable `error` message. Read `reason`, not the message text - the message is prose and free to change. */
function closeConflict(message: string, reason: "already_final" | "open_actions" | "no_root_cause"): NextResponse {
  return NextResponse.json({ error: message, reason }, { status: 409 });
}

/**
 * POST /api/incidents/[id]/close - closes the incident inside a single
 * transaction (see closeIncident in lib/repo/incidents.ts for the full
 * guard). 409 with a specific machine-readable `reason` (in addition to the
 * human-readable `error` message): already closed/cancelled, an open
 * remediation action still attached, or no root cause recorded.
 */
export const POST = withWorkspace<RouteContext>(async (_request, workspace, context, actor) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Incident not found");
    const incident = await requireIncident(workspace.id, id);
    if (!incident) return notFound("Incident not found");

    const result = await closeIncident(workspace.id, id, actor);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Incident not found");
      if (result.reason === "open_actions") {
        return closeConflict("Cannot close an incident with open remediation actions attached", "open_actions");
      }
      if (result.reason === "no_root_cause") {
        return closeConflict("Cannot close an incident with no root cause recorded", "no_root_cause");
      }
      return closeConflict("Incident is already closed or cancelled", "already_final");
    }

    return NextResponse.json({ incident: result.incident });
  } catch (error) {
    return serverError("Incident close error", error);
  }
});
