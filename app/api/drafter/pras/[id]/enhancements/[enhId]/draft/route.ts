import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { draftOneEnhancement } from "@/lib/drafter/draft-enhancement";

interface RouteContext {
  params: Promise<{ id: string; enhId: string }>;
}

/**
 * POST - drafts ONE enhancement (SPEC.md "Drafting": "one call per
 * enhancement, driven from the browser one request at a time with progress
 * and cost so far, resumable"). The browser calls this once per enhancement
 * in a loop, showing progress after each response - no queue, no batching.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;
  const { enhId } = await context.params;

  const result = await draftOneEnhancement(enhId, actor.email);
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 422 });
  return NextResponse.json({ enhancement: result.enhancement });
}
