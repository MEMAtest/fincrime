import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import {
  deleteIncident,
  isFinalIncidentStatus,
  listIncidentLinks,
  updateIncident,
  type UpdateIncidentInput,
} from "@/lib/repo/incidents";
import { listActionsBySubject } from "@/lib/repo/actions";
import { listCommentsBySubject, listEvidenceBySubject } from "@/lib/repo/evidence";
import { listDecisionsBySubject, listConditionsByDecision } from "@/lib/repo/decisions";
import { requirePerson } from "@/lib/pra/helpers";
import {
  ACTOR,
  SUBJECT_TYPE,
  badRequest,
  conflict,
  isIncidentSource,
  isIncidentSeverity,
  isIsoTimestamp,
  isPatchableIncidentStatus,
  isRootCauseCategory,
  isUuid,
  notFound,
  parseAffectedPopulation,
  parseOptionalStep,
  requireIncident,
  resolveIncidentLinks,
  serverError,
} from "@/lib/incidents/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/incidents/[id] - full detail: the incident, its links (with
 * resolved display labels for each linked control/change/test/assessment/
 * enforcement case), actions, evidence, the most recent decision (if any)
 * with its conditions, and comments.
 */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Incident not found");
    const incident = await requireIncident(workspace.id, id);
    if (!incident) return notFound("Incident not found");

    const [rawLinks, actions, evidence, decisions, comments] = await Promise.all([
      listIncidentLinks(workspace.id, id),
      listActionsBySubject(workspace.id, SUBJECT_TYPE, id),
      listEvidenceBySubject(workspace.id, SUBJECT_TYPE, id),
      listDecisionsBySubject(workspace.id, SUBJECT_TYPE, id),
      listCommentsBySubject(workspace.id, SUBJECT_TYPE, id),
    ]);

    const decision = decisions[0] ?? null;
    const conditions = decision ? await listConditionsByDecision(workspace.id, decision.id) : [];
    const links = await resolveIncidentLinks(workspace.id, rawLinks);

    return NextResponse.json({ incident, links, actions, evidence, decision, conditions, comments });
  } catch (error) {
    return serverError("Incident detail error", error);
  }
});

/**
 * PATCH /api/incidents/[id] - partial update of any field except status
 * moving to a final value; closing and reopening go through their own
 * routes. An incident that is already closed or cancelled is a historical
 * record and 409s on every PATCH.
 */
