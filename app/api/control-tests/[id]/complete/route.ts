import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { completeControlTest } from "@/lib/repo/control-tests";
import { ACTOR, conflict, notFound, requireControlTest, serverError } from "@/lib/control-tests/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/control-tests/[id]/complete - runs completeControlTest: recomputes
 * result + rating from the stored counts and findings, writes
 * effectiveness_rating / last_tested_at / next_test_due onto the underlying
 * workspace_control (version-bumping and snapshotting it), and stamps the
 * test 'complete'. 409 if the test is already complete or cancelled.
 */
export const POST = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    const test = await requireControlTest(workspace.id, id);
    if (!test) return notFound("Control test not found");

    const result = await completeControlTest(workspace.id, id, ACTOR);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Control test or workspace control not found");
      return conflict("Control test is already complete or cancelled");
    }

    return NextResponse.json({ test: result.test, control: result.control });
  } catch (error) {
    return serverError("Control test complete error", error);
  }
});
