import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createAction, listActionsBySubject, type ActionPriority } from "@/lib/repo/actions";
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

const VALID_PRIORITIES: ActionPriority[] = ["high", "medium", "low"];
function isActionPriority(value: unknown): value is ActionPriority {
  return typeof value === "string" && (VALID_PRIORITIES as string[]).includes(value);
}

/**
 * GET/POST /api/incidents/[id]/actions - a scoped convenience wrapper around
 * the actions repo for the incident journey (title, ownerPersonId?, dueDate?,
 * priority?), creating with subjectType 'incident'. A generic actions API
 * already exists at /api/workspace/actions; this route is kept because the
 * incident PATCH-then-close flow reads more naturally scoped to the incident,
 * matching the equivalent findings-spawned-action pattern in control-tests.
 */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Incident not found");
    const incident = await requireIncident(workspace.id, id);
    if (!incident) return notFound("Incident not found");

    const actions = await listActionsBySubject(workspace.id, SUBJECT_TYPE, id);
    return NextResponse.json({ actions });
  } catch (error) {
    return serverError("Incident actions list error", error);
  }
});

export const POST = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Incident not found");
    const incident = await requireIncident(workspace.id, id);
    if (!incident) return notFound("Incident not found");
    if (isFinalIncidentStatus(incident.status)) return conflict("Cannot add actions to an incident that is already closed or cancelled");

    const body = await request.json();

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return badRequest("Missing required field: title");

    let ownerPersonId: string | null = null;
    if (body?.ownerPersonId !== undefined && body.ownerPersonId !== null) {
      if (!isUuid(body.ownerPersonId)) return badRequest("ownerPersonId must be a valid UUID");
      const person = await requirePerson(workspace.id, body.ownerPersonId);
      if (!person) return badRequest("Unknown ownerPersonId for this workspace");
      ownerPersonId = person.id;
    }

    let dueDate: string | null = null;
    if (body?.dueDate !== undefined && body.dueDate !== null) {
      if (!isIsoDate(body.dueDate)) return badRequest("Invalid dueDate: must be an ISO date (YYYY-MM-DD)");
      dueDate = body.dueDate;
    }

    let priority: ActionPriority = "medium";
    if (body?.priority !== undefined) {
      if (!isActionPriority(body.priority)) return badRequest("Invalid priority: must be high, medium, or low");
      priority = body.priority;
    }

    const action = await createAction(
      workspace.id,
      { subjectType: SUBJECT_TYPE, subjectId: id, title, ownerPersonId, dueDate, priority },
      ACTOR
    );

    return NextResponse.json({ action }, { status: 201 });
  } catch (error) {
    return serverError("Incident action create error", error);
  }
});
