import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { deleteControlTest, listControlTestFindings, updateControlTest, type UpdateControlTestInput } from "@/lib/repo/control-tests";
import { listActionsBySubject } from "@/lib/repo/actions";
import { listEvidenceBySubject } from "@/lib/repo/evidence";
import { requirePerson } from "@/lib/pra/helpers";
import {
  ACTOR,
  SUBJECT_TYPE,
  badRequest,
  conflict,
  isControlTestMethod,
  isFinalTestStatus,
  isIsoDate,
  isUuid,
  notFound,
  parseOptionalCount,
  parseOptionalStep,
  requireControlTest,
  requireTestControl,
  serverError,
} from "@/lib/control-tests/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/control-tests/[id] - full detail: the test, its underlying
 * workspace_control, findings, actions recorded against it, and evidence.
 */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Control test not found");
    const test = await requireControlTest(workspace.id, id);
    if (!test) return notFound("Control test not found");

    const control = await requireTestControl(test);

    const [findings, actions, evidence] = await Promise.all([
      listControlTestFindings(workspace.id, id),
      listActionsBySubject(workspace.id, SUBJECT_TYPE, id),
      listEvidenceBySubject(workspace.id, SUBJECT_TYPE, id),
    ]);

    return NextResponse.json({ test, control, findings, evidence, actions });
  } catch (error) {
    return serverError("Control test detail error", error);
  }
});

/**
 * PATCH /api/control-tests/[id] - partial update: title, method,
 * periodStart, periodEnd, testerPersonId, sampleSize, samplesPassed,
 * samplesFailed, samplesPartial, conclusion, currentStep. A test that is
 * already complete or cancelled is a historical record and 409s on every
 * PATCH.
 */
