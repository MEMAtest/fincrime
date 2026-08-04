import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { deleteAssessmentRisk, updateAssessmentRisk, type UpdateAssessmentRiskInput } from "@/lib/repo/assessments";
import {
  ACTOR,
  badRequest,
  notFound,
  parseOptionalScore,
  requireAssessment,
  requireAssessmentRisk,
  serverError,
} from "@/lib/pra/helpers";

interface RouteContext {
  params: Promise<{ id: string; riskId: string }>;
}

/** PATCH /api/pra/assessments/[id]/risks/[riskId] - updates a risk register entry. */
export const PATCH = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id, riskId } = await context.params;
    const assessment = await requireAssessment(workspace.id, id);
    if (!assessment) return notFound("Assessment not found");

    const risk = await requireAssessmentRisk(workspace.id, id, riskId);
    if (!risk) return notFound("Risk not found");

    const body = await request.json();
    const patch: UpdateAssessmentRiskInput = {};

    if (typeof body?.title === "string" && body.title.trim()) patch.title = body.title.trim();
    if (body?.typologySlug !== undefined) {
      patch.typologySlug = typeof body.typologySlug === "string" && body.typologySlug ? body.typologySlug : null;
    }
    if (body?.inherentRationale !== undefined) {
      patch.inherentRationale = typeof body.inherentRationale === "string" ? body.inherentRationale : null;
    }
    if (body?.inherentScore !== undefined) {
      const parsed = parseOptionalScore(body.inherentScore);
      if (!parsed.ok) return badRequest("Invalid inherentScore: must be a number between 0 and 100");
      patch.inherentScore = parsed.value ?? null;
    }
    if (body?.residualRationale !== undefined) {
      patch.residualRationale = typeof body.residualRationale === "string" ? body.residualRationale : null;
    }
    if (body?.residualScore !== undefined) {
      const parsed = parseOptionalScore(body.residualScore);
      if (!parsed.ok) return badRequest("Invalid residualScore: must be a number between 0 and 100");
      patch.residualScore = parsed.value ?? null;
    }

    const updated = await updateAssessmentRisk(workspace.id, riskId, patch, ACTOR);
    if (!updated) return notFound("Risk not found");
    return NextResponse.json({ risk: updated });
  } catch (error) {
    return serverError("PRA risk update error", error);
  }
});

/** DELETE /api/pra/assessments/[id]/risks/[riskId] - removes a risk register entry. */
export const DELETE = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id, riskId } = await context.params;
    const assessment = await requireAssessment(workspace.id, id);
    if (!assessment) return notFound("Assessment not found");

    const risk = await requireAssessmentRisk(workspace.id, id, riskId);
    if (!risk) return notFound("Risk not found");

    const deleted = await deleteAssessmentRisk(workspace.id, riskId, ACTOR);
    return NextResponse.json({ success: deleted });
  } catch (error) {
    return serverError("PRA risk delete error", error);
  }
});
