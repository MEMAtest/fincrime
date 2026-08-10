import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createControlTest, listControlTests } from "@/lib/repo/control-tests";
import { listWorkspaceControls } from "@/lib/repo/controls";
import { requirePerson, requireWorkspaceControl } from "@/lib/pra/helpers";
import { ACTOR, badRequest, isControlTestMethod, isIsoDate, isUuid, parseOptionalCount, serverError } from "@/lib/control-tests/helpers";

/**
 * GET /api/control-tests - list the workspace's control tests, one row per
 * test with the underlying control's name resolved for display.
 */
export const GET = withWorkspace(async (_request, workspace) => {
  try {
    const [tests, controls] = await Promise.all([listControlTests(workspace.id), listWorkspaceControls(workspace.id)]);
    const controlById = new Map(controls.map((c) => [c.id, c]));

    const items = tests.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      result: t.result,
      controlName: controlById.get(t.workspace_control_id)?.name ?? "Unknown control",
      periodEnd: t.period_end,
      updatedAt: t.updated_at,
    }));

    return NextResponse.json({ tests: items });
  } catch (error) {
    return serverError("Control tests list error", error);
  }
});

/**
 * POST /api/control-tests - body {workspaceControlId, title, method?,
 * periodStart?, periodEnd?, testerPersonId?}. workspaceControlId must
 * resolve to a control in this workspace; testerPersonId (if supplied) must
 * resolve to a person in this workspace.
 */
export const POST = withWorkspace(async (request, workspace) => {
  try {
    const body = await request.json();

    if (!isUuid(body?.workspaceControlId)) {
      return badRequest("workspaceControlId must be a valid UUID");
    }
    const control = await requireWorkspaceControl(workspace.id, body.workspaceControlId);
    if (!control) return badRequest("Unknown workspaceControlId for this workspace");

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return badRequest("Missing required field: title");

    let method = null;
    if (body?.method !== undefined && body.method !== null) {
      if (!isControlTestMethod(body.method)) {
        return badRequest("Invalid method: must be sample, walkthrough, reperformance, data_analysis, or other");
      }
      method = body.method;
    }

    let periodStart: string | null = null;
    if (body?.periodStart !== undefined && body.periodStart !== null) {
      if (!isIsoDate(body.periodStart)) return badRequest("Invalid periodStart: must be an ISO date (YYYY-MM-DD)");
      periodStart = body.periodStart;
    }

    let periodEnd: string | null = null;
    if (body?.periodEnd !== undefined && body.periodEnd !== null) {
      if (!isIsoDate(body.periodEnd)) return badRequest("Invalid periodEnd: must be an ISO date (YYYY-MM-DD)");
      periodEnd = body.periodEnd;
    }
    if (periodStart && periodEnd && periodStart > periodEnd) {
      return badRequest("periodStart must not be after periodEnd");
    }

    let testerPersonId: string | null = null;
    if (body?.testerPersonId !== undefined && body.testerPersonId !== null) {
      if (!isUuid(body.testerPersonId)) return badRequest("testerPersonId must be a valid UUID");
      const person = await requirePerson(workspace.id, body.testerPersonId);
      if (!person) return badRequest("Unknown testerPersonId for this workspace");
      testerPersonId = person.id;
    }

    const sampleSizeParsed = parseOptionalCount(body?.sampleSize);
    if (!sampleSizeParsed.ok) return badRequest("Invalid sampleSize: must be a non-negative integer (max 100000) or null");

    const test = await createControlTest(
      workspace.id,
      {
        workspaceControlId: control.id,
        title,
        method,
        periodStart,
        periodEnd,
        testerPersonId,
        sampleSize: sampleSizeParsed.value ?? null,
      },
      ACTOR
    );

    return NextResponse.json({ test }, { status: 201 });
  } catch (error) {
    return serverError("Control test create error", error);
  }
});
