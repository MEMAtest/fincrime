import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { deleteStylepack } from "@/lib/repo/drafter-stylepacks";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * DELETE - removes a StylePack and all its versions. 409 with an
 * explanation if a PRA is pinned to one of its versions (see
 * lib/repo/drafter-stylepacks.ts deleteStylepack).
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { id } = await context.params;

  const result = await deleteStylepack(id, gate.actor.email);
  if (!result.deleted && !result.blockedReason) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (result.blockedReason) return NextResponse.json({ error: result.blockedReason }, { status: 409 });
  return NextResponse.json({ ok: true });
}
