import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { deleteControlChange, updateControlChange, type UpdateControlChangeInput } from "@/lib/repo/control-changes";
import { listDecisionsBySubject, listConditionsByDecision } from "@/lib/repo/decisions";
import { listActionsBySubject } from "@/lib/repo/actions";
import { listEvidenceBySubject } from "@/lib/repo/evidence";
import {
  ACTOR,
  SUBJECT_TYPE,
  badRequest,
  isControlChangeStatus,
  isControlChangeType,
  notFound,
  parseOptionalStep,
  requireChangeControl,
  requireControlChange,
  serverError,
} from "@/lib/control-changes/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/control-changes/[id] - full detail: the change, its underlying
 * workspace_control, the most recent decision (+ conditions), every action
 * recorded against the change, and its evidence.
 */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    const change = await requireControlChange(workspace.id, id);
    if (!change) return notFound("Control change not found");

    const control = await requireChangeControl(change);

    const decisions = await listDecisionsBySubject(workspace.id, SUBJECT_TYPE, id);
    const decision = decisions[0] ?? null;

    const [conditions, actions, evidence] = await Promise.all([
      decision ? listConditionsByDecision(workspace.id, decision.id) : Promise.resolve([]),
      listActionsBySubject(workspace.id, SUBJECT_TYPE, id),
      listEvidenceBySubject(workspace.id, SUBJECT_TYPE, id),
    ]);

    return NextResponse.json({ change, control, decision, conditions, actions, evidence });
  } catch (error) {
    return serverError("Control change detail error", error);
  }
});

/**
 * PATCH /api/control-changes/[id] - partial update: title, rationale,
 * changeType, currentStep, status, proposed, supportingData, impact, pilot,
 * pilotNotes, monitoring, rollbackCriteria. Validates enums; `proposed` is
 * whitelisted server-side by the repo layer (unknown keys are dropped).
 */
export const PATCH = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id } = await context.params;
    const existing = await requireControlChange(workspace.id, id);
    if (!existing) return notFound("Control change not found");

    const body = await request.json();
    const patch: UpdateControlChangeInput = {};

    if (body?.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) return badRequest("title must be a non-empty string");
      patch.title = title;
    }
    if (body?.rationale !== undefined) {
      patch.rationale = typeof body.rationale === "string" && body.rationale.trim() ? body.rationale.trim() : null;
    }
    if (body?.changeType !== undefined) {
      if (body.changeType !== null && !isControlChangeType(body.changeType)) {
        return badRequest(
          "Invalid changeType: must be threshold, rule_logic, scope, ownership, frequency, system, decommission, other, or null"
        );
      }
      patch.changeType = body.changeType;
    }
    if (body?.currentStep !== undefined) {
      const parsed = parseOptionalStep(body.currentStep);
      if (!parsed.ok) return badRequest("Invalid currentStep: must be an integer between 1 and 7");
      if (typeof parsed.value === "number") patch.currentStep = parsed.value;
    }
    if (body?.status !== undefined) {
      if (!isControlChangeStatus(body.status)) {
        return badRequest("Invalid status: must be draft, in_review, approved, rejected, implemented, or rolled_back");
      }
      patch.status = body.status;
    }
    if (body?.proposed !== undefined) {
      if (typeof body.proposed !== "object" || body.proposed === null || Array.isArray(body.proposed)) {
        return badRequest("Invalid proposed: must be an object");
      }
      patch.proposed = body.proposed as Record<string, unknown>;
    }
    if (body?.supportingData !== undefined) {
      if (typeof body.supportingData !== "object" || body.supportingData === null || Array.isArray(body.supportingData)) {
        return badRequest("Invalid supportingData: must be an object");
      }
      patch.supportingData = body.supportingData as Record<string, unknown>;
    }
    if (body?.impact !== undefined) {
      if (typeof body.impact !== "object" || body.impact === null || Array.isArray(body.impact)) {
        return badRequest("Invalid impact: must be an object");
      }
      patch.impact = body.impact as Record<string, unknown>;
    }
    if (body?.pilot !== undefined) {
      if (typeof body.pilot !== "boolean") return badRequest("Invalid pilot: must be a boolean");
      patch.pilot = body.pilot;
    }
    if (body?.pilotNotes !== undefined) {
      patch.pilotNotes = typeof body.pilotNotes === "string" && body.pilotNotes.trim() ? body.pilotNotes.trim() : null;
    }
    if (body?.monitoring !== undefined) {
      if (typeof body.monitoring !== "object" || body.monitoring === null || Array.isArray(body.monitoring)) {
        return badRequest("Invalid monitoring: must be an object");
      }
      patch.monitoring = body.monitoring as Record<string, unknown>;
    }
    if (body?.rollbackCriteria !== undefined) {
      patch.rollbackCriteria =
        typeof body.rollbackCriteria === "string" && body.rollbackCriteria.trim() ? body.rollbackCriteria.trim() : null;
    }

    const updated = await updateControlChange(workspace.id, id, patch, ACTOR);
    if (!updated) return notFound("Control change not found");

    return NextResponse.json({ change: updated });
  } catch (error) {
    return serverError("Control change update error", error);
  }
});

/** DELETE /api/control-changes/[id] */
export const DELETE = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    const existing = await requireControlChange(workspace.id, id);
    if (!existing) return notFound("Control change not found");

    await deleteControlChange(workspace.id, id, ACTOR);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError("Control change delete error", error);
  }
});
