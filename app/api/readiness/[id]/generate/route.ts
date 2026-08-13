import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { generateObligations } from "@/lib/repo/readiness";
import { conflict, isUuid, notFound, requireReadinessAssessment, serverError } from "@/lib/readiness/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/readiness/[id]/generate - builds (or extends) the obligation
 * register from the real data/kyc library for this assessment's
 * (entityType, jurisdiction). Idempotent: re-running never destroys a user's
 * existing control mapping, gap classification, blocker flag, evidence, or
 * notes on an obligation that already exists (see generateObligations in
 * lib/repo/readiness.ts). Returns {created, existing} counts.
 */
export const POST = withWorkspace<RouteContext>(async (_request, workspace, context, actor) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Readiness assessment not found");
    const assessment = await requireReadinessAssessment(workspace.id, id);
    if (!assessment) return notFound("Readiness assessment not found");

    const result = await generateObligations(workspace.id, id, actor);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Readiness assessment not found");
      if (result.reason === "unknown_profile") {
        return NextResponse.json(
          { error: "No KYC profile is available for this entity type in any jurisdiction" },
          { status: 400 }
        );
      }
      return conflict("Cannot generate obligations for an assessment that is already approved_global, rejected, or cancelled", "already_final");
    }

    return NextResponse.json({ created: result.created, existing: result.existing });
  } catch (error) {
    return serverError("Readiness generate error", error);
  }
});
