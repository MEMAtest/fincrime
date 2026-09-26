import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi, invalidDrafterIds } from "@/lib/drafter/access";
import { getEnhancement, getPra, markControlUsedInPra } from "@/lib/repo/drafter-pras";
import { setAgreedWording } from "@/lib/repo/drafter-controls";
import { createExemplar } from "@/lib/repo/drafter-stylepacks";
import { getSectionById } from "@/lib/repo/drafter-pras";
import { writeDrafterAudit } from "@/lib/repo/drafter-audit";

interface RouteContext {
  params: Promise<{ id: string; enhId: string }>;
}

/**
 * POST {promoteAsExemplar?: boolean} - approves a finished enhancement
 * (SPEC.md "Exemplar promotion": "Approving an enhancement also writes the
 * control's agreed_wording + used_in", "A user can mark a finished,
 * approved enhancement as an exemplar"). Writing agreed_wording is what
 * makes a future "reuse" of the same control draft real text instead of
 * the "[Agreed wording not held for this control]" placeholder (Scope B
 * fix #7).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;
  const { id: praId, enhId } = await context.params;
  const badId = invalidDrafterIds(praId, enhId);
  if (badId) return badId;

  const enhancement = await getEnhancement(enhId);
  if (!enhancement) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const pra = await getPra(praId);
  if (!pra) return NextResponse.json({ error: "PRA not found" }, { status: 404 });
  if (!enhancement.control_text?.trim()) {
    return NextResponse.json({ error: "This enhancement has no control text to approve yet." }, { status: 422 });
  }

  const body = await request.json().catch(() => ({}));
  const promoteAsExemplar = body?.promoteAsExemplar === true;

  for (const controlId of enhancement.control_ids) {
    await setAgreedWording(controlId, enhancement.control_text, actor.email);
    await markControlUsedInPra(controlId, praId);
  }

  let exemplarId: string | null = null;
  if (promoteAsExemplar) {
    const section = await getSectionById(enhancement.section_id);
    const exemplar = await createExemplar({
      stylepackVersionId: pra.stylepack_version_id,
      sectionType: section?.title ?? "General",
      controlText: enhancement.control_text,
      rationale: enhancement.rationale ?? "",
      source: "user_approved",
      sourceDocumentId: null,
      sourcePraId: praId,
      actor: actor.email,
    });
    exemplarId = exemplar.id;
  }

  await writeDrafterAudit(actor.email, "enhancement.approve", "drafter_enhancement", enhId, {
    controlIds: enhancement.control_ids,
    promotedExemplar: exemplarId,
  });

  return NextResponse.json({ ok: true, exemplarId });
}
