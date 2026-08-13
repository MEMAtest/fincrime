import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createEvidence, listEvidenceBySubject } from "@/lib/repo/evidence";
import { withReadinessAssessmentLock } from "@/lib/repo/readiness";
import { SUBJECT_TYPE,
  badRequest,
  conflict,
  isIsoDate,
  isUuid,
  notFound,
  requirePerson,
  requireReadinessAssessment,
  serverError,
} from "@/lib/readiness/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/readiness/[id]/evidence - evidence records attached to this assessment as a whole. */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Readiness assessment not found");
    const assessment = await requireReadinessAssessment(workspace.id, id);
    if (!assessment) return notFound("Readiness assessment not found");

    const evidence = await listEvidenceBySubject(workspace.id, SUBJECT_TYPE, id);
    return NextResponse.json({ evidence });
  } catch (error) {
    return serverError("Readiness evidence list error", error);
  }
});

/**
 * POST /api/readiness/[id]/evidence - body {type, title, description?,
 * linkUrl?, evidenceDate?, addedByPersonId?}. Creates an evidence row against
 * the assessment as a whole (subjectType 'readiness_assessment'). Refuses on
 * a final assessment.
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context, actor) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Readiness assessment not found");
    const existing = await requireReadinessAssessment(workspace.id, id);
    if (!existing) return notFound("Readiness assessment not found");

    const body = await request.json();

    const type = typeof body?.type === "string" ? body.type.trim() : "";
    if (!type) return badRequest("Missing required field: type");

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return badRequest("Missing required field: title");

    const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;
    const linkUrl = typeof body?.linkUrl === "string" && body.linkUrl.trim() ? body.linkUrl.trim() : null;

    let evidenceDate: string | null = null;
    if (body?.evidenceDate !== undefined && body.evidenceDate !== null) {
      if (!isIsoDate(body.evidenceDate)) return badRequest("Invalid evidenceDate: must be an ISO date (YYYY-MM-DD)");
      evidenceDate = body.evidenceDate;
    }

    let addedByPersonId: string | null = null;
    if (body?.addedByPersonId !== undefined && body.addedByPersonId !== null) {
      if (!isUuid(body.addedByPersonId)) return badRequest("Invalid addedByPersonId: must be a valid UUID");
      const person = await requirePerson(workspace.id, body.addedByPersonId);
      if (!person) return badRequest("Unknown addedByPersonId for this workspace");
      addedByPersonId = person.id;
    }

    // Locks the assessment row (SELECT ... FOR UPDATE) and re-checks its
    // status is non-final in the SAME transaction as the evidence insert, so
    // a concurrent approve-global cannot flip the assessment to final in the
    // window between the status check and the write (see
    // withReadinessAssessmentLock's doc comment).
    const locked = await withReadinessAssessmentLock(workspace.id, id, async (client) =>
      createEvidence(
        workspace.id,
        { subjectType: SUBJECT_TYPE, subjectId: id, type, title, description, linkUrl, evidenceDate, addedByPersonId },
        actor,
        client
      )
    );
    if (!locked.ok) {
      if (locked.reason === "not_found") return notFound("Readiness assessment not found");
      return conflict("Cannot add evidence to an assessment that is already approved_global, rejected, or cancelled");
    }

    return NextResponse.json({ evidence: locked.result }, { status: 201 });
  } catch (error) {
    return serverError("Readiness evidence create error", error);
  }
});
