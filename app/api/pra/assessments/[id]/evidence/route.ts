import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { listEvidenceBySubject } from "@/lib/repo/evidence";
import { notFound, requireAssessment, serverError } from "@/lib/pra/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/pra/assessments/[id]/evidence - evidence records attached to this
 * assessment, for the Step 8 committee pack. Round 1 has no evidence
 * creation UI on the PRA journey yet (metadata-only evidence is created
 * elsewhere per the Round 1 data model); this reads whatever exists so the
 * pack stays accurate as that capability lands.
 */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    const assessment = await requireAssessment(workspace.id, id);
    if (!assessment) return notFound("Assessment not found");

    const evidence = await listEvidenceBySubject(workspace.id, "pra_assessment", id);
    return NextResponse.json({ evidence });
  } catch (error) {
    return serverError("PRA evidence list error", error);
  }
});
