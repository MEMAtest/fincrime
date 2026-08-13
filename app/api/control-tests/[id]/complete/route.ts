import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { completeControlTest } from "@/lib/repo/control-tests";
import { conflict, isUuid, notFound, requireControlTest, serverError } from "@/lib/control-tests/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/control-tests/[id]/complete - runs completeControlTest: recomputes
 * result + rating from the stored counts and findings, writes
 * effectiveness_rating / last_tested_at / next_test_due onto the underlying
 * workspace_control (version-bumping and snapshotting it), and stamps the
 * test 'complete'. 409 if the test is already complete or cancelled, if no
 * samples were ever recorded (completing would otherwise wipe the control's
 * rating to not_assessed with nothing to show for it), or if the recorded
 * counts don't reconcile with the stated sample size.
 */
export const POST = withWorkspace<RouteContext>(async (_request, workspace, context, actor) => {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return notFound("Control test not found");
    const test = await requireControlTest(workspace.id, id);
    if (!test) return notFound("Control test not found");

    const result = await completeControlTest(workspace.id, id, actor);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound("Control test or workspace control not found");
      if (result.reason === "no_samples") return conflict("Record samples before completing this test");
      if (result.reason === "counts_mismatch") {
        return conflict("Counts do not reconcile with the stated sample size");
      }
      return conflict("Control test is already complete or cancelled");
    }

    return NextResponse.json({ test: result.test, control: result.control });
  } catch (error) {
    return serverError("Control test complete error", error);
  }
});
