import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { deleteControlTestFinding, getControlTestFinding, updateControlTestFinding, type UpdateControlTestFindingInput } from "@/lib/repo/control-tests";
import { badRequest, conflict, isFindingSeverity, isFinalTestStatus, isUuid, notFound, requireControlTest, serverError } from "@/lib/control-tests/helpers";

interface RouteContext {
  params: Promise<{ id: string; findingId: string }>;
}

/** Loads a finding and verifies it belongs to both the workspace AND the given test. */
async function requireTestFinding(workspaceId: string, testId: string, findingId: string) {
  const finding = await getControlTestFinding(workspaceId, findingId);
  if (!finding || finding.test_id !== testId) return null;
  return finding;
}

/**
 * PATCH /api/control-tests/[id]/findings/[findingId] - body
 * {description?, severity?, sampleRef?}. 409 if the parent test is already
 * complete or cancelled (a finding is part of the historical record then).
 */
export const PATCH = withWorkspace<RouteContext>(async (request, workspace, context, actor) => {
  try {
    const { id, findingId } = await context.params;
    if (!isUuid(id) || !isUuid(findingId)) return notFound("Control test or finding not found");
    const test = await requireControlTest(workspace.id, id);
    if (!test) return notFound("Control test not found");
    if (isFinalTestStatus(test.status)) return conflict("Cannot update a finding on a test that is already complete or cancelled");

    const finding = await requireTestFinding(workspace.id, id, findingId);
    if (!finding) return notFound("Finding not found");

    const body = await request.json();
    const patch: UpdateControlTestFindingInput = {};

    if (body?.description !== undefined) {
      const description = typeof body.description === "string" ? body.description.trim() : "";
      if (!description) return badRequest("description must be a non-empty string");
      patch.description = description;
    }

    if (body?.severity !== undefined) {
      if (!isFindingSeverity(body.severity)) return badRequest("Invalid severity: must be low, medium, or high");
      patch.severity = body.severity;
    }

    if (body?.sampleRef !== undefined) {
      patch.sampleRef = typeof body.sampleRef === "string" && body.sampleRef.trim() ? body.sampleRef.trim() : null;
    }

    const updated = await updateControlTestFinding(workspace.id, findingId, patch, actor);
    if (!updated) return notFound("Finding not found");

    return NextResponse.json({ finding: updated });
  } catch (error) {
    return serverError("Control test finding update error", error);
  }
});

/** DELETE /api/control-tests/[id]/findings/[findingId] */
export const DELETE = withWorkspace<RouteContext>(async (_request, workspace, context, actor) => {
  try {
    const { id, findingId } = await context.params;
    if (!isUuid(id) || !isUuid(findingId)) return notFound("Control test or finding not found");
    const test = await requireControlTest(workspace.id, id);
    if (!test) return notFound("Control test not found");
    if (isFinalTestStatus(test.status)) return conflict("Cannot delete a finding on a test that is already complete or cancelled");

    const finding = await requireTestFinding(workspace.id, id, findingId);
    if (!finding) return notFound("Finding not found");

    await deleteControlTestFinding(workspace.id, findingId, actor);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError("Control test finding delete error", error);
  }
});