export const PATCH = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Incident not found");
    const existing = await requireIncident(workspace.id, id);
    if (!existing) return notFound("Incident not found");
    if (isFinalIncidentStatus(existing.status)) {
      return conflict("Cannot update an incident that is already closed or cancelled");
    }

    const body = await request.json();
    const patch: UpdateIncidentInput = {};

    if (body?.reference !== undefined) {
      patch.reference = typeof body.reference === "string" && body.reference.trim() ? body.reference.trim() : null;
    }

    if (body?.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) return badRequest("title must be a non-empty string");
      patch.title = title;
    }

    if (body?.source !== undefined) {
      if (body.source !== null && !isIncidentSource(body.source)) {
        return badRequest(
          "Invalid source: must be internal_detection, customer_complaint, regulator, third_party, audit, control_test, other, or null"
        );
      }
      patch.source = body.source;
    }

    if (body?.severity !== undefined) {
      if (!isIncidentSeverity(body.severity)) return badRequest("Invalid severity: must be low, medium, high, or critical");
      patch.severity = body.severity;
    }

    const occurredAt = body?.occurredAt !== undefined ? body.occurredAt : undefined;
    if (occurredAt !== undefined && occurredAt !== null) {
      if (!isIsoTimestamp(occurredAt)) return badRequest("Invalid occurredAt: must be an ISO date/timestamp or null");
    }
    if (body?.occurredAt !== undefined) patch.occurredAt = occurredAt;

    const detectedAt = body?.detectedAt !== undefined ? body.detectedAt : undefined;
    if (detectedAt !== undefined && detectedAt !== null) {
      if (!isIsoTimestamp(detectedAt)) return badRequest("Invalid detectedAt: must be an ISO date/timestamp or null");
    }
    if (body?.detectedAt !== undefined) patch.detectedAt = detectedAt;

    const effectiveOccurred = body?.occurredAt !== undefined ? occurredAt : existing.occurred_at;
    const effectiveDetected = body?.detectedAt !== undefined ? detectedAt : existing.detected_at;
    if (effectiveOccurred && effectiveDetected && effectiveOccurred > effectiveDetected) {
      return badRequest("occurredAt must not be after detectedAt");
    }

    if (body?.containedAt !== undefined) {
      if (body.containedAt !== null && !isIsoTimestamp(body.containedAt)) {
        return badRequest("Invalid containedAt: must be an ISO date/timestamp or null");
      }
      patch.containedAt = body.containedAt;
    }

    if (body?.summary !== undefined) {
      patch.summary = typeof body.summary === "string" && body.summary.trim() ? body.summary.trim() : null;
    }

    if (body?.containment !== undefined) {
      patch.containment = typeof body.containment === "string" && body.containment.trim() ? body.containment.trim() : null;
    }

    if (body?.affectedPopulation !== undefined) {
      const parsed = parseAffectedPopulation(body.affectedPopulation);
      if (!parsed.ok) return badRequest(parsed.error);
      patch.affectedPopulation = parsed.value;
    }

    if (body?.rootCause !== undefined) {
      patch.rootCause = typeof body.rootCause === "string" && body.rootCause.trim() ? body.rootCause.trim() : null;
    }

    if (body?.rootCauseCategory !== undefined) {
      if (body.rootCauseCategory !== null && !isRootCauseCategory(body.rootCauseCategory)) {
        return badRequest(
          "Invalid rootCauseCategory: must be control_design, control_operation, data_quality, system_failure, human_error, third_party, process_gap, other, or null"
        );
      }
      patch.rootCauseCategory = body.rootCauseCategory;
    }

    if (body?.reportable !== undefined) {
      if (typeof body.reportable !== "boolean") return badRequest("reportable must be a boolean");
      patch.reportable = body.reportable;
    }

    if (body?.reportedAt !== undefined) {
      if (body.reportedAt !== null && !isIsoTimestamp(body.reportedAt)) {
        return badRequest("Invalid reportedAt: must be an ISO date/timestamp or null");
      }
      patch.reportedAt = body.reportedAt;
    }

    if (body?.regulatorReference !== undefined) {
      patch.regulatorReference =
        typeof body.regulatorReference === "string" && body.regulatorReference.trim() ? body.regulatorReference.trim() : null;
    }

    if (body?.ownerPersonId !== undefined) {
      if (body.ownerPersonId === null) {
        patch.ownerPersonId = null;
      } else {
        if (!isUuid(body.ownerPersonId)) return badRequest("ownerPersonId must be a valid UUID or null");
        const person = await requirePerson(workspace.id, body.ownerPersonId);
        if (!person) return badRequest("Unknown ownerPersonId for this workspace");
        patch.ownerPersonId = person.id;
      }
    }

    if (body?.closureSummary !== undefined) {
      patch.closureSummary =
        typeof body.closureSummary === "string" && body.closureSummary.trim() ? body.closureSummary.trim() : null;
    }

    if (body?.currentStep !== undefined) {
      const parsed = parseOptionalStep(body.currentStep);
      if (!parsed.ok) return badRequest("Invalid currentStep: must be an integer between 1 and 7");
      if (typeof parsed.value === "number") patch.currentStep = parsed.value;
    }

    if (body?.status !== undefined) {
      if (!isPatchableIncidentStatus(body.status)) {
        return badRequest(
          "Invalid status: PATCH only supports open, contained, investigating, or remediating; use the close/reopen endpoints for those transitions"
        );
      }
      patch.status = body.status;
    }

    const updated = await updateIncident(workspace.id, id, patch, ACTOR);
    if (!updated) return notFound("Incident not found");

    return NextResponse.json({ incident: updated });
  } catch (error) {
    return serverError("Incident update error", error);
  }
});

/** DELETE /api/incidents/[id] - refuses on a closed incident: deleting a historical record would erase the traceability chain the module exists to preserve. */
export const DELETE = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Incident not found");
    const existing = await requireIncident(workspace.id, id);
    if (!existing) return notFound("Incident not found");
    if (isFinalIncidentStatus(existing.status)) return conflict("Cannot delete an incident that is already closed or cancelled");

    await deleteIncident(workspace.id, id, ACTOR);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError("Incident delete error", error);
  }
});
