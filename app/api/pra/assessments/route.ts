import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createProduct, deleteProduct, listProductsByIds } from "@/lib/repo/products";
import { createAssessment, listAssessments } from "@/lib/repo/assessments";
import { serverError } from "@/lib/pra/helpers";

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

    const productIds = [...new Set(assessments.map((a) => a.product_id))];
    const products = await listProductsByIds(workspace.id, productIds);
    const productById = new Map(products.map((p) => [p.id, p]));

    const items = assessments.map((a) => ({
      id: a.id,
      productId: a.product_id,
      productName: productById.get(a.product_id)?.name ?? "Untitled product",
      status: a.status,
      currentStep: a.current_step,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    }));

    return NextResponse.json({ assessments: items });
  } catch (error) {
    return serverError("PRA assessments list error", error);
  }
});

/**
 * POST /api/pra/assessments - creates the product being assessed and the
 * assessment journey against it (status draft, current_step 1).
 */
export const POST = withWorkspace(async (request, workspace, _context, actor) => {
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
      actor
    );

    let assessment;
    try {
      assessment = await createAssessment(workspace.id, product.id, actor);
    } catch (error) {
      // Compensating cleanup: without it a failed assessment insert strands
      // an orphan product row that no journey ever references.
      await deleteProduct(workspace.id, product.id, actor).catch(() => undefined);
      throw error;
    }

    return NextResponse.json({ product, assessment }, { status: 201 });
  } catch (error) {
    return serverError("PRA assessment create error", error);
  }
});
