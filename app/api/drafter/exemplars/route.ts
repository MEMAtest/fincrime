import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { createExemplar, listExemplars } from "@/lib/repo/drafter-stylepacks";

export async function GET(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const exemplars = await listExemplars();
  return NextResponse.json({ exemplars });
}

/**
 * POST - creates a user-approved exemplar (SPEC.md: "A user can mark a
 * finished, approved enhancement as an exemplar. It then joins the style
 * set for future drafts."). Also used by app/api/drafter/templates for
 * exemplars accepted straight from skeleton extraction (source: "template").
 */
export async function POST(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;

  const body = await request.json().catch(() => null);
  const sectionType = typeof body?.sectionType === "string" ? body.sectionType : null;
  const controlText = typeof body?.controlText === "string" ? body.controlText : null;
  const rationale = typeof body?.rationale === "string" ? body.rationale : null;
  const source = body?.source === "template" ? "template" : "user_approved";
  if (!sectionType || !controlText || !rationale) {
    return NextResponse.json({ error: "sectionType, controlText and rationale are required" }, { status: 400 });
  }

  const exemplar = await createExemplar({
    stylepackVersionId: typeof body?.stylepackVersionId === "string" ? body.stylepackVersionId : null,
    sectionType,
    controlText,
    rationale,
    source,
    sourceDocumentId: typeof body?.sourceDocumentId === "string" ? body.sourceDocumentId : null,
    sourcePraId: typeof body?.sourcePraId === "string" ? body.sourcePraId : null,
    actor: actor.email,
  });

  return NextResponse.json({ exemplar });
}
