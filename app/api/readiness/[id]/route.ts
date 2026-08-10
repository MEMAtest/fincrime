import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import {
  deleteReadinessAssessment,
  isFinalReadinessStatus,
  listReadinessObligations,
  readinessSummary,
  updateReadinessAssessment,
  type UpdateReadinessAssessmentInput,
} from "@/lib/repo/readiness";
import { listActionsBySubject } from "@/lib/repo/actions";
import { listCommentsBySubject, listEvidenceBySubject } from "@/lib/repo/evidence";
import { listConditionsByDecision, listDecisionsBySubject } from "@/lib/repo/decisions";
import {
  ACTOR,
  SUBJECT_TYPE,
  badRequest,
  conflict,
  isIsoDate,
  isReadinessRiskLevel,
  isUuid,
  notFound,
  parseOptionalStep,
  requirePerson,
  requireProduct,
  requireReadinessAssessment,
  serverError,
} from "@/lib/readiness/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/readiness/[id] - full detail: the assessment, its generated
 * obligation register, the roll-up summary (counts by gap, blocker counts,
 * coverage), every decision recorded against it (submit has none; approvals
 * and rejection each record one) with their conditions flattened, actions,
 * evidence, and comments.
 */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Readiness assessment not found");
    const assessment = await requireReadinessAssessment(workspace.id, id);
    if (!assessment) return notFound("Readiness assessment not found");

    const [obligations, summary, decisions, actions, evidence, comments] = await Promise.all([
      listReadinessObligations(workspace.id, id),
      readinessSummary(workspace.id, id),
      listDecisionsBySubject(workspace.id, SUBJECT_TYPE, id),
      listActionsBySubject(workspace.id, SUBJECT_TYPE, id),
      listEvidenceBySubject(workspace.id, SUBJECT_TYPE, id),
      listCommentsBySubject(workspace.id, SUBJECT_TYPE, id),
    ]);

    const conditionLists = await Promise.all(decisions.map((d) => listConditionsByDecision(workspace.id, d.id)));
    const conditions = conditionLists.flat();

    return NextResponse.json({ assessment, obligations, summary, decisions, conditions, actions, evidence, comments });
  } catch (error) {
    return serverError("Readiness detail error", error);
  }
});

/**
 * PATCH /api/readiness/[id] - partial update of {title, riskLevel, productId,
 * productNote, targetLaunchDate, ownerPersonId, summary, currentStep}. NOT
 * status (submit/approve-local/approve-global/reject have their own routes)
 * and NOT entityType/jurisdiction: once obligations have been generated,
 * changing either would leave the register no longer matching its stated
 * basis, so that transition always 409s once at least one obligation row
 * exists (checked here, not by updateReadinessAssessment, since the repo
 * layer never accepts those fields as patchable at all).
 */
export const PATCH = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Readiness assessment not found");
    const existing = await requireReadinessAssessment(workspace.id, id);
    if (!existing) return notFound("Readiness assessment not found");
    if (isFinalReadinessStatus(existing.status)) {
      return conflict("Cannot update a readiness assessment that is already approved_global, rejected, or cancelled");
    }

    const body = await request.json();

    if (body?.entityType !== undefined || body?.jurisdiction !== undefined) {
      return badRequest(
        "entityType and jurisdiction cannot be changed via PATCH; the obligation register would no longer match its basis"
      );
    }
    if (body?.status !== undefined) {
      return badRequest("status cannot be changed via PATCH; use submit, approve-local, approve-global, or reject");
    }

    const patch: UpdateReadinessAssessmentInput = {};

    if (body?.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) return badRequest("title must be a non-empty string");
      patch.title = title;
    }

    if (body?.riskLevel !== undefined) {
      if (!isReadinessRiskLevel(body.riskLevel)) return badRequest("Invalid riskLevel: must be low, medium, or high");
      patch.riskLevel = body.riskLevel;
    }

    if (body?.productId !== undefined) {
      if (body.productId === null) {
        patch.productId = null;
      } else {
        if (!isUuid(body.productId)) return badRequest("productId must be a valid UUID or null");
        const product = await requireProduct(workspace.id, body.productId);
        if (!product) return badRequest("Unknown productId for this workspace");
        patch.productId = product.id;
      }
    }

    if (body?.productNote !== undefined) {
      patch.productNote = typeof body.productNote === "string" && body.productNote.trim() ? body.productNote.trim() : null;
    }

    if (body?.targetLaunchDate !== undefined) {
      if (body.targetLaunchDate !== null && !isIsoDate(body.targetLaunchDate)) {
        return badRequest("Invalid targetLaunchDate: must be an ISO date (YYYY-MM-DD) or null");
      }
      patch.targetLaunchDate = body.targetLaunchDate;
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

    if (body?.summary !== undefined) {
      patch.summary = typeof body.summary === "string" && body.summary.trim() ? body.summary.trim() : null;
    }

    if (body?.currentStep !== undefined) {
      const parsed = parseOptionalStep(body.currentStep);
      if (!parsed.ok) return badRequest("Invalid currentStep: must be an integer between 1 and 6");
      if (typeof parsed.value === "number") patch.currentStep = parsed.value;
    }

    const result = await updateReadinessAssessment(workspace.id, id, patch, ACTOR);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Readiness assessment not found");
      return conflict("Cannot update a readiness assessment that is already approved_global, rejected, or cancelled");
    }

    return NextResponse.json({ assessment: result.assessment });
  } catch (error) {
    return serverError("Readiness update error", error);
  }
});

/** DELETE /api/readiness/[id] - refuses on a final assessment (approved_global, rejected, cancelled). */
export const DELETE = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Readiness assessment not found");

    const result = await deleteReadinessAssessment(workspace.id, id, ACTOR);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Readiness assessment not found");
      return conflict("Cannot delete a readiness assessment that is already approved_global, rejected, or cancelled");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError("Readiness delete error", error);
  }
});