export const PATCH = withWorkspace<RouteContext>(async (request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Control test not found");
    const existing = await requireControlTest(workspace.id, id);
    if (!existing) return notFound("Control test not found");
    if (isFinalTestStatus(existing.status)) return conflict("Cannot update a test that is already complete or cancelled");

    const body = await request.json();
    const patch: UpdateControlTestInput = {};

    if (body?.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) return badRequest("title must be a non-empty string");
      patch.title = title;
    }

    if (body?.method !== undefined) {
      if (body.method !== null && !isControlTestMethod(body.method)) {
        return badRequest("Invalid method: must be sample, walkthrough, reperformance, data_analysis, other, or null");
      }
      patch.method = body.method;
    }

    const periodStart = body?.periodStart !== undefined ? body.periodStart : undefined;
    if (periodStart !== undefined && periodStart !== null) {
      if (!isIsoDate(periodStart)) return badRequest("Invalid periodStart: must be an ISO date (YYYY-MM-DD) or null");
    }
    if (body?.periodStart !== undefined) patch.periodStart = periodStart;

    const periodEnd = body?.periodEnd !== undefined ? body.periodEnd : undefined;
    if (periodEnd !== undefined && periodEnd !== null) {
      if (!isIsoDate(periodEnd)) return badRequest("Invalid periodEnd: must be an ISO date (YYYY-MM-DD) or null");
    }
    if (body?.periodEnd !== undefined) patch.periodEnd = periodEnd;

    const effectiveStart = body?.periodStart !== undefined ? periodStart : existing.period_start;
    const effectiveEnd = body?.periodEnd !== undefined ? periodEnd : existing.period_end;
    if (effectiveStart && effectiveEnd && effectiveStart > effectiveEnd) {
      return badRequest("periodStart must not be after periodEnd");
    }

    if (body?.testerPersonId !== undefined) {
      if (body.testerPersonId === null) {
        patch.testerPersonId = null;
      } else {
        if (!isUuid(body.testerPersonId)) return badRequest("testerPersonId must be a valid UUID or null");
        const person = await requirePerson(workspace.id, body.testerPersonId);
        if (!person) return badRequest("Unknown testerPersonId for this workspace");
        patch.testerPersonId = person.id;
      }
    }

    if (body?.sampleSize !== undefined) {
      const parsed = parseOptionalCount(body.sampleSize);
      if (!parsed.ok) return badRequest("Invalid sampleSize: must be a non-negative integer (max 100000) or null");
      patch.sampleSize = parsed.value;
    }
    if (body?.samplesPassed !== undefined) {
      const parsed = parseOptionalCount(body.samplesPassed);
      if (!parsed.ok) return badRequest("Invalid samplesPassed: must be a non-negative integer (max 100000) or null");
      patch.samplesPassed = parsed.value;
    }
    if (body?.samplesFailed !== undefined) {
      const parsed = parseOptionalCount(body.samplesFailed);
      if (!parsed.ok) return badRequest("Invalid samplesFailed: must be a non-negative integer (max 100000) or null");
      patch.samplesFailed = parsed.value;
    }
    if (body?.samplesPartial !== undefined) {
      const parsed = parseOptionalCount(body.samplesPartial);
      if (!parsed.ok) return badRequest("Invalid samplesPartial: must be a non-negative integer (max 100000) or null");
      patch.samplesPartial = parsed.value;
    }

    // Cross-field: the denominator actually scored is passed+failed+partial,
    // but a tester also records a stated sampleSize up front. If the
    // resulting row would have both set, the recorded counts must not exceed
    // the stated sample size - otherwise a tester could record e.g. sample
    // size 10 and then rack up 999 passes, which would score (and rate) the
    // test on a denominator nobody actually sampled. Exact reconciliation
    // (counts must equal sampleSize, not just not exceed it) is enforced at
    // completion time in completeControlTest, once all counts are final;
    // here we only reject counts that are already impossible.
    const effectiveSampleSize = "sampleSize" in patch ? patch.sampleSize : existing.sample_size;
    const effectivePassed = "samplesPassed" in patch ? patch.samplesPassed : existing.samples_passed;
    const effectiveFailed = "samplesFailed" in patch ? patch.samplesFailed : existing.samples_failed;
    const effectivePartial = "samplesPartial" in patch ? patch.samplesPartial : existing.samples_partial;
    if (typeof effectiveSampleSize === "number") {
      const recordedTotal = (effectivePassed ?? 0) + (effectiveFailed ?? 0) + (effectivePartial ?? 0);
      if (recordedTotal > effectiveSampleSize) {
        return badRequest("samplesPassed + samplesFailed + samplesPartial must not exceed sampleSize");
      }
    }

    if (body?.conclusion !== undefined) {
      patch.conclusion = typeof body.conclusion === "string" && body.conclusion.trim() ? body.conclusion.trim() : null;
    }

    if (body?.currentStep !== undefined) {
      const parsed = parseOptionalStep(body.currentStep);
      if (!parsed.ok) return badRequest("Invalid currentStep: must be an integer between 1 and 5");
      if (typeof parsed.value === "number") patch.currentStep = parsed.value;
    }

    if (body?.status !== undefined) {
      if (body.status !== "planned" && body.status !== "in_progress") {
        return badRequest(
          "Invalid status: PATCH only supports planned or in_progress; 'complete' is only reachable via the complete endpoint"
        );
      }
      patch.status = body.status;
    }

    const updated = await updateControlTest(workspace.id, id, patch, ACTOR);
    if (!updated) return notFound("Control test not found");

    return NextResponse.json({ test: updated });
  } catch (error) {
    return serverError("Control test update error", error);
  }
});

/** DELETE /api/control-tests/[id] - refuses on a complete or cancelled test: deleting a historical record would cascade its findings away while the control keeps its bumped version with nothing left explaining it. */
export const DELETE = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Control test not found");
    const existing = await requireControlTest(workspace.id, id);
    if (!existing) return notFound("Control test not found");
    if (isFinalTestStatus(existing.status)) return conflict("Cannot delete a test that is already complete or cancelled");

    await deleteControlTest(workspace.id, id, ACTOR);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError("Control test delete error", error);
  }
});
