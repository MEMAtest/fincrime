import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { saveEditedTemplateVersion } from "@/lib/repo/drafter-templates";
import type { SkeletonFieldLabels, SkeletonSection } from "@/lib/drafter/skeleton";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** POST - saves a further user edit to the skeleton as a new (unconfirmed) template version. */
export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const sections = body?.sections as SkeletonSection[] | undefined;
  const fieldLabels = body?.fieldLabels as SkeletonFieldLabels | undefined;
  if (!Array.isArray(sections) || !fieldLabels) return NextResponse.json({ error: "sections and fieldLabels are required" }, { status: 400 });

  const version = await saveEditedTemplateVersion({ templateId: id, sections, fieldLabels, actor: actor.email });
  return NextResponse.json({ version });
}
