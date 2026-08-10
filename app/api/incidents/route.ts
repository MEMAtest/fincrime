import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createIncident, listIncidents } from "@/lib/repo/incidents";
import { countOpenActionsBySubjectType } from "@/lib/repo/actions";
import { listPeople } from "@/lib/repo/people";
import { requirePerson } from "@/lib/pra/helpers";
import {
  ACTOR,
  SUBJECT_TYPE,
  badRequest,
  isIncidentSeverity,
  isIncidentSource,
  isIncidentStatus,
  isIsoTimestamp,
  isUuid,
  serverError,
  toEpochMillis,
} from "@/lib/incidents/helpers";

/**
 * GET /api/incidents - list the workspace's incidents, most recent first.
 * Optional ?status= and ?severity= filters, each validated against the
 * enum (an unknown value 400s rather than silently returning everything).
 */
export const GET = withWorkspace(async (request, workspace) => {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const severityParam = searchParams.get("severity");

    if (statusParam !== null && !isIncidentStatus(statusParam)) {
      return badRequest("Invalid status filter");
    }
    if (severityParam !== null && !isIncidentSeverity(severityParam)) {
      return badRequest("Invalid severity filter");
    }

    const [incidents, people, openActionsByIncident] = await Promise.all([
      listIncidents(workspace.id, {
        status: statusParam ?? undefined,
        severity: severityParam ?? undefined,
      }),
      listPeople(workspace.id),
      countOpenActionsBySubjectType(workspace.id, SUBJECT_TYPE),
    ]);
    const nameByPersonId = new Map(people.map((p) => [p.id, p.name]));

    const items = incidents.map((incident) => ({
      id: incident.id,
      reference: incident.reference,
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      ownerName: incident.owner_person_id ? nameByPersonId.get(incident.owner_person_id) ?? null : null,
      detectedAt: incident.detected_at,
      openActions: openActionsByIncident[incident.id] ?? 0,
      updatedAt: incident.updated_at,
    }));

    return NextResponse.json({ incidents: items });
  } catch (error) {
    return serverError("Incidents list error", error);
  }
});

/**
 * POST /api/incidents - body {title, source?, severity?, occurredAt?,
 * detectedAt?, summary?, ownerPersonId?}.
 */
export const POST = withWorkspace(async (request, workspace) => {
  try {
    const body = await request.json();

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return badRequest("Missing required field: title");

    let source = null;
    if (body?.source !== undefined && body.source !== null) {
      if (!isIncidentSource(body.source)) {
        return badRequest(
          "Invalid source: must be internal_detection, customer_complaint, regulator, third_party, audit, control_test, or other"
        );
      }
      source = body.source;
    }

    let severity: "low" | "medium" | "high" | "critical" | undefined;
    if (body?.severity !== undefined) {
      if (!isIncidentSeverity(body.severity)) {
        return badRequest("Invalid severity: must be low, medium, high, or critical");
      }
      severity = body.severity;
    }

    let occurredAt: string | null = null;
    if (body?.occurredAt !== undefined && body.occurredAt !== null) {
      if (!isIsoTimestamp(body.occurredAt)) return badRequest("Invalid occurredAt: must be an ISO date/timestamp");
      occurredAt = body.occurredAt;
    }

    let detectedAt: string | null = null;
    if (body?.detectedAt !== undefined && body.detectedAt !== null) {
      if (!isIsoTimestamp(body.detectedAt)) return badRequest("Invalid detectedAt: must be an ISO date/timestamp");
      detectedAt = body.detectedAt;
    }
    // Both sides are request-body strings here (not the pg Date objects
    // lib/repo/incidents.ts's updateIncident has to worry about), but they
    // can still be a mismatched date-only vs full-timestamp pair for the
    // same day, where plain string comparison does not agree with
    // chronological order. toEpochMillis compares actual instants instead.
    const occurredMs = toEpochMillis(occurredAt);
    const detectedMs = toEpochMillis(detectedAt);
    if (occurredMs !== null && detectedMs !== null && occurredMs > detectedMs) {
      return badRequest("occurredAt must not be after detectedAt");
    }

    const summary = typeof body?.summary === "string" && body.summary.trim() ? body.summary.trim() : null;

    let ownerPersonId: string | null = null;
    if (body?.ownerPersonId !== undefined && body.ownerPersonId !== null) {
      if (!isUuid(body.ownerPersonId)) return badRequest("ownerPersonId must be a valid UUID");
      const person = await requirePerson(workspace.id, body.ownerPersonId);
      if (!person) return badRequest("Unknown ownerPersonId for this workspace");
      ownerPersonId = person.id;
    }

    const incident = await createIncident(
      workspace.id,
      { title, source, severity, occurredAt, detectedAt, summary, ownerPersonId },
      ACTOR
    );

    return NextResponse.json({ incident }, { status: 201 });
  } catch (error) {
    return serverError("Incident create error", error);
  }
});
