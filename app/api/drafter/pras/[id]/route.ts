import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi, invalidDrafterIds } from "@/lib/drafter/access";
import { getPra, listSectionsForPra, listEnhancementsForPra, listOpenItemsForPra, deletePra } from "@/lib/repo/drafter-pras";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET - the PRA draft: sections, enhancements (with lint/review results) and open items. Data shapes here are kept clean deliberately for the full viewer coder 4 builds on top. */
export async function GET(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { id } = await context.params;
  const badId = invalidDrafterIds(id);
  if (badId) return badId;

  const pra = await getPra(id);
  if (!pra) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [sections, enhancements, openItems] = await Promise.all([listSectionsForPra(id), listEnhancementsForPra(id), listOpenItemsForPra(id)]);

  return NextResponse.json({ pra, sections, enhancements, openItems });
}

/**
 * DELETE - removes a PRA and everything scoped to it (prod walkthrough item
 * 5). The UI confirms this with an in-page modal, not window.confirm, before
 * calling it. Audited via deletePra -> writeDrafterAudit("pra.delete").
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { id } = await context.params;
  const badId = invalidDrafterIds(id);
  if (badId) return badId;

  const deleted = await deletePra(id, gate.actor.email);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
