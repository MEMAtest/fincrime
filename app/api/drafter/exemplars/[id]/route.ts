import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { deleteExemplar } from "@/lib/repo/drafter-stylepacks";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * DELETE - removes an Exemplar. Always allowed (see
 * lib/repo/drafter-stylepacks.ts deleteExemplar) - it just drops it from
 * whichever StylePack version's exemplar list it was tagged under.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { id } = await context.params;

  const deleted = await deleteExemplar(id, gate.actor.email);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
