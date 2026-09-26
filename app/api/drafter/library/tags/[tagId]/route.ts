import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { confirmTag, rejectTag } from "@/lib/repo/drafter-controls";

interface RouteContext {
  params: Promise<{ tagId: string }>;
}

/** POST /api/drafter/library/tags/[tagId] - body { action: "confirm" | "reject" }. Only confirmed tags are used for matching (SPEC.md). */
export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { tagId } = await context.params;

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body { action }" }, { status: 400 });
  }

  if (body.action === "confirm") {
    const tag = await confirmTag(tagId, gate.actor.email);
    if (!tag) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ tag });
  }
  if (body.action === "reject") {
    await rejectTag(tagId, gate.actor.email);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'action must be "confirm" or "reject"' }, { status: 400 });
}
