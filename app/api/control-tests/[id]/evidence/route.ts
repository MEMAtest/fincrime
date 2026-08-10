import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createEvidence, listEvidenceBySubject } from "@/lib/repo/evidence";
import { requirePerson } from "@/lib/pra/helpers";
import {
  ACTOR,
  SUBJECT_TYPE,
  badRequest,
  conflict,
  isFinalTestStatus,
  isIsoDate,
  isUuid,
  notFound,
  requireControlTest,
  serverError,
} from "@/lib/control-tests/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/control-tests/[id]/evidence - evidence records attached to this test. */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Control test not found");
    const test = await requireControlTest(workspace.id, id);
    if (!test) return notFound("Control test not found");

    const evidence = await listEvidenceBySubject(workspace.id, SUBJECT_TYPE, id);
    return NextResponse.json({ evidence });
  } catch (error) {
    return serverError("Control test evidence list error", error);
  }
});

/**
 * POST /api/control-tests/[id]/evidence - body {type, title, description?,
 * linkUrl?, evidenceDate?, addedByPersonId?}. Creates an evidence row against
 * this test (subject_type 'control_test'). A test that is already complete
 * or cancelled is a historical record and 409s, matching the findings routes.
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Control test not found");
    const test = await requireControlTest(workspace.id, id);
    if (!test) return notFound("Control test not found");
    if (isFinalTestStatus(test.status)) return conflict("Cannot add evidence to a test that is already complete or cancelled");

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

    const evidence = await createEvidence(
      workspace.id,
      { subjectType: SUBJECT_TYPE, subjectId: id, type, title, description, linkUrl, evidenceDate, addedByPersonId },
      ACTOR
    );

    return NextResponse.json({ evidence }, { status: 201 });
  } catch (error) {
    return serverError("Control test evidence create error", error);
  }
});
