import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { approveLocal } from "@/lib/repo/readiness";
import { ACTOR, badRequest, isUuid, notFound, parseApprovalBody, requireReadinessAssessment, serverError } from "@/lib/readiness/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function approveConflict(message: string, reason: "already_final" | "wrong_status" | "unresolved_blockers"): NextResponse {
  return NextResponse.json({ error: message, reason }, { status: 409 });
}

/**
 * POST /api/readiness/[id]/approve-local - body {decidedByPersonId, rationale?,
 * conditions?[]}. Records a local approval decision and moves the assessment
 * to approved_local. Refuses (unresolved_blockers) while any obligation is
 * still a launch blocker with gap != 'full' - see approveLocal in
 * lib/repo/readiness.ts for why that guard exists. Requires the assessment
 * to be in_review (wrong_status otherwise).
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

    const result = await approveLocal(
      workspace.id,
      id,
      { decidedByPersonId: parsed.decidedByPersonId, rationale: parsed.rationale, conditions: parsed.conditions },
      ACTOR
    );
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Readiness assessment not found");
      if (result.reason === "unresolved_blockers") {
        return approveConflict("Cannot approve while any obligation is a launch blocker that is not yet fully resolved", "unresolved_blockers");
      }
      if (result.reason === "wrong_status" || result.reason === "not_locally_approved") {
        return approveConflict("Only an assessment in review can be approved locally", "wrong_status");
      }
      return approveConflict("Assessment is already approved_global, rejected, or cancelled", "already_final");
    }

    return NextResponse.json({ assessment: result.assessment, decision: result.decision, conditions: result.conditions });
  } catch (error) {
    return serverError("Readiness approve-local error", error);
  }
});
