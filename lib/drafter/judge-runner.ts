/**
 * Drives the judge step for one enhancement (SPEC.md "Reviewer" - judge
 * model). Mirrors draft-enhancement.ts's split: pure logic lives in
 * lib/drafter/judge.ts, this file composes it with the repo layer and the
 * model provider.
 */
import { callDrafterModel, isUnderCostCap, PROMPT_VERSIONS, formatCostCapMessage } from "./llm";
import {
  buildJudgePrompt,
  buildJudgeRepairPrompt,
  buildJudgeJsonSchema,
  validateJudgeOutput,
  nonVerbatimExtractionFields,
  evaluateTriggerActorActionOutcome,
  evaluateCorrectSection,
  JUDGE_CRITERIA,
  type JudgeResult,
  type JudgeCriterionResult,
  type JudgeExtraction,
} from "./judge";
import { combineStatus } from "./review-status";
import { isPlaceholderOnlyText } from "./lint";
import { applyFactBoundary } from "./fact-boundary";
import { getAllowedInputTextsForEnhancement } from "./allowed-inputs";
import {
  getEnhancement,
  getPra,
  getSectionById,
  updateEnhancementReview,
  createOpenItem,
  type DrafterEnhancementRow,
} from "@/lib/repo/drafter-pras";
import { getStylepackVersion } from "@/lib/repo/drafter-stylepacks";
import { writeDrafterAudit } from "@/lib/repo/drafter-audit";
import { maybeAdvancePraStatus } from "./pra-status";

/**
 * SAFETY (fact boundary on judge rewrites): a judge's suggested_rewrite is
 * free-text from the model and is never passed through the fact boundary at
 * generation time (unlike the writer's control_text/rationale in
 * draft-enhancement.ts). Left unchecked, "Apply fix" could paste an invented
 * number, frequency, role or system name straight into the draft. This runs
 * the SAME fact-boundary check the writer's output gets, against the SAME
 * inputs the enhancement was drafted from (its register rows' draft inputs +
 * obligation description + product description - never the register's
 * Rationale column, per BUILD-DECISIONS "Fact boundary"). Unsupported
 * numbers/frequencies in the rewrite are replaced with a bracketed
 * placeholder; unsupported roles/systems are flagged. The rewrite shown in
 * the panel and used by Apply fix is always this sanitised version, never
 * the model's raw one, and `rewriteAdjusted`/`rewriteFlags` tell the panel a
 * suggestion was adjusted so it is never silently swapped.
 */
async function sanitiseRewrites(
  criteria: Record<string, JudgeCriterionResult>,
  enhancement: DrafterEnhancementRow,
  pra: Parameters<typeof getAllowedInputTextsForEnhancement>[1]
): Promise<{ criteria: Record<string, JudgeCriterionResult>; openItemDescriptions: string[] }> {
  const allowedInputTexts = await getAllowedInputTextsForEnhancement(enhancement, pra);
  const openItemDescriptions: string[] = [];
  const result: Record<string, JudgeCriterionResult> = {};
  for (const [key, c] of Object.entries(criteria)) {
    if (!c.suggestedRewrite) {
      result[key] = c;
      continue;
    }
    const boundary = applyFactBoundary(c.suggestedRewrite, allowedInputTexts);
    const adjusted = boundary.text !== c.suggestedRewrite;
    result[key] = {
      ...c,
      suggestedRewrite: boundary.text,
      rewriteAdjusted: adjusted,
      rewriteFlags: boundary.flags.map((f) => f.term),
    };
    for (const p of boundary.placeholders) {
      openItemDescriptions.push(`Judge suggested rewrite for "${key}" invented "${p.original}" - ${p.reason} Replaced with a placeholder before it could be applied.`);
    }
    for (const f of boundary.flags) {
      openItemDescriptions.push(`Judge suggested rewrite for "${key}" used "${f.term}" - ${f.reason}`);
    }
  }
  return { criteria: result, openItemDescriptions };
}

export interface JudgeRunResult {
  ok: boolean;
  enhancement?: DrafterEnhancementRow;
  reason?: string;
}

export interface JudgeTextInput {
  controlText: string;
  rationale: string;
  sectionTitle: string;
  styleRules: string[];
  /** Attached to drafter_model_calls when this judge call belongs to a real PRA (omitted for calibration, which judges free-standing text). */
  praId?: string;
  enhancementId?: string;
}

