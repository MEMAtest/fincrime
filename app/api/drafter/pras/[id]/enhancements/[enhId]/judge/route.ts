import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { judgeOneEnhancement } from "@/lib/drafter/judge-runner";

interface RouteContext {
  params: Promise<{ id: string; enhId: string }>;
}

/**
 * POST - runs the judge model against ONE enhancement's current control
 * text/rationale (SPEC.md "Reviewer": "one call per enhancement", "judge
 * re-run on request"). Driven from the browser one enhancement per request,
 * same pattern as the draft endpoint.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;
  const { enhId } = await context.params;

  const result = await judgeOneEnhancement(enhId, actor.email);
  if (!result.ok) return NextResponse.json({ error: result.reason, enhancement: result.enhancement }, { status: 422 });
  return NextResponse.json({ enhancement: result.enhancement });
}
