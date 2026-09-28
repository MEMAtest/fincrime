import { query } from "@/lib/db";
import { writeDrafterAudit } from "./drafter-audit";
import type { CalibrationRunSummary } from "@/lib/drafter/calibration";

export interface CalibrationItemRow {
  id: string;
  enhancement_text: string;
  rationale_text: string;
  section_type: string;
  human_labels: Record<string, "pass" | "fail">;
  /** Last judge attempt's result under `judge_model_name`/`judge_prompt_version`: valid criteria, `{invalid:true, error}`, or null (never judged). */
  judge_output: { criteria: Record<string, unknown> } | { invalid: true; error: string } | null;
  judge_model_name: string | null;
  judge_prompt_version: string | null;
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

export async function getCalibrationItem(id: string): Promise<CalibrationItemRow | null> {
  const rows = await query<CalibrationItemRow>(`SELECT * FROM drafter_calibration_items WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

/**
 * Items whose LAST judge attempt was tagged with the given model + prompt
 * version - the set finalise() summarises. An item judged under an older
 * model/version (or never judged) is excluded here, so a stale cached
 * result can never be counted toward the CURRENT judge's agreement.
 */
export async function listCalibrationItemsJudgedUnder(modelName: string, promptVersion: string): Promise<CalibrationItemRow[]> {
  return query<CalibrationItemRow>(
    `SELECT * FROM drafter_calibration_items WHERE judge_model_name = $1 AND judge_prompt_version = $2 ORDER BY created_at DESC`,
    [modelName, promptVersion]
  );
}

/** Stores one item's judge attempt, tagged with the model + prompt version it ran under (so a later model/prompt change never inherits a stale cached verdict). */
export async function saveCalibrationItemJudgeOutput(
  id: string,
  judgeOutput: CalibrationItemRow["judge_output"],
  modelName: string,
  promptVersion: string
): Promise<CalibrationItemRow | null> {
  const rows = await query<CalibrationItemRow>(
    `UPDATE drafter_calibration_items SET judge_output = $2, judge_model_name = $3, judge_prompt_version = $4 WHERE id = $1 RETURNING *`,
    [id, JSON.stringify(judgeOutput), modelName, promptVersion]
  );
  return rows[0] ?? null;
}

export async function deleteCalibrationItem(id: string, actor: string): Promise<boolean> {
  const rows = await query<{ id: string }>(`DELETE FROM drafter_calibration_items WHERE id = $1 RETURNING id`, [id]);
  if (rows.length === 0) return false;
  await writeDrafterAudit(actor, "calibration.item.delete", "drafter_calibration_item", id, {});
  return true;
}

/** Clears the whole labelled set (so it can be re-imported), per the task brief's "clear calibration set" management action. Audited, since it is destructive. */
export async function clearCalibrationItems(actor: string): Promise<number> {
  const rows = await query<{ id: string }>(`DELETE FROM drafter_calibration_items RETURNING id`);
  await writeDrafterAudit(actor, "calibration.items.clear", "drafter_calibration_item", null, { count: rows.length });
  return rows.length;
}

export interface CalibrationRunRow {
  id: string;
  model_name: string;
  prompt_version: string;
  item_count: number;
  agreement_by_criterion: Record<string, { agree: number; total: number; pct: number }>;
  overall_agreement_pct: number;
  invalid_count: number;
  threshold_pct: number;
  min_items: number;
  passed_threshold: boolean;
  created_by: string;
  created_at: string;
}

export async function saveCalibrationRun(input: {
  modelName: string;
  promptVersion: string;
  summary: CalibrationRunSummary;
  thresholdPct: number;
  minItems: number;
  passed: boolean;
  actor: string;
}): Promise<CalibrationRunRow> {
  const rows = await query<CalibrationRunRow>(
    `INSERT INTO drafter_calibration_runs (model_name, prompt_version, item_count, agreement_by_criterion, overall_agreement_pct, invalid_count, threshold_pct, min_items, passed_threshold, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      input.modelName,
      input.promptVersion,
      input.summary.itemCount,
      JSON.stringify(input.summary.agreementByCriterion),
      input.summary.overallAgreementPct,
      input.summary.invalidCount,
      input.thresholdPct,
      input.minItems,
      input.passed,
      input.actor,
    ]
  );
  await writeDrafterAudit(input.actor, "calibration.run", "drafter_calibration_run", rows[0].id, { modelName: input.modelName, passed: input.passed });
  return rows[0];
}

export async function listCalibrationRuns(): Promise<CalibrationRunRow[]> {
  return query<CalibrationRunRow>(`SELECT * FROM drafter_calibration_runs ORDER BY created_at DESC`);
}

/**
 * Has the given model+prompt version ever had a PASSING calibration run?
 * Drives the "reviewer not yet calibrated" banner on the review panel
 * (SPEC.md calibration: "Show a banner ... when the current judge model +
 * prompt version has no passing calibration run"). `passed_threshold` is
 * computed once, at finalise time, by the SAME rule
 * (`passesThreshold`: min items + every critical criterion) the review
 * panel's banner relies on here - there is only one pass rule.
 */
export async function hasPassingCalibrationRun(modelName: string, promptVersion: string): Promise<boolean> {
  const rows = await query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM drafter_calibration_runs WHERE model_name = $1 AND prompt_version = $2 AND passed_threshold = true) AS exists`,
    [modelName, promptVersion]
  );
  return Boolean(rows[0]?.exists);
}
