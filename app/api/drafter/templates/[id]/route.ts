import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { listTemplateVersions } from "@/lib/repo/drafter-templates";

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
