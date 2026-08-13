import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createAssessmentControl, listAssessmentControls, type CreateAssessmentControlInput } from "@/lib/repo/assessments";
import { badRequest,
  instantiateLibraryControl,
  isControlCoverage,
  notFound,
  requireAssessment,
  requireAssessmentRisk,
  requireWorkspaceControl,
  serverError,
} from "@/lib/pra/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/pra/assessments/[id]/controls - list the control map for an assessment. */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    const assessment = await requireAssessment(workspace.id, id);
    if (!assessment) return notFound("Assessment not found");

    const controls = await listAssessmentControls(workspace.id, id);
    return NextResponse.json({ controls });
  } catch (error) {
    return serverError("PRA controls list error", error);
  }
});

/**
 * POST /api/pra/assessments/[id]/controls - attaches a control to a risk.
 * Three ways to identify the control:
 *   - instantiate: true + controlSlug -> creates a live workspace_controls
 *     row seeded from the library entry, then links it
 *   - workspaceControlId -> attaches an existing live control (verified to
 *     belong to this workspace)
 *   - controlSlug alone -> a reference-only attachment to the library entry,
 *     with no live workspace_controls row (yet)
 */
export const POST = withWorkspace<RouteContext>(async (request, workspace, context, actor) => {
  try {
    const { id } = await context.params;
    const assessment = await requireAssessment(workspace.id, id);
    if (!assessment) return notFound("Assessment not found");

    const body = await request.json();
    const riskId = typeof body?.riskId === "string" ? body.riskId : "";
    if (!riskId) return badRequest("Missing required field: riskId");

    const risk = await requireAssessmentRisk(workspace.id, id, riskId);
    if (!risk) return notFound("Risk not found on this assessment");

    if (!isControlCoverage(body?.coverage)) {
      return badRequest("Missing or invalid coverage: must be full, partial, or gap");
    }

    const controlSlug = typeof body?.controlSlug === "string" && body.controlSlug ? body.controlSlug : null;
    let workspaceControlId: string | null = null;

    let instantiated: Awaited<ReturnType<typeof instantiateLibraryControl>> = null;

    if (body?.instantiate === true) {
      if (!controlSlug) return badRequest("controlSlug is required to instantiate a control");
      const created = await instantiateLibraryControl(workspace.id, controlSlug, actor);
      if (!created) return badRequest(`Unknown control_slug: ${controlSlug}`);
      instantiated = created;
      workspaceControlId = created.id;
    } else if (typeof body?.workspaceControlId === "string" && body.workspaceControlId) {
      const existing = await requireWorkspaceControl(workspace.id, body.workspaceControlId);
      if (!existing) return badRequest("Unknown workspaceControlId for this workspace");
      workspaceControlId = existing.id;
    }

    const input: CreateAssessmentControlInput = {
      riskId,
      workspaceControlId,
      controlSlug,
      coverage: body.coverage,
    };

    const control = await createAssessmentControl(workspace.id, id, input, actor);
    // Include the freshly instantiated live control so the client can update
    // its workspace-controls state without a refetch.
    return NextResponse.json({ control, workspaceControl: instantiated ?? undefined }, { status: 201 });
  } catch (error) {
    return serverError("PRA control create error", error);
  }
});