export type JudgeTextResult =
  | { ok: true; criteria: Record<string, JudgeCriterionResult>; overall: "pass" | "fail"; modelName: string; promptVersion: string; costEstimatePence: number; repaired: boolean; extraction: JudgeExtraction }
  | { ok: false; reason: string; promptVersion: string; costEstimatePence: number; repaired: boolean };

/**
 * Overrides trigger_actor_action_outcome and correct_section with the
 * deterministic (code-computed) verdicts, and recomputes `overall`
 * accordingly. This is where the two criteria stop being "whatever the
 * model said" - applied once, here, so every caller of `judgeText`
 * (production judging AND calibration) is measured against the same
 * deterministic rule.
 */
function applyDeterministicCriteria(
  criteria: Record<string, JudgeCriterionResult>,
  extraction: JudgeExtraction,
  controlText: string,
  sectionTitle: string
): { criteria: Record<string, JudgeCriterionResult>; overall: "pass" | "fail" } {
  const next: Record<string, JudgeCriterionResult> = {
    ...criteria,
    trigger_actor_action_outcome: evaluateTriggerActorActionOutcome(extraction, controlText),
    correct_section: evaluateCorrectSection(extraction, sectionTitle, criteria.correct_section),
  };
  const overall: "pass" | "fail" = JUDGE_CRITERIA.every((def) => !def.critical || next[def.key].pass) ? "pass" : "fail";
  return { criteria: next, overall };
}

/**
 * THE judge call, shared verbatim by production (`judgeOneEnhancement`) and
 * calibration (`app/api/drafter/calibration/items/[id]/judge`) - same
 * prompt builder, same structured-output schema, same one repair round, same
 * verbatim-quote validation. Calibration must measure the SAME judge
 * production uses, not a hand-rolled approximation of it (SPEC.md
 * calibration: "run the judge on them" - not "run a similar prompt").
 *
 * Does NOT run the rewrite fact-check (BUILD-DECISIONS "Fact boundary") -
 * that needs a real enhancement's allowed input texts, which calibration
 * items do not have. Callers with a real enhancement/PRA apply that
 * themselves (see `sanitiseRewrites` below), "where applicable" per the
 * task brief.
 */
