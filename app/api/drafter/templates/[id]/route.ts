import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { listTemplateVersions, deleteTemplate } from "@/lib/repo/drafter-templates";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { id } = await context.params;
  const versions = await listTemplateVersions(id);
  if (versions.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ versions });
}

/**
 * DELETE - removes a Template and all its versions. 409 with an explanation
 * if a PRA is pinned to one of its versions (see
 * lib/repo/drafter-templates.ts deleteTemplate).
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { id } = await context.params;

  const result = await deleteTemplate(id, gate.actor.email);
  if (!result.deleted && !result.blockedReason) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (result.blockedReason) return NextResponse.json({ error: result.blockedReason }, { status: 409 });
  return NextResponse.json({ ok: true });
}
