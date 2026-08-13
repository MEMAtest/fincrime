import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createIncidentLink, isFinalIncidentStatus, listIncidentLinks } from "@/lib/repo/incidents";
import { badRequest,
  checkLinkTarget,
  conflict,
  isIncidentLinkType,
  isUuid,
  isWorkspaceOwnedLinkType,
  notFound,
  requireIncident,
  serverError,
} from "@/lib/incidents/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/incidents/[id]/links - links recorded against this incident (unresolved; see GET /api/incidents/[id] for resolved display labels). */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Incident not found");
    const incident = await requireIncident(workspace.id, id);
    if (!incident) return notFound("Incident not found");

    const links = await listIncidentLinks(workspace.id, id);
    return NextResponse.json({ links });
  } catch (error) {
    return serverError("Incident links list error", error);
  }
});

/**
 * POST /api/incidents/[id]/links - body {linkType, targetId?, targetRef?,
 * note?}. Exactly one of targetId/targetRef must resolve to a real object:
 * workspace-owned link types (failed_control, control_change, control_test,
 * pra_assessment) via targetId, verified against THIS workspace so a link to
 * another workspace's row 400s rather than silently attaching; enforcement_case
 * via targetRef, verified against the static case dataset. Duplicate links
 * (same incident + linkType + target) 409 rather than silently creating a
 * second row, since the DB unique constraint would otherwise surface as a
 * raw 500.
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context, actor) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Incident not found");
    const incident = await requireIncident(workspace.id, id);
    if (!incident) return notFound("Incident not found");
    if (isFinalIncidentStatus(incident.status)) return conflict("Cannot add links to an incident that is already closed or cancelled");

    const body = await request.json();

    if (!isIncidentLinkType(body?.linkType)) {
      return badRequest("Invalid linkType: must be failed_control, control_change, control_test, pra_assessment, or enforcement_case");
    }
    const linkType = body.linkType;

    let targetId: string | null = null;
    if (body?.targetId !== undefined && body.targetId !== null) {
      if (!isUuid(body.targetId)) return badRequest("targetId must be a valid UUID");
      targetId = body.targetId;
    }

    let targetRef: string | null = null;
    if (body?.targetRef !== undefined && body.targetRef !== null) {
      targetRef = typeof body.targetRef === "string" && body.targetRef.trim() ? body.targetRef.trim() : null;
      if (body.targetRef !== null && !targetRef) return badRequest("targetRef must be a non-empty string");
    }

    if (!targetId && !targetRef) {
      return badRequest("Either targetId or targetRef is required");
    }

    // A field supplied on the wrong axis must be rejected outright rather
    // than silently stored: the unique index on incident_links keys on
    // COALESCE(target_ref, ''), so a workspace-owned link (keyed by
    // targetId) with a differing, unvalidated targetRef would produce a
    // distinct index key for what is really the same duplicate link -
    // letting the same failed_control (or control_change/control_test/
    // pra_assessment) be linked to an incident more than once, and the PDF
    // print the same row repeatedly. The mirror case applies to
    // enforcement_case, which is keyed by targetRef and never checks
    // targetId at all.
    if (isWorkspaceOwnedLinkType(linkType) && targetRef !== null) {
      return badRequest(`${linkType} links are keyed by targetId; targetRef must not be supplied`);
    }
    if (linkType === "enforcement_case" && targetId !== null) {
      return badRequest("enforcement_case links are keyed by targetRef; targetId must not be supplied");
    }

    const check = await checkLinkTarget(workspace.id, linkType, targetId, targetRef);
    if (!check.ok) return badRequest(check.error);

    const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim() : null;

    let link;
    try {
      link = await createIncidentLink(workspace.id, id, { linkType, targetId, targetRef, note }, actor);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return conflict("This link already exists on the incident");
      }
      throw error;
    }

    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    return serverError("Incident link create error", error);
  }
});

/** Postgres unique_violation (23505) - the shape node-postgres throws for it, not exported as a type by `pg`. */
function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "23505";
}
