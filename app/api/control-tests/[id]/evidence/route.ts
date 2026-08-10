import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createEvidence, listEvidenceBySubject } from "@/lib/repo/evidence";
import { requirePerson } from "@/lib/pra/helpers";
import { ACTOR, SUBJECT_TYPE, badRequest, notFound, requireControlTest, serverError } from "@/lib/control-tests/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/control-tests/[id]/evidence - evidence records attached to this test. */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
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
 * this test (subject_type 'control_test').
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id } = await context.params;
    const test = await requireControlTest(workspace.id, id);
    if (!test) return notFound("Control test not found");

    const body = await request.json();

    const type = typeof body?.type === "string" ? body.type.trim() : "";
    if (!type) return badRequest("Missing required field: type");

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return badRequest("Missing required field: title");

    const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;
    const linkUrl = typeof body?.linkUrl === "string" && body.linkUrl.trim() ? body.linkUrl.trim() : null;
    const evidenceDate = typeof body?.evidenceDate === "string" && body.evidenceDate ? body.evidenceDate : null;

    let addedByPersonId: string | null = null;
    if (body?.addedByPersonId !== undefined && body.addedByPersonId !== null) {
      if (typeof body.addedByPersonId !== "string") return badRequest("Invalid addedByPersonId");
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
