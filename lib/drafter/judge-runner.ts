/**
 * Drives the judge step for one enhancement (SPEC.md "Reviewer" - judge
 * model). Mirrors draft-enhancement.ts's split: pure logic lives in
 * lib/drafter/judge.ts, this file composes it with the repo layer and the
 * model provider.
 */
import { callDrafterModel, isUnderCostCap, PROMPT_VERSIONS, formatCostCapMessage } from "./llm";
import { buildJudgePrompt, buildJudgeRepairPrompt, buildJudgeJsonSchema, validateJudgeOutput, type JudgeResult } from "./judge";
import { combineStatus } from "./review-status";
import { isPlaceholderOnlyText } from "./lint";
import {
  getEnhancement,
  getPra,
  getSectionById,
  updateEnhancementReview,
  type DrafterEnhancementRow,
} from "@/lib/repo/drafter-pras";
import { getStylepackVersion } from "@/lib/repo/drafter-stylepacks";
import { writeDrafterAudit } from "@/lib/repo/drafter-audit";
import { maybeAdvancePraStatus } from "./pra-status";

export interface JudgeRunResult {
  ok: boolean;
  enhancement?: DrafterEnhancementRow;
  reason?: string;
}

/**
 * Runs the judge against an enhancement's CURRENT control_text/rationale.
 * Lint must already have been run (it is, by draft/PATCH). A malformed or
 * invalid judge response never overwrites a previous judge result with a
 * fake pass - it records the error and the enhancement stays whatever its
 * lint-only status was, per BUILD-DECISIONS "absence must never render as a
 * pass".
 */
export async function judgeOneEnhancement(enhancementId: string, actor: string): Promise<JudgeRunResult> {
  const enhancement = await getEnhancement(enhancementId);
  if (!enhancement) return { ok: false, reason: "Enhancement not found." };
  if (!enhancement.control_text?.trim()) return { ok: false, reason: "This enhancement has not been drafted yet." };

  const pra = await getPra(enhancement.pra_id);
  if (!pra) return { ok: false, reason: "PRA not found." };
  const section = await getSectionById(enhancement.section_id);
  if (!section) return { ok: false, reason: "Section not found." };
  const stylepackVersion = await getStylepackVersion(pra.stylepack_version_id);
  if (!stylepackVersion) return { ok: false, reason: "StylePack version not found." };

  const capCheck = await isUnderCostCap(pra.id);
  if (!capCheck.underCap) {
    return { ok: false, reason: `Cost cap reached for this PRA (${formatCostCapMessage(capCheck)}). No further model calls will be made.` };
  }

  const controlText = enhancement.control_text ?? "";
  const rationale = enhancement.rationale ?? "";
  const judgedText = `${controlText}\n${rationale}`;
  const existingLint = enhancement.review_result?.lint ?? [];
  const needsInput = enhancement.is_gap || isPlaceholderOnlyText(controlText);

  const prompt = buildJudgePrompt({
    controlText,
    rationale,
    sectionTitle: `${section.section_number} ${section.title}`,
    styleRules: stylepackVersion.rules,
  });

  const jsonSchema = buildJudgeJsonSchema();
  const call = await callDrafterModel({
    role: "judge",
    promptVersion: PROMPT_VERSIONS.judge_rubric,
    systemPrompt: prompt.system,
    userPrompt: prompt.user,
    temperature: 0,
    praId: pra.id,
    enhancementId: enhancement.id,
    jsonSchema,
  });

  if (!call.ok) {
    const judge = { error: call.error, invalid: true as const };
    const updated = await updateEnhancementReview(enhancement.id, {
      reviewResult: { lint: existingLint, judge, judgeStale: false, status: combineStatus({ lintIssues: existingLint, judge, judgeStale: false, needsInput }) },
    });
    await writeDrafterAudit(actor, "enhancement.judge.error", "drafter_enhancement", enhancement.id, { error: call.error });
    return { ok: false, reason: call.error, enhancement: updated };
  }

  let validated = validateJudgeOutput(call.json, judgedText);
  let finalCall = call;
  let repaired = false;

  // One repair round (never more): the first invalid response is shown back
  // to the model with the specific validation error and it is asked to
  // return the complete corrected JSON. Both calls are logged
  // (callDrafterModel logs every call to drafter_model_calls on its own).
  // If the repaired response is STILL invalid, the result stays invalid -
  // a repair attempt never gets a free pass, per BUILD-DECISIONS "absence
  // must never render as a pass".
  if (!validated.ok) {
    const repairPrompt = buildJudgeRepairPrompt(
      { controlText, rationale, sectionTitle: `${section.section_number} ${section.title}`, styleRules: stylepackVersion.rules },
      JSON.stringify(call.json),
      validated.reason
    );
    const repairCall = await callDrafterModel({
      role: "judge",
      promptVersion: PROMPT_VERSIONS.judge_rubric,
      systemPrompt: repairPrompt.system,
      userPrompt: repairPrompt.user,
      temperature: 0,
      praId: pra.id,
      enhancementId: enhancement.id,
      jsonSchema,
    });
    if (repairCall.ok) {
      const repairValidated = validateJudgeOutput(repairCall.json, judgedText);
      finalCall = repairCall;
      validated = repairValidated;
      repaired = true;
    } else {
      // The repair call itself failed to even return - keep the original
      // (invalid) validation result and reason, but still account for the
      // repair attempt's spend below via finalCall's cost only (0 here).
    }
  }

  const totalCostPence = call.costEstimatePence + (repaired && finalCall !== call ? finalCall.costEstimatePence : 0);

  if (!validated.ok) {
    // Invalid JSON per the schema (unknown criterion, missing quote, quote
    // not found, malformed) is a FAILED review, never a pass - this is the
    // "quote not in text" / "unknown criterion" / "malformed JSON" guard.
    // Still invalid after the one repair round: recorded as invalid, not a
    // pass.
    const judge = { error: validated.reason, invalid: true as const };
    const updated = await updateEnhancementReview(enhancement.id, {
      reviewResult: { lint: existingLint, judge, judgeStale: false, status: combineStatus({ lintIssues: existingLint, judge, judgeStale: false, needsInput }) },
    });
    await writeDrafterAudit(actor, "enhancement.judge.invalid", "drafter_enhancement", enhancement.id, { reason: validated.reason, repaired });
    if (totalCostPence > 0) await bumpSpend(pra.id, totalCostPence);
    return { ok: false, reason: validated.reason, enhancement: updated };
  }

  const judgeResult: JudgeResult = {
    criteria: validated.criteria,
    overall: validated.overall,
    modelName: finalCall.modelName,
    promptVersion: PROMPT_VERSIONS.judge_rubric,
  };

  const updated = await updateEnhancementReview(enhancement.id, {
    reviewResult: {
      lint: existingLint,
      judge: judgeResult,
      judgeStale: false,
      status: combineStatus({ lintIssues: existingLint, judge: judgeResult, judgeStale: false, needsInput }),
    },
  });

  if (totalCostPence > 0) await bumpSpend(pra.id, totalCostPence);
  await writeDrafterAudit(actor, "enhancement.judge.run", "drafter_enhancement", enhancement.id, { overall: judgeResult.overall, modelName: finalCall.modelName, repaired });
  await maybeAdvancePraStatus(pra.id);

  return { ok: true, enhancement: updated };
}

async function bumpSpend(praId: string, pence: number): Promise<void> {
  const { updatePraSpend } = await import("@/lib/repo/drafter-pras");
  await updatePraSpend(praId, pence);
}
