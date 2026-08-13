import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { approveGlobal } from "@/lib/repo/readiness";
import { badRequest, isUuid, notFound, parseApprovalBody, requireReadinessAssessment, serverError } from "@/lib/readiness/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function approveConflict(message: string, reason: "already_final" | "not_locally_approved" | "unresolved_blockers"): NextResponse {
  return NextResponse.json({ error: message, reason }, { status: 409 });
}

/**
 * POST /api/readiness/[id]/approve-global - body {decidedByPersonId,
 * rationale?, conditions?[]}. Records a global approval decision and moves
 * the assessment to approved_global (final). Requires the assessment to
 * already be approved_local (not_locally_approved otherwise) - global
 * approval is the second signature on top of local, never a substitute for
 * it. Re-checks unresolved blockers for the same reason as approve-local: an
 * obligation could have been edited back to an unresolved blocker state
 * between the local and global approval.
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context, actor) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Readiness assessment not found");
    const assessment = await requireReadinessAssessment(workspace.id, id);
    if (!assessment) return notFound("Readiness assessment not found");

    const body = await request.json().catch(() => ({}));
    const parsed = await parseApprovalBody(workspace.id, body);
    if (!parsed.ok) return badRequest(parsed.error);

    const result = await approveGlobal(
      workspace.id,
      id,
      { decidedByPersonId: parsed.decidedByPersonId, rationale: parsed.rationale, conditions: parsed.conditions },
      actor
    );
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Readiness assessment not found");
      if (result.reason === "unresolved_blockers") {
        return approveConflict("Cannot approve while any obligation is a launch blocker that is not yet fully resolved", "unresolved_blockers");
      }
      if (result.reason === "not_locally_approved" || result.reason === "wrong_status") {
        return approveConflict("An assessment must be approved_local before it can be approved globally", "not_locally_approved");
      }
      return approveConflict("Assessment is already approved_global, rejected, or cancelled", "already_final");
    }

    return NextResponse.json({ assessment: result.assessment, decision: result.decision, conditions: result.conditions });
  } catch (error) {
    return serverError("Readiness approve-global error", error);
  }
});
