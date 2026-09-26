import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi, invalidDrafterIds } from "@/lib/drafter/access";
import { decideMergeGroup } from "@/lib/repo/drafter-controls";

interface RouteContext {
  params: Promise<{ groupId: string }>;
}

/** POST /api/drafter/library/merge-groups/[groupId] - body { action: "confirm" | "split" | "reject" }. */
export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { groupId } = await context.params;
  const badId = invalidDrafterIds(groupId);
  if (badId) return badId;

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body { action }" }, { status: 400 });
  }
  if (body.action !== "confirm" && body.action !== "split" && body.action !== "reject") {
    return NextResponse.json({ error: 'action must be "confirm", "split" or "reject"' }, { status: 400 });
  }

  const statusByAction = { confirm: "confirmed", split: "split", reject: "rejected" } as const;
  const group = await decideMergeGroup(groupId, statusByAction[body.action], gate.actor.email);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ group });
}
