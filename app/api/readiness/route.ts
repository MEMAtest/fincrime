import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/workspace-auth";
import { createReadinessAssessment, listReadinessAssessments, listReadinessSummaries } from "@/lib/repo/readiness";
import {
  ACTOR,
  badRequest,
  isEntityType,
  isIsoDate,
  isJurisdiction,
  isReadinessRiskLevel,
  isReadinessStatus,
  isUuid,
  requirePerson,
  requireProduct,
  serverError,
} from "@/lib/readiness/helpers";

/**
 * GET /api/readiness - list the workspace's readiness assessments, most
 * recent first. Optional ?status= filter, validated against the enum.
 */
export const GET = withWorkspace(async (request, workspace) => {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    if (statusParam !== null && !isReadinessStatus(statusParam)) {
      return badRequest("Invalid status filter");
    }

    const [assessments, summaries] = await Promise.all([
      listReadinessAssessments(workspace.id, { status: statusParam ?? undefined }),
      listReadinessSummaries(workspace.id),
    ]);

    const items = assessments.map((a) => {
      const summary = summaries.get(a.id);
      return {
        id: a.id,
        title: a.title,
        entityType: a.entity_type,
        jurisdiction: a.jurisdiction,
        status: a.status,
        blockerCount: summary?.blockerCount ?? 0,
        unresolvedBlockers: summary?.unresolvedBlockerCount ?? 0,
        coveragePct: summary?.coveragePct ?? 0,
        targetLaunchDate: a.target_launch_date,
        updatedAt: a.updated_at,
      };
    });

    return NextResponse.json({ assessments: items });
  } catch (error) {
    return serverError("Readiness list error", error);
  }
});

/**
 * POST /api/readiness - body {title, entityType, jurisdiction, riskLevel?,
 * productId?, productNote?, targetLaunchDate?, ownerPersonId?}. entityType/
 * jurisdiction are validated against the real data/kyc enums (data/kyc/types.ts);
 * an unauthored (entityType, jurisdiction) pair is still accepted here (it
 * falls back to the FATF/global baseline at generate time, same as the
 * Matrix UI), so creation only rejects values outside the enum itself.
 */
export const POST = withWorkspace(async (request, workspace) => {
  try {
    const body = await request.json();

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return badRequest("Missing required field: title");

    if (!isEntityType(body?.entityType)) return badRequest("Invalid entityType: must be a known KYC entity type");
    const entityType = body.entityType;

    if (!isJurisdiction(body?.jurisdiction)) return badRequest("Invalid jurisdiction: must be a known KYC jurisdiction");
    const jurisdiction = body.jurisdiction;

    let riskLevel: "low" | "medium" | "high" | undefined;
    if (body?.riskLevel !== undefined) {
      if (!isReadinessRiskLevel(body.riskLevel)) return badRequest("Invalid riskLevel: must be low, medium, or high");
      riskLevel = body.riskLevel;
    }

    let productId: string | null = null;
    if (body?.productId !== undefined && body.productId !== null) {
      if (!isUuid(body.productId)) return badRequest("productId must be a valid UUID");
      const product = await requireProduct(workspace.id, body.productId);
      if (!product) return badRequest("Unknown productId for this workspace");
      productId = product.id;
    }

    const productNote = typeof body?.productNote === "string" && body.productNote.trim() ? body.productNote.trim() : null;

    let targetLaunchDate: string | null = null;
    if (body?.targetLaunchDate !== undefined && body.targetLaunchDate !== null) {
      if (!isIsoDate(body.targetLaunchDate)) return badRequest("Invalid targetLaunchDate: must be an ISO date (YYYY-MM-DD)");
      targetLaunchDate = body.targetLaunchDate;
    }

    let ownerPersonId: string | null = null;
    if (body?.ownerPersonId !== undefined && body.ownerPersonId !== null) {
      if (!isUuid(body.ownerPersonId)) return badRequest("ownerPersonId must be a valid UUID");
      const person = await requirePerson(workspace.id, body.ownerPersonId);
      if (!person) return badRequest("Unknown ownerPersonId for this workspace");
      ownerPersonId = person.id;
    }

    const assessment = await createReadinessAssessment(
      workspace.id,
      { title, entityType, jurisdiction, riskLevel, productId, productNote, targetLaunchDate, ownerPersonId },
      ACTOR
    );

    return NextResponse.json({ assessment }, { status: 201 });
  } catch (error) {
    return serverError("Readiness create error", error);
  }
});
