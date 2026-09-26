import { query } from "@/lib/db";
import { writeDrafterAudit } from "./drafter-audit";
import type { CalibrationRunSummary } from "@/lib/drafter/calibration";

export interface CalibrationItemRow {
  id: string;
  enhancement_text: string;
  rationale_text: string;
  section_type: string;
  human_labels: Record<string, "pass" | "fail">;
  judge_output: { criteria: Record<string, unknown>; overall?: string; modelName?: string; promptVersion?: string } | null;
  created_by: string;
  created_at: string;
}

export async function addCalibrationItem(input: {
  enhancementText: string;
  rationaleText: string;
  sectionType: string;
  humanLabels: Record<string, "pass" | "fail">;
  actor: string;
}): Promise<CalibrationItemRow> {
  const rows = await query<CalibrationItemRow>(
    `INSERT INTO drafter_calibration_items (enhancement_text, rationale_text, section_type, human_labels, created_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [input.enhancementText, input.rationaleText, input.sectionType, JSON.stringify(input.humanLabels), input.actor]
  );
  await writeDrafterAudit(input.actor, "calibration.item.add", "drafter_calibration_item", rows[0].id, {});
  return rows[0];
}

export async function listCalibrationItems(): Promise<CalibrationItemRow[]> {
  return query<CalibrationItemRow>(`SELECT * FROM drafter_calibration_items ORDER BY created_at DESC`);
}

export async function saveCalibrationItemJudgeOutput(id: string, judgeOutput: unknown): Promise<void> {
  await query(`UPDATE drafter_calibration_items SET judge_output = $2 WHERE id = $1`, [id, JSON.stringify(judgeOutput)]);
}

export interface CalibrationRunRow {
  id: string;
  model_name: string;
  prompt_version: string;
  item_count: number;
  agreement_by_criterion: Record<string, { agree: number; total: number; pct: number }>;
  overall_agreement_pct: number;
  threshold_pct: number;
  passed_threshold: boolean;
  created_by: string;
  created_at: string;
}

export async function saveCalibrationRun(input: {
  modelName: string;
  promptVersion: string;
  summary: CalibrationRunSummary;
  thresholdPct: number;
  actor: string;
}): Promise<CalibrationRunRow> {
  const passed = input.summary.itemCount > 0 && input.summary.overallAgreementPct >= input.thresholdPct;
  const rows = await query<CalibrationRunRow>(
    `INSERT INTO drafter_calibration_runs (model_name, prompt_version, item_count, agreement_by_criterion, overall_agreement_pct, threshold_pct, passed_threshold, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      input.modelName,
      input.promptVersion,
      input.summary.itemCount,
      JSON.stringify(input.summary.agreementByCriterion),
      input.summary.overallAgreementPct,
      input.thresholdPct,
      passed,
      input.actor,
    ]
  );
  await writeDrafterAudit(input.actor, "calibration.run", "drafter_calibration_run", rows[0].id, { modelName: input.modelName, passed });
  return rows[0];
}

export async function listCalibrationRuns(): Promise<CalibrationRunRow[]> {
  return query<CalibrationRunRow>(`SELECT * FROM drafter_calibration_runs ORDER BY created_at DESC`);
}

/**
 * Has the given model+prompt version ever had a PASSING calibration run?
 * Drives the "reviewer not yet calibrated" banner on the review panel
 * (SPEC.md calibration: "Show a banner ... when the current judge model +
 * prompt version has no passing calibration run").
 */
export async function hasPassingCalibrationRun(modelName: string, promptVersion: string): Promise<boolean> {
  const rows = await query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM drafter_calibration_runs WHERE model_name = $1 AND prompt_version = $2 AND passed_threshold = true) AS exists`,
    [modelName, promptVersion]
  );
  return Boolean(rows[0]?.exists);
}
