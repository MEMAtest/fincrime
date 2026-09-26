import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { createTemplate, listTemplates, listTemplateVersions } from "@/lib/repo/drafter-templates";
import { createExemplar } from "@/lib/repo/drafter-stylepacks";
import type { SkeletonExemplarCandidate, SkeletonFieldLabels, SkeletonSection } from "@/lib/drafter/skeleton";

export async function GET(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const templates = await listTemplates();
  const withVersions = await Promise.all(templates.map(async (t) => ({ template: t, versions: await listTemplateVersions(t.id) })));
  return NextResponse.json({ templates: withVersions });
}

/**
 * POST /api/drafter/templates {documentId, name, sections, fieldLabels, acceptedExemplars?}
 * - sections/fieldLabels are the USER-REVIEWED skeleton (SPEC.md: "A review
 * screen where the user edits/confirms the skeleton ... before it becomes a
 * versioned Template"). Any accepted exemplar candidates the user kept are
 * stored as exemplars tagged by section type, source "template" - this is
 * the only content that ever crosses from the approved PRA into anything
 * else, and it is used as a style reference only (never copied as another
 * product's control text).
 */
export async function POST(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;

  const body = await request.json().catch(() => null);
  const documentId = typeof body?.documentId === "string" ? body.documentId : null;
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "Approved PRA template";
  const sections = body?.sections as SkeletonSection[] | undefined;
  const fieldLabels = body?.fieldLabels as SkeletonFieldLabels | undefined;
  const acceptedExemplars = (body?.acceptedExemplars ?? []) as SkeletonExemplarCandidate[];

  if (!Array.isArray(sections) || sections.length === 0) return NextResponse.json({ error: "sections is required and must be non-empty" }, { status: 400 });
  if (!fieldLabels) return NextResponse.json({ error: "fieldLabels is required" }, { status: 400 });

  const { template, version } = await createTemplate({ sourceDocumentId: documentId, name, sections, fieldLabels, actor: actor.email });

  const exemplars = [];
  for (const candidate of acceptedExemplars) {
    exemplars.push(
      await createExemplar({
        stylepackVersionId: null,
        sectionType: candidate.sectionType,
        controlText: candidate.controlText,
        rationale: candidate.rationale,
        source: "template",
        sourceDocumentId: documentId,
        sourcePraId: null,
        actor: actor.email,
      })
    );
  }

  return NextResponse.json({ template, version, exemplars });
}
