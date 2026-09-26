import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { getEnhancement, getPra, updateEnhancementDraft, recordEnhancementEdit } from "@/lib/repo/drafter-pras";
import { getStylepackVersion } from "@/lib/repo/drafter-stylepacks";
import { lintEnhancement, isPlaceholderOnlyText } from "@/lib/drafter/lint";
import { combineStatus, type JudgeInvalid } from "@/lib/drafter/review-status";
import type { JudgeResult } from "@/lib/drafter/judge";
import { maybeAdvancePraStatus } from "@/lib/drafter/pra-status";

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
  // Saving a manual edit re-runs lint immediately and marks any existing
  // judge result STALE (SPEC.md "Page viewer and editing": "Saving re-runs
  // lint immediately, marks the judge result stale, judge re-run on
  // request") - the previous judge output is kept for reference but never
  // counted as current.
  const existingJudge = (enhancement.review_result?.judge ?? null) as JudgeResult | JudgeInvalid | null;
  const judgeStale = Boolean(existingJudge);
  const needsInput = enhancement.is_gap || isPlaceholderOnlyText(nextControlText) || !nextControlText.trim();
  const status = combineStatus({ lintIssues, judge: existingJudge, judgeStale, needsInput });

  const updated = await updateEnhancementDraft(enhId, {
    controlText,
    rationale,
    reviewResult: { lint: lintIssues, judge: existingJudge, judgeStale, status },
  });
  await maybeAdvancePraStatus(pra.id);

  return NextResponse.json({ enhancement: updated });
}
