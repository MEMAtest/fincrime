import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { confirmTemplateVersion, listTemplateVersions } from "@/lib/repo/drafter-templates";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** POST {versionId} - confirms the given version of this template as usable on a PRA (SPEC.md: becomes a "versioned Template" only once confirmed). */
export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  let versionId = typeof body?.versionId === "string" ? body.versionId : null;
  if (!versionId) {
    const versions = await listTemplateVersions(id);
    versionId = versions[0]?.id ?? null;
  }
  if (!versionId) return NextResponse.json({ error: "No version to confirm" }, { status: 404 });

  const version = await confirmTemplateVersion(versionId, actor.email);
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });
  return NextResponse.json({ version });
}
