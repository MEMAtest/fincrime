import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { listCalibrationItemsJudgedUnder, saveCalibrationRun } from "@/lib/repo/drafter-calibration";
import { computeAgreement, passesThreshold, type CalibrationItem } from "@/lib/drafter/calibration";
import type { JudgeCriterionResult } from "@/lib/drafter/judge";
import { currentModelName, PROMPT_VERSIONS } from "@/lib/drafter/llm";
import { getDrafterSetting } from "@/lib/repo/drafter-settings";

/**
 * POST - "finalise": computes and saves the calibration summary from items
 * already judged one at a time (`POST .../items/[id]/judge`), under the
 * CURRENT judge model + prompt version ONLY. This route no longer calls the
 * model itself - judging 20-30 items sequentially inside one request used to
 * risk the serverless function timeout (defect #2); the UI now judges items
 * one request at a time with progress, then calls this to finalise.
 */
export async function POST(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;

  const modelName = currentModelName("judge");
  const promptVersion = PROMPT_VERSIONS.judge_rubric;

  const rows = await listCalibrationItemsJudgedUnder(modelName, promptVersion);
  if (rows.length === 0) {
    return NextResponse.json({ error: "No calibration items have been judged under the current judge model + prompt version yet. Judge items first." }, { status: 400 });
  }

  const items: CalibrationItem[] = rows.map((row) => ({
    id: row.id,
    humanLabels: row.human_labels,
    judgeOutput: row.judge_output && "criteria" in row.judge_output ? { criteria: row.judge_output.criteria as Record<string, JudgeCriterionResult> } : null,
  }));

  const summary = computeAgreement(items);
  const thresholdPct = (await getDrafterSetting("judge_agreement_threshold_pct")) ?? 85;
  const minItems = (await getDrafterSetting("judge_calibration_min_items")) ?? 20;
  const passed = passesThreshold(summary, thresholdPct, minItems);

  const run = await saveCalibrationRun({
    modelName,
    promptVersion,
    summary,
    thresholdPct,
    minItems,
    passed,
    actor: actor.email,
  });

  return NextResponse.json({ run, summary });
}
