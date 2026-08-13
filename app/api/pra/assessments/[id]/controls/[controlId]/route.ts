import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { deleteAssessmentControl, updateAssessmentControl, type UpdateAssessmentControlInput } from "@/lib/repo/assessments";
import { badRequest,
  instantiateLibraryControl,
  isControlCoverage,
  notFound,
  requireAssessment,
  requireAssessmentControl,
  requireWorkspaceControl,
  serverError,
} from "@/lib/pra/helpers";

interface RouteContext {
  params: Promise<{ id: string; controlId: string }>;
}

/**
 * PATCH /api/pra/assessments/[id]/controls/[controlId] - updates coverage
 * and/or the control link. Supports promoting a reference-only attachment
 * (controlSlug set, workspaceControlId null) to a live control after the
 * fact via { instantiate: true }.
 */
export const PATCH = withWorkspace<RouteContext>(async (request, workspace, context, actor) => {
  try {
    const { id, controlId } = await context.params;
    const assessment = await requireAssessment(workspace.id, id);
    if (!assessment) return notFound("Assessment not found");

    const existing = await requireAssessmentControl(workspace.id, id, controlId);
    if (!existing) return notFound("Control mapping not found");

    const body = await request.json();
    const patch: UpdateAssessmentControlInput = {};

    if (body?.coverage !== undefined) {
      if (!isControlCoverage(body.coverage)) {
        return badRequest("Invalid coverage: must be full, partial, or gap");
      }
      patch.coverage = body.coverage;
    }

    if (body?.controlSlug !== undefined) {
      patch.controlSlug = typeof body.controlSlug === "string" && body.controlSlug ? body.controlSlug : null;
    }

    if (body?.opLoad !== undefined) {
      if (typeof body.opLoad !== "object" || body.opLoad === null || Array.isArray(body.opLoad)) {
        return badRequest("Invalid opLoad: must be an object");
      }
      patch.opLoad = body.opLoad as Record<string, unknown>;
    }

    let instantiated: Awaited<ReturnType<typeof instantiateLibraryControl>> = null;

    if (body?.instantiate === true) {
      const slugToInstantiate = patch.controlSlug ?? existing.control_slug;
      if (!slugToInstantiate) return badRequest("No control_slug to instantiate on this mapping");
      const created = await instantiateLibraryControl(workspace.id, slugToInstantiate, actor);
      if (!created) return badRequest(`Unknown control_slug: ${slugToInstantiate}`);
      instantiated = created;
      patch.workspaceControlId = created.id;
      patch.controlSlug = created.control_slug ?? slugToInstantiate;
    } else if (body?.workspaceControlId !== undefined) {
      if (body.workspaceControlId === null) {
        patch.workspaceControlId = null;
      } else if (typeof body.workspaceControlId === "string") {
        const wc = await requireWorkspaceControl(workspace.id, body.workspaceControlId);
        if (!wc) return badRequest("Unknown workspaceControlId for this workspace");
        patch.workspaceControlId = wc.id;
      } else {
        return badRequest("Invalid workspaceControlId");
      }
    }

    const updated = await updateAssessmentControl(workspace.id, controlId, patch, actor);
    if (!updated) return notFound("Control mapping not found");
    // Include the freshly instantiated live control so the client can update
    // its workspace-controls state without a refetch.
    return NextResponse.json({ control: updated, workspaceControl: instantiated ?? undefined });
  } catch (error) {
    return serverError("PRA control update error", error);
  }
});

/** DELETE /api/pra/assessments/[id]/controls/[controlId] - removes a control mapping. */
export const DELETE = withWorkspace<RouteContext>(async (_request, workspace, context, actor) => {
  try {
    const { id, controlId } = await context.params;
    const assessment = await requireAssessment(workspace.id, id);
    if (!assessment) return notFound("Assessment not found");

    const existing = await requireAssessmentControl(workspace.id, id, controlId);
    if (!existing) return notFound("Control mapping not found");

    const deleted = await deleteAssessmentControl(workspace.id, controlId, actor);
    return NextResponse.json({ success: deleted });
  } catch (error) {
    return serverError("PRA control delete error", error);
  }
});
