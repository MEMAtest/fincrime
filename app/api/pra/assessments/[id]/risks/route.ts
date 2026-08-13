import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createAssessmentRisk, listAssessmentRisks, type CreateAssessmentRiskInput } from "@/lib/repo/assessments";
import { badRequest, notFound, parseOptionalScore, requireAssessment, serverError } from "@/lib/pra/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/pra/assessments/[id]/risks - list the risk register for an assessment. */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    const assessment = await requireAssessment(workspace.id, id);
    if (!assessment) return notFound("Assessment not found");

    const risks = await listAssessmentRisks(workspace.id, id);
    return NextResponse.json({ risks });
  } catch (error) {
    return serverError("PRA risks list error", error);
  }
});

/**
 * POST /api/pra/assessments/[id]/risks - adds a risk, either seeded from a
 * scored typology match (typologySlug set) or fully manual (typologySlug null).
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context, actor) => {
  try {
    const { id } = await context.params;
    const assessment = await requireAssessment(workspace.id, id);
    if (!assessment) return notFound("Assessment not found");

    const body = await request.json();
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return badRequest("Missing required field: title");

    const inherentScore = parseOptionalScore(body?.inherentScore);
    if (!inherentScore.ok) return badRequest("Invalid inherentScore: must be a number between 0 and 100");

    const input: CreateAssessmentRiskInput = {
      title,
      typologySlug: typeof body?.typologySlug === "string" && body.typologySlug ? body.typologySlug : null,
      inherentScore: inherentScore.value ?? null,
      inherentRationale: typeof body?.inherentRationale === "string" ? body.inherentRationale : null,
    };

    const risk = await createAssessmentRisk(workspace.id, id, input, actor);
    return NextResponse.json({ risk }, { status: 201 });
  } catch (error) {
    return serverError("PRA risk create error", error);
  }
});
