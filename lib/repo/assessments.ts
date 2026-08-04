import { query } from "@/lib/db";
import { writeAudit } from "./audit";

export type AssessmentStatus = "draft" | "in_review" | "approved" | "rejected" | "conditions_applied";
export type AppetiteResult = "within" | "tolerated" | "outside";
export type ControlCoverage = "full" | "partial" | "gap";

const ASSESSMENT_SUBJECT_TYPE = "pra_assessment";

// ---------------------------------------------------------------------------
// pra_assessments
// ---------------------------------------------------------------------------

export interface AssessmentRow {
  id: string;
  workspace_id: string;
  product_id: string;
  status: AssessmentStatus;
  recommendation: string | null;
  residual_summary: Record<string, unknown>;
  appetite_result: AppetiteResult | null;
  current_step: number;
  created_at: string;
  updated_at: string;
}

export async function listAssessments(workspaceId: string): Promise<AssessmentRow[]> {
  return query<AssessmentRow>(`SELECT * FROM pra_assessments WHERE workspace_id = $1 ORDER BY created_at DESC`, [
    workspaceId,
  ]);
}

export async function getAssessment(workspaceId: string, id: string): Promise<AssessmentRow | null> {
  const rows = await query<AssessmentRow>(`SELECT * FROM pra_assessments WHERE workspace_id = $1 AND id = $2`, [
    workspaceId,
    id,
  ]);
  return rows[0] ?? null;
}

export async function createAssessment(workspaceId: string, productId: string, actor: string): Promise<AssessmentRow> {
  const rows = await query<AssessmentRow>(
    `INSERT INTO pra_assessments (workspace_id, product_id)
     VALUES ($1, $2)
     RETURNING *`,
    [workspaceId, productId]
  );
  const assessment = rows[0];

  await writeAudit(workspaceId, actor, "assessment.created", ASSESSMENT_SUBJECT_TYPE, assessment.id, { productId });

  return assessment;
}

export interface UpdateAssessmentInput {
  status?: AssessmentStatus;
  recommendation?: string | null;
  residualSummary?: Record<string, unknown>;
  appetiteResult?: AppetiteResult | null;
  currentStep?: number;
}

/** Generic partial update, used by every journey step to persist its own slice of the assessment. */
export async function updateAssessment(
  workspaceId: string,
  id: string,
  input: UpdateAssessmentInput,
  actor: string
): Promise<AssessmentRow | null> {
  const current = await getAssessment(workspaceId, id);
  if (!current) return null;

  const status = input.status ?? current.status;
  const recommendation = input.recommendation !== undefined ? input.recommendation : current.recommendation;
  const residualSummary = input.residualSummary ?? current.residual_summary;
  const appetiteResult = input.appetiteResult !== undefined ? input.appetiteResult : current.appetite_result;
  const currentStep = input.currentStep ?? current.current_step;

  const rows = await query<AssessmentRow>(
    `UPDATE pra_assessments
     SET status = $3, recommendation = $4, residual_summary = $5, appetite_result = $6, current_step = $7, updated_at = now()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [workspaceId, id, status, recommendation, JSON.stringify(residualSummary), appetiteResult, currentStep]
  );

  const updated = rows[0] ?? null;
  if (updated) {
    await writeAudit(workspaceId, actor, "assessment.updated", ASSESSMENT_SUBJECT_TYPE, id, { fields: Object.keys(input) });
  }
  return updated;
}

/** Step-scoped helper: advances current_step (e.g. moving from step 3 to step 4) without touching other fields. */
export async function advanceAssessmentStep(
  workspaceId: string,
  id: string,
  step: number,
  actor: string
): Promise<AssessmentRow | null> {
  return updateAssessment(workspaceId, id, { currentStep: step }, actor);
}

export async function deleteAssessment(workspaceId: string, id: string, actor: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM pra_assessments WHERE workspace_id = $1 AND id = $2 RETURNING id`,
    [workspaceId, id]
  );
  const deleted = rows.length > 0;

  if (deleted) {
    await writeAudit(workspaceId, actor, "assessment.deleted", ASSESSMENT_SUBJECT_TYPE, id, {});
  }
  return deleted;
}

// ---------------------------------------------------------------------------
// assessment_risks
// ---------------------------------------------------------------------------

