import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { reject } from "@/lib/repo/readiness";
import { createCondition } from "@/lib/repo/decisions";
import { ACTOR, badRequest, isUuid, notFound, parseApprovalBody, requireReadinessAssessment, serverError } from "@/lib/readiness/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/readiness/[id]/reject - body {decidedByPersonId, rationale?,
 * conditions?[]}. Records a rejection decision and moves the assessment to
 * rejected (final) from any non-final status. Not blocked by outstanding
 * gaps/blockers - a reviewer may reject an assessment precisely because of
 * them.
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Readiness assessment not found");
    const assessment = await requireReadinessAssessment(workspace.id, id);
    if (!assessment) return notFound("Readiness assessment not found");

    const body = await request.json().catch(() => ({}));
    const parsed = await parseApprovalBody(workspace.id, body);
    if (!parsed.ok) return badRequest(parsed.error);

    const result = await reject(workspace.id, id, { decidedByPersonId: parsed.decidedByPersonId, rationale: parsed.rationale }, ACTOR);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Readiness assessment not found");
      return NextResponse.json(
        { error: "Assessment is already approved_global, rejected, or cancelled", reason: "already_final" },
        { status: 409 }
      );
    }

    const conditions = [];
    for (const input of parsed.conditions) {
      conditions.push(await createCondition(workspace.id, result.decision.id, input, ACTOR));
    }

    return NextResponse.json({ assessment: result.assessment, decision: result.decision, conditions });
  } catch (error) {
    return serverError("Readiness reject error", error);
  }
});
