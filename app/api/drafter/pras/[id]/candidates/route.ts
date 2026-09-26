import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi, invalidDrafterIds } from "@/lib/drafter/access";
import { listCandidateControls, getPra, assignControlsAndCreateEnhancements, addManualGap, getControlSourceFields } from "@/lib/repo/drafter-pras";
import { getTemplateVersion } from "@/lib/repo/drafter-templates";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET - candidate controls grouped reuse/adapt/new/unassessed, with where-used-before and last approved wording (SPEC.md "Start a PRA"). */
export async function GET(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { id } = await context.params;
  const badId = invalidDrafterIds(id);
  if (badId) return badId;
  const pra = await getPra(id);
  if (!pra) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const candidates = await listCandidateControls();
  const grouped = {
    reuse: candidates.filter((c) => c.group === "reuse"),
    adapt: candidates.filter((c) => c.group === "adapt"),
    new: candidates.filter((c) => c.group === "new"),
    unassessed: candidates.filter((c) => c.group === "unassessed"),
  };
  return NextResponse.json({ grouped });
}

interface GapInput {
  description: string;
  sectionNumber: string;
  backofficeControlLabel?: string;
}

/**
 * POST {selectedControlIds: string[], gaps?: GapInput[]} - the user's ticks
 * and confirmed merges (SPEC.md "Start a PRA" + "Drafting" code steps 1-2).
 * Assigns each selected control to a section by back office control and the
 * PRA's customer types, and adds any manually-entered gaps as placeholder
 * enhancements (never model text).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;
  const { id } = await context.params;
  const badId = invalidDrafterIds(id);
  if (badId) return badId;

  const pra = await getPra(id);
  if (!pra) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const templateVersion = await getTemplateVersion(pra.template_version_id);
  if (!templateVersion) return NextResponse.json({ error: "Template version for this PRA was not found." }, { status: 500 });

  const body = await request.json().catch(() => null);
  const selectedControlIds = Array.isArray(body?.selectedControlIds) ? (body.selectedControlIds as string[]) : [];
  const gaps = Array.isArray(body?.gaps) ? (body.gaps as GapInput[]) : [];

  const allCandidates = await listCandidateControls();
  const byId = new Map(allCandidates.map((c) => [c.id, c]));
  const selected = selectedControlIds
    .map((cid) => byId.get(cid))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .filter((c) => c.group !== "unassessed"); // SPEC.md: unassessed is excluded until the user sets a value

  const sourceFieldsByControlId: Record<string, Awaited<ReturnType<typeof getControlSourceFields>>> = {};
  for (const c of selected) {
    sourceFieldsByControlId[c.id] = await getControlSourceFields(c.id);
  }

  const assignment = await assignControlsAndCreateEnhancements({
    praId: id,
    sections: templateVersion.sections,
    controls: selected.map((c) => ({ id: c.id, backofficeControl: c.backofficeControl, customerType: c.customerType, coverage: c.coverage })),
    sourceFieldsByControlId,
    praCustomerTypes: pra.customer_types,
    actor: actor.email,
  });

  const createdGaps = [];
  for (const gap of gaps) {
    if (!gap.description?.trim() || !gap.sectionNumber?.trim()) continue;
    createdGaps.push(
      await addManualGap({ praId: id, sectionNumber: gap.sectionNumber, description: gap.description, backofficeControlLabel: gap.backofficeControlLabel ?? null, actor: actor.email })
    );
  }

  return NextResponse.json({ assignment, createdGaps });
}