export async function judgeText(input: JudgeTextInput): Promise<JudgeTextResult> {
  const judgedText = `${input.controlText}\n${input.rationale}`;
  const promptInput = { controlText: input.controlText, rationale: input.rationale, sectionTitle: input.sectionTitle, styleRules: input.styleRules };
  const prompt = buildJudgePrompt(promptInput);
  const jsonSchema = buildJudgeJsonSchema();

  const call = await callDrafterModel({
    role: "judge",
    promptVersion: PROMPT_VERSIONS.judge_rubric,
    systemPrompt: prompt.system,
    userPrompt: prompt.user,
    temperature: 0,
    praId: input.praId,
    enhancementId: input.enhancementId,
    jsonSchema,
  });

  if (!call.ok) {
    return { ok: false, reason: call.error, promptVersion: PROMPT_VERSIONS.judge_rubric, costEstimatePence: 0, repaired: false };
  }

  let validated = validateJudgeOutput(call.json, judgedText);
  let finalCall = call;
  let repaired = false;
  let repairCost = 0;

  // One repair round (never more): the first invalid response is shown back
  // to the model with the specific validation error and it is asked to
  // return the complete corrected JSON. Both calls are logged
  // (callDrafterModel logs every call to drafter_model_calls on its own).
  // If the repaired response is STILL invalid, the result stays invalid -
  // a repair attempt never gets a free pass, per BUILD-DECISIONS "absence
  // must never render as a pass".
  // A valid answer whose trigger/actor/action/outcome were not copied
  // verbatim would silently fail that criterion, so it also earns the one
  // repair round. If the repair is no better, the original valid answer is
  // kept and the criterion fails in code as before.
  const nonVerbatim = validated.ok ? nonVerbatimExtractionFields(validated.extraction, input.controlText) : [];
  const repairReason = !validated.ok
    ? validated.reason
    : nonVerbatim.length
      ? `extraction.${nonVerbatim.join(", extraction.")} must be copied character-for-character from the control text (or null if the control text does not state it).`
      : null;

  if (repairReason) {
    const repairPrompt = buildJudgeRepairPrompt(promptInput, JSON.stringify(call.json), repairReason);
    const repairCall = await callDrafterModel({
      role: "judge",
      promptVersion: PROMPT_VERSIONS.judge_rubric,
      systemPrompt: repairPrompt.system,
      userPrompt: repairPrompt.user,
      temperature: 0,
      praId: input.praId,
      enhancementId: input.enhancementId,
      jsonSchema,
    });
    if (repairCall.ok) {
      const repairValidated = validateJudgeOutput(repairCall.json, judgedText);
      const keepOriginal = validated.ok && !repairValidated.ok;
      repaired = true;
      if (!keepOriginal) {
        finalCall = repairCall;
        validated = repairValidated;
      } else {
        repairCost = repairCall.costEstimatePence;
      }
    } else {
      // The repair call itself failed to even return - keep the original
      // (invalid) validation result and reason, but still account for the
      // repair attempt's spend below via finalCall's cost only (0 here).
    }
  }

  const totalCostPence = call.costEstimatePence + (repaired && finalCall !== call ? finalCall.costEstimatePence : 0) + repairCost;

  if (!validated.ok) {
    // Invalid JSON per the schema (unknown criterion, missing quote, quote
    // not found, malformed) is a FAILED review, never a pass - this is the
    // "quote not in text" / "unknown criterion" / "malformed JSON" guard.
    // Still invalid after the one repair round: recorded as invalid, not a
    // pass.
    return { ok: false, reason: validated.reason, promptVersion: PROMPT_VERSIONS.judge_rubric, costEstimatePence: totalCostPence, repaired };
  }

  const deterministic = applyDeterministicCriteria(validated.criteria, validated.extraction, input.controlText, input.sectionTitle);

  return {
    ok: true,
    criteria: deterministic.criteria,
    overall: deterministic.overall,
    modelName: finalCall.modelName,
    promptVersion: PROMPT_VERSIONS.judge_rubric,
    costEstimatePence: totalCostPence,
    repaired,
    extraction: validated.extraction,
  };
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
  const existingLint = enhancement.review_result?.lint ?? [];
  const needsInput = enhancement.is_gap || isPlaceholderOnlyText(controlText);

  const result = await judgeText({
    controlText,
    rationale,
    sectionTitle: `${section.section_number} ${section.title}`,
    styleRules: stylepackVersion.rules,
    praId: pra.id,
    enhancementId: enhancement.id,
  });

  if (!result.ok) {
    const judge = { error: result.reason, invalid: true as const };
    const updated = await updateEnhancementReview(enhancement.id, {
      reviewResult: { lint: existingLint, judge, judgeStale: false, status: combineStatus({ lintIssues: existingLint, judge, judgeStale: false, needsInput }) },
    });
    await writeDrafterAudit(actor, "enhancement.judge.invalid", "drafter_enhancement", enhancement.id, { reason: result.reason, repaired: result.repaired });
    if (result.costEstimatePence > 0) await bumpSpend(pra.id, result.costEstimatePence);
    return { ok: false, reason: result.reason, enhancement: updated };
  }

  const { criteria: sanitisedCriteria, openItemDescriptions } = await sanitiseRewrites(result.criteria, enhancement, pra);

  const judgeResult: JudgeResult = {
    criteria: sanitisedCriteria,
    overall: result.overall,
    modelName: result.modelName,
    promptVersion: PROMPT_VERSIONS.judge_rubric,
    extraction: result.extraction,
  };

  for (const description of openItemDescriptions) {
    await createOpenItem({ praId: pra.id, enhancementId: enhancement.id, itemType: "unsupported_term", description });
  }

  const updated = await updateEnhancementReview(enhancement.id, {
    reviewResult: {
      lint: existingLint,
      judge: judgeResult,
      judgeStale: false,
      status: combineStatus({ lintIssues: existingLint, judge: judgeResult, judgeStale: false, needsInput }),
    },
  });

  if (result.costEstimatePence > 0) await bumpSpend(pra.id, result.costEstimatePence);
  await writeDrafterAudit(actor, "enhancement.judge.run", "drafter_enhancement", enhancement.id, { overall: judgeResult.overall, modelName: result.modelName, repaired: result.repaired });
  await maybeAdvancePraStatus(pra.id);

  return { ok: true, enhancement: updated };
}

async function bumpSpend(praId: string, pence: number): Promise<void> {
  const { updatePraSpend } = await import("@/lib/repo/drafter-pras");
  await updatePraSpend(praId, pence);
}