const RISK_SUBJECT_TYPE = "assessment_risk";

export interface AssessmentRiskRow {
  id: string;
  workspace_id: string;
  assessment_id: string;
  typology_slug: string | null;
  title: string;
  inherent_score: number | null;
  inherent_rationale: string | null;
  residual_score: number | null;
  residual_rationale: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAssessmentRiskInput {
  typologySlug?: string | null;
  title: string;
  inherentScore?: number | null;
  inherentRationale?: string | null;
  residualScore?: number | null;
  residualRationale?: string | null;
}

export async function listAssessmentRisks(workspaceId: string, assessmentId: string): Promise<AssessmentRiskRow[]> {
  return query<AssessmentRiskRow>(
    `SELECT * FROM assessment_risks WHERE workspace_id = $1 AND assessment_id = $2 ORDER BY created_at ASC`,
    [workspaceId, assessmentId]
  );
}

export async function getAssessmentRisk(workspaceId: string, id: string): Promise<AssessmentRiskRow | null> {
  const rows = await query<AssessmentRiskRow>(`SELECT * FROM assessment_risks WHERE workspace_id = $1 AND id = $2`, [
    workspaceId,
    id,
  ]);
  return rows[0] ?? null;
}

export async function createAssessmentRisk(
  workspaceId: string,
  assessmentId: string,
  input: CreateAssessmentRiskInput,
  actor: string
): Promise<AssessmentRiskRow> {
  const rows = await query<AssessmentRiskRow>(
    `INSERT INTO assessment_risks (
       workspace_id, assessment_id, typology_slug, title, inherent_score, inherent_rationale, residual_score, residual_rationale
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      workspaceId,
      assessmentId,
      input.typologySlug || null,
      input.title,
      input.inherentScore ?? null,
      input.inherentRationale || null,
      input.residualScore ?? null,
      input.residualRationale || null,
    ]
  );
  const risk = rows[0];

  await writeAudit(workspaceId, actor, "assessment_risk.created", RISK_SUBJECT_TYPE, risk.id, {
    assessmentId,
    title: input.title,
  });

  return risk;
}

export interface UpdateAssessmentRiskInput {
  typologySlug?: string | null;
  title?: string;
  inherentScore?: number | null;
  inherentRationale?: string | null;
  residualScore?: number | null;
  residualRationale?: string | null;
}

export async function updateAssessmentRisk(
  workspaceId: string,
  id: string,
  input: UpdateAssessmentRiskInput,
  actor: string
): Promise<AssessmentRiskRow | null> {
  const current = await getAssessmentRisk(workspaceId, id);
  if (!current) return null;

  const typologySlug = input.typologySlug !== undefined ? input.typologySlug : current.typology_slug;
  const title = input.title ?? current.title;
  const inherentScore = input.inherentScore !== undefined ? input.inherentScore : current.inherent_score;
  const inherentRationale =
    input.inherentRationale !== undefined ? input.inherentRationale : current.inherent_rationale;
  const residualScore = input.residualScore !== undefined ? input.residualScore : current.residual_score;
  const residualRationale =
    input.residualRationale !== undefined ? input.residualRationale : current.residual_rationale;

  const rows = await query<AssessmentRiskRow>(
    `UPDATE assessment_risks
     SET typology_slug = $3, title = $4, inherent_score = $5, inherent_rationale = $6,
         residual_score = $7, residual_rationale = $8, updated_at = now()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [workspaceId, id, typologySlug, title, inherentScore, inherentRationale, residualScore, residualRationale]
  );

  const updated = rows[0] ?? null;
  if (updated) {
    await writeAudit(workspaceId, actor, "assessment_risk.updated", RISK_SUBJECT_TYPE, id, { fields: Object.keys(input) });
  }
  return updated;
}

export async function deleteAssessmentRisk(workspaceId: string, id: string, actor: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM assessment_risks WHERE workspace_id = $1 AND id = $2 RETURNING id`,
    [workspaceId, id]
  );
  const deleted = rows.length > 0;

  if (deleted) {
    await writeAudit(workspaceId, actor, "assessment_risk.deleted", RISK_SUBJECT_TYPE, id, {});
  }
  return deleted;
}

// ---------------------------------------------------------------------------
// assessment_controls
// ---------------------------------------------------------------------------

const ASSESSMENT_CONTROL_SUBJECT_TYPE = "assessment_control";

export interface AssessmentControlRow {
  id: string;
  workspace_id: string;
  assessment_id: string;
  risk_id: string;
  workspace_control_id: string | null;
  control_slug: string | null;
  coverage: ControlCoverage;
  op_load: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateAssessmentControlInput {
  riskId: string;
  workspaceControlId?: string | null;
  controlSlug?: string | null;
  coverage: ControlCoverage;
  opLoad?: Record<string, unknown>;
}

export async function listAssessmentControls(
  workspaceId: string,
  assessmentId: string
): Promise<AssessmentControlRow[]> {
  return query<AssessmentControlRow>(
    `SELECT * FROM assessment_controls WHERE workspace_id = $1 AND assessment_id = $2 ORDER BY created_at ASC`,
    [workspaceId, assessmentId]
  );
}

export async function listAssessmentControlsByRisk(
  workspaceId: string,
  riskId: string
): Promise<AssessmentControlRow[]> {
  return query<AssessmentControlRow>(
    `SELECT * FROM assessment_controls WHERE workspace_id = $1 AND risk_id = $2 ORDER BY created_at ASC`,
    [workspaceId, riskId]
  );
}

export async function getAssessmentControl(workspaceId: string, id: string): Promise<AssessmentControlRow | null> {
  const rows = await query<AssessmentControlRow>(
    `SELECT * FROM assessment_controls WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, id]
  );
  return rows[0] ?? null;
}

