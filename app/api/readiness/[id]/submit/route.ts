import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { submitForReview } from "@/lib/repo/readiness";
import { ACTOR, isUuid, notFound, requireReadinessAssessment, serverError } from "@/lib/readiness/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Machine-readable reason a submit failed, alongside the human-readable `error` message. Read `reason`, not the message text. */
function submitConflict(message: string, reason: "already_final" | "wrong_status" | "no_obligations"): NextResponse {
  return NextResponse.json({ error: message, reason }, { status: 409 });
}

/**
 * POST /api/readiness/[id]/submit - moves a draft assessment to in_review.
 * 409 with a specific machine-readable `reason`: already final, not
 * currently draft (wrong_status), or no obligations have been generated yet.
 */
export const POST = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Readiness assessment not found");
    const assessment = await requireReadinessAssessment(workspace.id, id);
    if (!assessment) return notFound("Readiness assessment not found");

    const result = await submitForReview(workspace.id, id, ACTOR);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Readiness assessment not found");
      if (result.reason === "no_obligations") {
        return submitConflict("Cannot submit an assessment with no generated obligations", "no_obligations");
      }
      if (result.reason === "wrong_status") {
        return submitConflict("Only a draft assessment can be submitted for review", "wrong_status");
      }
      return submitConflict("Assessment is already approved_global, rejected, or cancelled", "already_final");
    }

    return NextResponse.json({ assessment: result.assessment });
  } catch (error) {
    return serverError("Readiness submit error", error);
  }
});
