import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { getPra, listSectionsForPra, listEnhancementsForPra, listOpenItemsForPra } from "@/lib/repo/drafter-pras";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET - the PRA draft: sections, enhancements (with lint/review results) and open items. Data shapes here are kept clean deliberately for the full viewer coder 4 builds on top. */
export async function GET(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { id } = await context.params;

  const pra = await getPra(id);
  if (!pra) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [sections, enhancements, openItems] = await Promise.all([listSectionsForPra(id), listEnhancementsForPra(id), listOpenItemsForPra(id)]);

  return NextResponse.json({ pra, sections, enhancements, openItems });
}