export async function createAssessmentControl(
  workspaceId: string,
  assessmentId: string,
  input: CreateAssessmentControlInput,
  actor: string
): Promise<AssessmentControlRow> {
  const rows = await query<AssessmentControlRow>(
    `INSERT INTO assessment_controls (workspace_id, assessment_id, risk_id, workspace_control_id, control_slug, coverage, op_load)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      workspaceId,
      assessmentId,
      input.riskId,
      input.workspaceControlId || null,
      input.controlSlug || null,
      input.coverage,
      JSON.stringify(input.opLoad ?? {}),
    ]
  );
  const assessmentControl = rows[0];

  await writeAudit(workspaceId, actor, "assessment_control.created", ASSESSMENT_CONTROL_SUBJECT_TYPE, assessmentControl.id, {
    assessmentId,
    riskId: input.riskId,
    coverage: input.coverage,
  });

  return assessmentControl;
}

export interface UpdateAssessmentControlInput {
  workspaceControlId?: string | null;
  controlSlug?: string | null;
  coverage?: ControlCoverage;
  opLoad?: Record<string, unknown>;
}

export async function updateAssessmentControl(
  workspaceId: string,
  id: string,
  input: UpdateAssessmentControlInput,
  actor: string
): Promise<AssessmentControlRow | null> {
  const current = await getAssessmentControl(workspaceId, id);
  if (!current) return null;

  const workspaceControlId =
    input.workspaceControlId !== undefined ? input.workspaceControlId : current.workspace_control_id;
  const controlSlug = input.controlSlug !== undefined ? input.controlSlug : current.control_slug;
  const coverage = input.coverage ?? current.coverage;
  const opLoad = input.opLoad ?? current.op_load;

  const rows = await query<AssessmentControlRow>(
    `UPDATE assessment_controls
     SET workspace_control_id = $3, control_slug = $4, coverage = $5, op_load = $6, updated_at = now()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [workspaceId, id, workspaceControlId, controlSlug, coverage, JSON.stringify(opLoad)]
  );

  const updated = rows[0] ?? null;
  if (updated) {
    await writeAudit(workspaceId, actor, "assessment_control.updated", ASSESSMENT_CONTROL_SUBJECT_TYPE, id, {
      fields: Object.keys(input),
    });
  }
  return updated;
}

export async function deleteAssessmentControl(workspaceId: string, id: string, actor: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM assessment_controls WHERE workspace_id = $1 AND id = $2 RETURNING id`,
    [workspaceId, id]
  );
  const deleted = rows.length > 0;

  if (deleted) {
    await writeAudit(workspaceId, actor, "assessment_control.deleted", ASSESSMENT_CONTROL_SUBJECT_TYPE, id, {});
  }
  return deleted;
}
