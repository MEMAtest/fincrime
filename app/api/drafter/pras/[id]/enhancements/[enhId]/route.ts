import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi, invalidDrafterIds } from "@/lib/drafter/access";
import { getEnhancement, getPra, saveEnhancementEdit, createOpenItem } from "@/lib/repo/drafter-pras";
import { getStylepackVersion } from "@/lib/repo/drafter-stylepacks";
import { lintEnhancement, isPlaceholderOnlyText } from "@/lib/drafter/lint";
import { combineStatus, type JudgeInvalid } from "@/lib/drafter/review-status";
import type { JudgeResult } from "@/lib/drafter/judge";
import { maybeAdvancePraStatus } from "@/lib/drafter/pra-status";
import { flagUnsupportedEditTerms } from "@/lib/drafter/edit-fact-boundary";

interface RouteContext {
  params: Promise<{ id: string; enhId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { enhId } = await context.params;
  const badId = invalidDrafterIds(enhId);
  if (badId) return badId;
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
  const badId = invalidDrafterIds(enhId);
  if (badId) return badId;

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

  const edits: { field: "control_text" | "rationale"; previousValue: string | null; newValue: string | null; editType: "manual" | "apply_fix"; actor: string }[] = [];
  if (controlText !== undefined && controlText !== enhancement.control_text) {
    edits.push({ field: "control_text", previousValue: enhancement.control_text, newValue: controlText, editType, actor: actor.email });
  }
  if (rationale !== undefined && rationale !== enhancement.rationale) {
    edits.push({ field: "rationale", previousValue: enhancement.rationale, newValue: rationale, editType, actor: actor.email });
  }

  const nextControlText = controlText ?? enhancement.control_text ?? "";
  const nextRationale = rationale ?? enhancement.rationale ?? "";
  const lintIssues = lintEnhancement({
    controlText: nextControlText,
    rationale: nextRationale,
    wordLimits: { min: stylepackVersion.length_limits.min_words, max: stylepackVersion.length_limits.max_words },
    bannedPhrases: stylepackVersion.banned_phrases,
  });
  // Saving a manual edit re-runs lint immediately and marks any existing
  // judge result STALE (SPEC.md "Page viewer and editing": "Saving re-runs
  // lint immediately, marks the judge result stale, judge re-run on
  // request") - the previous judge output is kept for reference but never
  // counted as current.
  // SAFETY: an edit that came from Apply fix pasted a judge-suggested
  // rewrite into the box, so it is re-checked against the fact boundary on
  // save (the same inputs the enhancement was drafted from) - never
  // silently. A manual edit stays the user's own responsibility for its
  // wording (BUILD-DECISIONS/SPEC.md), but it is still checked so any new
  // unsupported term is flagged as an open item rather than disappearing.
  // This never rewrites what the user just saved - only flags.
  if (editType === "apply_fix") {
    const descriptions = await flagUnsupportedEditTerms(edits, enhancement, pra, editType);
    for (const description of descriptions) {
      await createOpenItem({ praId: pra.id, enhancementId: enhId, itemType: "unsupported_term", description });
    }
  }

  const existingJudge = (enhancement.review_result?.judge ?? null) as JudgeResult | JudgeInvalid | null;
  const judgeStale = Boolean(existingJudge);
  const needsInput = enhancement.is_gap || isPlaceholderOnlyText(nextControlText) || !nextControlText.trim();
  const status = combineStatus({ lintIssues, judge: existingJudge, judgeStale, needsInput });

  // Edit-history rows and the persisted text are written in one transaction
  // (saveEnhancementEdit) so a save can never half-apply: either the edit
  // history and the new control_text/rationale both commit, or neither does
  // and this route returns a real error the client surfaces, instead of the
  // silent "looks saved until the next reload" failure mode.
  let updated;
  try {
    updated = await saveEnhancementEdit({
      enhancementId: enhId,
      edits,
      draft: { controlText, rationale, reviewResult: { lint: lintIssues, judge: existingJudge, judgeStale, status } },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save this edit.";
    return NextResponse.json({ error: `Save failed: ${message}` }, { status: 500 });
  }
  await maybeAdvancePraStatus(pra.id);

  return NextResponse.json({ enhancement: updated });
}
