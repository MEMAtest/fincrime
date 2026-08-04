import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createProduct, deleteProduct, getProduct } from "@/lib/repo/products";
import { createAssessment, listAssessments } from "@/lib/repo/assessments";
import { ACTOR, serverError } from "@/lib/pra/helpers";

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((v): v is string => typeof v === "string");
}

/**
 * GET /api/pra/assessments - list the workspace's Product Risk Assessments,
 * one row per assessment with its product name for the list page.
 */
export const GET = withWorkspace(async (_request, workspace) => {
  try {
    const assessments = await listAssessments(workspace.id);

    const items = await Promise.all(
      assessments.map(async (a) => {
        const product = await getProduct(workspace.id, a.product_id);
        return {
          id: a.id,
          productId: a.product_id,
          productName: product?.name ?? "Untitled product",
          status: a.status,
          currentStep: a.current_step,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
        };
      })
    );

    return NextResponse.json({ assessments: items });
  } catch (error) {
    return serverError("PRA assessments list error", error);
  }
});

/**
 * POST /api/pra/assessments - creates the product being assessed and the
 * assessment journey against it (status draft, current_step 1).
 */
export const POST = withWorkspace(async (request, workspace) => {
  try {
    const body = await request.json();
    const productName = typeof body?.productName === "string" ? body.productName.trim() : "";

    if (!productName) {
      return NextResponse.json({ error: "Missing required field: productName" }, { status: 400 });
    }

    const description =
      typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;

    const product = await createProduct(
      workspace.id,
      {
        name: productName,
        description,
        customers: asStringArray(body?.customers) ?? [],
        jurisdictions: asStringArray(body?.jurisdictions) ?? [],
        channels: asStringArray(body?.channels) ?? [],
      },
      ACTOR
    );

    let assessment;
    try {
      assessment = await createAssessment(workspace.id, product.id, ACTOR);
    } catch (error) {
      // Compensating cleanup: without it a failed assessment insert strands
      // an orphan product row that no journey ever references.
      await deleteProduct(workspace.id, product.id, ACTOR).catch(() => undefined);
      throw error;
    }

    return NextResponse.json({ product, assessment }, { status: 201 });
  } catch (error) {
    return serverError("PRA assessment create error", error);
  }
});
