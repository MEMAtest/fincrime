import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createEvidence, listEvidenceBySubject } from "@/lib/repo/evidence";
import { getReadinessObligationWithClient, withReadinessAssessmentLock } from "@/lib/repo/readiness";
import { OBLIGATION_SUBJECT_TYPE,
  badRequest,
  conflict,
  isIsoDate,
  isUuid,
  notFound,
  requirePerson,
  requireReadinessAssessment,
  requireReadinessObligation,
  serverError,
} from "@/lib/readiness/helpers";

interface RouteContext {
  params: Promise<{ id: string; obligationId: string }>;
}

/** GET /api/readiness/[id]/obligations/[obligationId]/evidence - evidence attached to a single obligation. */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id, obligationId } = await context.params;
    if (!isUuid(id) || !isUuid(obligationId)) return notFound("Readiness obligation not found");
    const assessment = await requireReadinessAssessment(workspace.id, id);
    if (!assessment) return notFound("Readiness assessment not found");
    const obligation = await requireReadinessObligation(workspace.id, id, obligationId);
    if (!obligation) return notFound("Readiness obligation not found");

    const evidence = await listEvidenceBySubject(workspace.id, OBLIGATION_SUBJECT_TYPE, obligationId);
    return NextResponse.json({ evidence });
  } catch (error) {
    return serverError("Readiness obligation evidence list error", error);
  }
});

/**
 * POST /api/readiness/[id]/obligations/[obligationId]/evidence - body
 * {type, title, description?, linkUrl?, evidenceDate?, addedByPersonId?}.
 * Creates an evidence row against this single obligation (subjectType
 * 'readiness_obligation'). Refuses once the parent assessment is final.
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context, actor) => {
  try {
    const { id, obligationId } = await context.params;
    if (!isUuid(id) || !isUuid(obligationId)) return notFound("Readiness obligation not found");
    const assessment = await requireReadinessAssessment(workspace.id, id);
    if (!assessment) return notFound("Readiness assessment not found");
    const obligation = await requireReadinessObligation(workspace.id, id, obligationId);
    if (!obligation) return notFound("Readiness obligation not found");

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

    // Locks the PARENT assessment row and re-checks its status inside the
    // same transaction as the evidence insert (see
    // withReadinessAssessmentLock's doc comment) - a concurrent
    // approve-global on the assessment cannot race this write.
    const locked = await withReadinessAssessmentLock(workspace.id, id, async (client) => {
      const stillThere = await getReadinessObligationWithClient(client, workspace.id, id, obligationId);
      if (!stillThere) return null;
      return createEvidence(
        workspace.id,
        { subjectType: OBLIGATION_SUBJECT_TYPE, subjectId: obligationId, type, title, description, linkUrl, evidenceDate, addedByPersonId },
        actor,
        client
      );
    });
    if (!locked.ok) {
      if (locked.reason === "not_found") return notFound("Readiness assessment not found");
      return conflict("Cannot add evidence to an obligation on an assessment that is already approved_global, rejected, or cancelled");
    }
    if (!locked.result) return notFound("Readiness obligation not found");

    return NextResponse.json({ evidence: locked.result }, { status: 201 });
  } catch (error) {
    return serverError("Readiness obligation evidence create error", error);
  }
});
