import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { listCalibrationItems, saveCalibrationItemJudgeOutput, saveCalibrationRun } from "@/lib/repo/drafter-calibration";
import { computeAgreement, type CalibrationItem } from "@/lib/drafter/calibration";
import { buildJudgePrompt, validateJudgeOutput, type JudgeResult } from "@/lib/drafter/judge";
import { callDrafterModel, isRoleConfigured, roleDisabledReason, PROMPT_VERSIONS } from "@/lib/drafter/llm";
import { getDrafterSetting } from "@/lib/repo/drafter-settings";

/**
 * POST - runs the judge over the whole labelled calibration set and stores
 * a run keyed by model + prompt version (SPEC.md calibration: "keep run
 * history keyed by model + prompt version"). Each item's judge_output is
 * cached on the item row too, so a later run can be inspected item by item.
 */
export async function POST(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;

  if (!isRoleConfigured("judge")) {
    return NextResponse.json({ error: roleDisabledReason("judge") }, { status: 422 });
  }

  const items = await listCalibrationItems();
  if (items.length === 0) return NextResponse.json({ error: "No calibration items to run against." }, { status: 400 });

  let modelName = "stub";
  const results: CalibrationItem[] = [];

  for (const item of items) {
    const prompt = buildJudgePrompt({
      controlText: item.enhancement_text,
      rationale: item.rationale_text,
      sectionTitle: item.section_type,
      styleRules: [],
    });
    const call = await callDrafterModel({
      role: "judge",
      promptVersion: PROMPT_VERSIONS.judge_rubric,
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      temperature: 0,
    });

    let judgeOutput: { criteria: JudgeResult["criteria"] } | null = null;
    if (call.ok) {
      modelName = call.modelName;
      const validated = validateJudgeOutput(call.json, `${item.enhancement_text}\n${item.rationale_text}`);
      if (validated.ok) judgeOutput = { criteria: validated.criteria };
    }
    await saveCalibrationItemJudgeOutput(item.id, judgeOutput);
    results.push({ id: item.id, humanLabels: item.human_labels, judgeOutput });
  }

  const summary = computeAgreement(results);
  const thresholdPct = (await getDrafterSetting("judge_agreement_threshold_pct")) ?? 80;

  const run = await saveCalibrationRun({
    modelName,
    promptVersion: PROMPT_VERSIONS.judge_rubric,
    summary,
    thresholdPct,
    actor: actor.email,
  });

  return NextResponse.json({ run, summary });
}
