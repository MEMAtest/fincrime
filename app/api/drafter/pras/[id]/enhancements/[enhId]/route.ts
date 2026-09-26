import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { getEnhancement, getPra, updateEnhancementDraft, recordEnhancementEdit } from "@/lib/repo/drafter-pras";
import { getStylepackVersion } from "@/lib/repo/drafter-stylepacks";
import { lintEnhancement, lintStatus } from "@/lib/drafter/lint";

interface RouteContext {
  params: Promise<{ id: string; enhId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { enhId } = await context.params;
  const enhancement = await getEnhancement(enhId);
  if (!enhancement) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ enhancement });
}

/**
 * PATCH {controlText?, rationale?} - manual edit in the page viewer.
 * SPEC.md "Page viewer and editing": "Saving an edit re-runs lint
 * immediately". Every edit is recorded (drafter_enhancement_edits) with the
 * previous value, for the source-view/audit trail.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;
  const { enhId } = await context.params;

  const enhancement = await getEnhancement(enhId);
  if (!enhancement) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const pra = await getPra(enhancement.pra_id);
  if (!pra) return NextResponse.json({ error: "PRA not found" }, { status: 404 });
  const stylepackVersion = await getStylepackVersion(pra.stylepack_version_id);
  if (!stylepackVersion) return NextResponse.json({ error: "StylePack version not found" }, { status: 500 });

  const body = await request.json().catch(() => null);
  const controlText = typeof body?.controlText === "string" ? body.controlText : undefined;
  const rationale = typeof body?.rationale === "string" ? body.rationale : undefined;
  const editType = body?.editType === "apply_fix" ? "apply_fix" : "manual";

  if (controlText === undefined && rationale === undefined) {
    return NextResponse.json({ error: "controlText and/or rationale is required" }, { status: 400 });
  }

  if (controlText !== undefined && controlText !== enhancement.control_text) {
    await recordEnhancementEdit({ enhancementId: enhId, field: "control_text", previousValue: enhancement.control_text, newValue: controlText, editType, actor: actor.email });
  }
  if (rationale !== undefined && rationale !== enhancement.rationale) {
    await recordEnhancementEdit({ enhancementId: enhId, field: "rationale", previousValue: enhancement.rationale, newValue: rationale, editType, actor: actor.email });
  }

  const nextControlText = controlText ?? enhancement.control_text ?? "";
  const nextRationale = rationale ?? enhancement.rationale ?? "";
  const lintIssues = lintEnhancement({
    controlText: nextControlText,
    rationale: nextRationale,
    wordLimits: { min: stylepackVersion.length_limits.min_words, max: stylepackVersion.length_limits.max_words },
    bannedPhrases: stylepackVersion.banned_phrases,
  });
  const status = lintStatus(lintIssues);

  const updated = await updateEnhancementDraft(enhId, {
    controlText,
    rationale,
    reviewResult: { lint: lintIssues, status },
  });

  return NextResponse.json({ enhancement: updated });
}
