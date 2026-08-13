import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { getProduct, updateProduct, type UpdateProductInput } from "@/lib/repo/products";
import { listAssessmentRisks, listAssessmentControls, updateAssessment, type UpdateAssessmentInput } from "@/lib/repo/assessments";
import { badRequest,
  isAppetiteResult,
  isAssessmentStatus,
  notFound,
  parseOptionalStep,
  requireAssessment,
  serverError,
} from "@/lib/pra/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((v): v is string => typeof v === "string");
}

/** GET /api/pra/assessments/[id] - full detail: assessment + product + risks + controls. */
export const GET = withWorkspace<RouteContext>(async (_request, workspace, context) => {
  try {
    const { id } = await context.params;
    const assessment = await requireAssessment(workspace.id, id);
    if (!assessment) return notFound("Assessment not found");

    const [product, risks, controls] = await Promise.all([
      getProduct(workspace.id, assessment.product_id),
      listAssessmentRisks(workspace.id, id),
      listAssessmentControls(workspace.id, id),
    ]);

    return NextResponse.json({ assessment, product, risks, controls });
  } catch (error) {
    return serverError("PRA assessment detail error", error);
  }
});

/**
 * PATCH /api/pra/assessments/[id] - partial update. Body may carry product
 * fields (name/description/customers/jurisdictions/channels/flows) and/or
 * assessment fields (currentStep/status), all optional and applied together
 * in one call so the journey shell can save-on-step-change in a single round
 * trip.
 */
export const PATCH = withWorkspace<RouteContext>(async (request, workspace, context, actor) => {
  try {
    const { id } = await context.params;
    const assessment = await requireAssessment(workspace.id, id);
    if (!assessment) return notFound("Assessment not found");

    const body = await request.json();

    const productPatch: UpdateProductInput = {};
    if (typeof body?.name === "string" && body.name.trim()) productPatch.name = body.name.trim();
    if (body?.description !== undefined) {
      productPatch.description =
        typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
    }
    const customers = asStringArray(body?.customers);
    if (customers) productPatch.customers = customers;
    const jurisdictions = asStringArray(body?.jurisdictions);
    if (jurisdictions) productPatch.jurisdictions = jurisdictions;
    const channels = asStringArray(body?.channels);
    if (channels) productPatch.channels = channels;
    if (Array.isArray(body?.flows)) productPatch.flows = body.flows;

    let product = await getProduct(workspace.id, assessment.product_id);
    if (Object.keys(productPatch).length > 0) {
      product = await updateProduct(workspace.id, assessment.product_id, productPatch, actor);
    }

    const assessmentPatch: UpdateAssessmentInput = {};
    if (body?.status !== undefined) {
      if (!isAssessmentStatus(body.status)) {
        return badRequest("Invalid status: must be draft, in_review, approved, rejected, or conditions_applied");
      }
      assessmentPatch.status = body.status;
    }
    if (body?.currentStep !== undefined) {
      const parsed = parseOptionalStep(body.currentStep);
      if (!parsed.ok) return badRequest("Invalid currentStep: must be an integer between 1 and 8");
      if (typeof parsed.value === "number") assessmentPatch.currentStep = parsed.value;
    }
    if (body?.recommendation !== undefined) {
      assessmentPatch.recommendation =
        typeof body.recommendation === "string" && body.recommendation.trim() ? body.recommendation.trim() : null;
    }
    if (body?.residualSummary !== undefined) {
      if (typeof body.residualSummary !== "object" || body.residualSummary === null || Array.isArray(body.residualSummary)) {
        return badRequest("Invalid residualSummary: must be an object");
      }
      assessmentPatch.residualSummary = body.residualSummary as Record<string, unknown>;
    }
    if (body?.appetiteResult !== undefined) {
      if (body.appetiteResult !== null && !isAppetiteResult(body.appetiteResult)) {
        return badRequest("Invalid appetiteResult: must be within, tolerated, outside, or null");
      }
      assessmentPatch.appetiteResult = body.appetiteResult;
    }

    let updatedAssessment = assessment;
    if (Object.keys(assessmentPatch).length > 0) {
      const result = await updateAssessment(workspace.id, id, assessmentPatch, actor);
      if (result) updatedAssessment = result;
    }

    return NextResponse.json({ assessment: updatedAssessment, product });
  } catch (error) {
    return serverError("PRA assessment update error", error);
  }
});
