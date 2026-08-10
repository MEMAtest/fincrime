import { query, queryWithClient, withTransaction, type DbTransactionClient } from "@/lib/db";
import { writeAudit } from "./audit";
import { createDecisionWithClient, createConditionWithClient, type DecisionRow, type ConditionRow, type CreateConditionInput } from "./decisions";
import { getCddProfile } from "@/data/kyc";
import { buildRequirements } from "@/data/kyc/requirements";
import type { EntityType, Jurisdiction } from "@/data/kyc/types";
import type { Source } from "@/data/typologies/types";
import { summarizeObligations, type ReadinessSummary } from "../readiness/summary";

export type ReadinessRiskLevel = "low" | "medium" | "high";
export type ReadinessStatus = "draft" | "in_review" | "approved_local" | "approved_global" | "rejected" | "cancelled";
export type ReadinessGap = "not_assessed" | "none" | "partial" | "full";

const SUBJECT_TYPE = "readiness_assessment";
export const READINESS_SUBJECT_TYPE = SUBJECT_TYPE;
export const READINESS_OBLIGATION_SUBJECT_TYPE = "readiness_obligation";

/** Terminal statuses: the assessment is a historical record and may not be mutated further via the general PATCH/child-mutation paths. */
export function isFinalReadinessStatus(status: ReadinessStatus): boolean {
  return status === "approved_global" || status === "rejected" || status === "cancelled";
}

export interface ReadinessAssessmentRow {
  id: string;
  workspace_id: string;
  title: string;
  entity_type: string;
  jurisdiction: string;
  risk_level: ReadinessRiskLevel;
  product_id: string | null;
  product_note: string | null;
  status: ReadinessStatus;
  current_step: number;
  target_launch_date: string | null;
  owner_person_id: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReadinessObligationRow {
  id: string;
  workspace_id: string;
  assessment_id: string;
  requirement_key: string;
  category: string;
  title: string;
  rule_summary: string | null;
  legal_basis: Source[];
  applies_at_risk: string[];
  workspace_control_id: string | null;
  control_note: string | null;
  gap: ReadinessGap;
  blocker: boolean;
  owner_person_id: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// readiness_assessments
// ---------------------------------------------------------------------------

export interface CreateReadinessAssessmentInput {
  title: string;
  entityType: EntityType;
  jurisdiction: Jurisdiction;
  riskLevel?: ReadinessRiskLevel;
  productId?: string | null;
  productNote?: string | null;
  targetLaunchDate?: string | null;
  ownerPersonId?: string | null;
}

export interface ListReadinessAssessmentsFilter {
  status?: ReadinessStatus;
}

export async function listReadinessAssessments(
  workspaceId: string,
  filter: ListReadinessAssessmentsFilter = {}
): Promise<ReadinessAssessmentRow[]> {
  if (filter.status) {
    return query<ReadinessAssessmentRow>(
      `SELECT * FROM readiness_assessments WHERE workspace_id = $1 AND status = $2 ORDER BY created_at DESC`,
      [workspaceId, filter.status]
    );
  }
  return query<ReadinessAssessmentRow>(
    `SELECT * FROM readiness_assessments WHERE workspace_id = $1 ORDER BY created_at DESC`,
    [workspaceId]
  );
}

export async function getReadinessAssessment(workspaceId: string, id: string): Promise<ReadinessAssessmentRow | null> {
  const rows = await query<ReadinessAssessmentRow>(
    `SELECT * FROM readiness_assessments WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, id]
  );
  return rows[0] ?? null;
}

export async function createReadinessAssessment(
  workspaceId: string,
  input: CreateReadinessAssessmentInput,
  actor: string
): Promise<ReadinessAssessmentRow> {
  const rows = await query<ReadinessAssessmentRow>(
    `INSERT INTO readiness_assessments
       (workspace_id, title, entity_type, jurisdiction, risk_level, product_id, product_note, target_launch_date, owner_person_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      workspaceId,
      input.title,
      input.entityType,
      input.jurisdiction,
      input.riskLevel ?? "medium",
      input.productId ?? null,
      input.productNote ?? null,
      input.targetLaunchDate ?? null,
      input.ownerPersonId ?? null,
    ]
  );
  const assessment = rows[0];

  await writeAudit(workspaceId, actor, "readiness_assessment.created", SUBJECT_TYPE, assessment.id, {
    title: input.title,
    entityType: input.entityType,
    jurisdiction: input.jurisdiction,
  });

  return assessment;
}

export interface UpdateReadinessAssessmentInput {
  title?: string;
  riskLevel?: ReadinessRiskLevel;
  productId?: string | null;
  productNote?: string | null;
  targetLaunchDate?: string | null;
  ownerPersonId?: string | null;
  summary?: string | null;
  currentStep?: number;
}

export type UpdateReadinessAssessmentResult =
  | { ok: true; assessment: ReadinessAssessmentRow }
  | { ok: false; reason: "not_found" | "already_final" };

/**
 * Updates a readiness assessment (never entityType/jurisdiction/status -
 * those have their own dedicated paths: entityType/jurisdiction are
 * immutable once obligations exist because the register would no longer
 * match its basis, and status only moves via submit/approve-local/
 * approve-global/reject). Runs in a transaction with SELECT ... FOR UPDATE
 * so a concurrent PATCH cannot race past a status transition to final,
 * mirroring updateIncident in lib/repo/incidents.ts.
 */
export async function updateReadinessAssessment(
  workspaceId: string,
  id: string,
  input: UpdateReadinessAssessmentInput,
  actor: string
): Promise<UpdateReadinessAssessmentResult> {
  return withTransaction(async (client) => {
    const current = await getAssessmentWithClient(client, workspaceId, id);
    if (!current) return { ok: false, reason: "not_found" };
    if (isFinalReadinessStatus(current.status)) return { ok: false, reason: "already_final" };

    const title = input.title ?? current.title;
    const riskLevel = input.riskLevel ?? current.risk_level;
    const productId = input.productId !== undefined ? input.productId : current.product_id;
    const productNote = input.productNote !== undefined ? input.productNote : current.product_note;
    const targetLaunchDate = input.targetLaunchDate !== undefined ? input.targetLaunchDate : current.target_launch_date;
    const ownerPersonId = input.ownerPersonId !== undefined ? input.ownerPersonId : current.owner_person_id;
    const summary = input.summary !== undefined ? input.summary : current.summary;
    const currentStep = input.currentStep ?? current.current_step;

    const rows = await queryWithClient<ReadinessAssessmentRow>(
      client,
      `UPDATE readiness_assessments
       SET title = $3, risk_level = $4, product_id = $5, product_note = $6, target_launch_date = $7,
           owner_person_id = $8, summary = $9, current_step = $10, updated_at = now()
       WHERE workspace_id = $1 AND id = $2
         AND status NOT IN ('approved_global', 'rejected', 'cancelled')
       RETURNING *`,
      [workspaceId, id, title, riskLevel, productId, productNote, targetLaunchDate, ownerPersonId, summary, currentStep]
    );

    const updated = rows[0];
    if (!updated) return { ok: false, reason: "already_final" };

    await writeAudit(workspaceId, actor, "readiness_assessment.updated", SUBJECT_TYPE, id, { fields: Object.keys(input) }, client);
    return { ok: true, assessment: updated };
  });
}

export type DeleteReadinessAssessmentResult = { ok: true } | { ok: false; reason: "not_found" | "already_final" };

/**
 * Deletes a readiness assessment. 'approved_global' is never deletable (a
 * real historical sign-off). 'rejected'/'cancelled' are normally blocked
 * too, EXCEPT when the assessment never accumulated any substantive work
 * (zero obligations) - the create-then-reject shape of an empty draft
 * opened by mistake, otherwise permanent undeletable junk since PATCH is
 * unconditionally blocked on a final status. Mirrors deleteRegRequest in
 * lib/repo/reg-requests.ts.
 */
export async function deleteReadinessAssessment(workspaceId: string, id: string, actor: string): Promise<DeleteReadinessAssessmentResult> {
  return withTransaction(async (client) => {
    const current = await getAssessmentWithClient(client, workspaceId, id);
    if (!current) return { ok: false, reason: "not_found" };

    if (isFinalReadinessStatus(current.status)) {
      if (current.status === "approved_global") return { ok: false, reason: "already_final" };

      const obligationRows = await queryWithClient<{ count: string }>(
        client,
        `SELECT COUNT(*)::text as count FROM readiness_obligations WHERE workspace_id = $1 AND assessment_id = $2`,
        [workspaceId, id]
      );
      const hasSubstance = parseInt(obligationRows[0]?.count ?? "0", 10) > 0;
      if (hasSubstance) return { ok: false, reason: "already_final" };
    }

    const rows = await queryWithClient<{ id: string }>(client, `DELETE FROM readiness_assessments WHERE workspace_id = $1 AND id = $2 RETURNING id`, [
      workspaceId,
      id,
    ]);
    if (rows.length === 0) return { ok: false, reason: "already_final" };

    await writeAudit(workspaceId, actor, "readiness_assessment.deleted", SUBJECT_TYPE, id, {}, client);
    return { ok: true };
  });
}

export type WithReadinessAssessmentLockResult<T> =
  | { ok: true; assessment: ReadinessAssessmentRow; result: T }
  | { ok: false; reason: "not_found" | "already_final" };

/**
 * Locks the parent assessment row (SELECT ... FOR UPDATE) and re-checks it is
 * non-final, then runs `work` in the SAME transaction before committing.
 * Mirrors the pattern updateReadinessObligation already uses for the PATCH
 * path. Callers that create a child row under an assessment or one of its
 * obligations (evidence, obligation actions) MUST route the insert through
 * this - reading assessment.status with a plain SELECT before an unrelated
 * INSERT (the previous behaviour) leaves a window where a concurrent
 * approve-global can flip the assessment to final in between, letting a
 * child row land on an already-finalised record.
 */
export async function withReadinessAssessmentLock<T>(
  workspaceId: string,
  assessmentId: string,
  work: (client: DbTransactionClient, assessment: ReadinessAssessmentRow) => Promise<T>
): Promise<WithReadinessAssessmentLockResult<T>> {
  return withTransaction(async (client) => {
    const assessment = await getAssessmentWithClient(client, workspaceId, assessmentId);
    if (!assessment) return { ok: false, reason: "not_found" };
    if (isFinalReadinessStatus(assessment.status)) return { ok: false, reason: "already_final" };
    const result = await work(client, assessment);
    return { ok: true, assessment, result };
  });
}

async function getAssessmentWithClient(
  client: DbTransactionClient,
  workspaceId: string,
  id: string
): Promise<ReadinessAssessmentRow | null> {
  const rows = await queryWithClient<ReadinessAssessmentRow>(
    client,
    `SELECT * FROM readiness_assessments WHERE workspace_id = $1 AND id = $2 FOR UPDATE`,
    [workspaceId, id]
  );
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// readiness_obligations
// ---------------------------------------------------------------------------

export async function listReadinessObligations(workspaceId: string, assessmentId: string): Promise<ReadinessObligationRow[]> {
  return query<ReadinessObligationRow>(
    `SELECT * FROM readiness_obligations WHERE workspace_id = $1 AND assessment_id = $2 ORDER BY category ASC, title ASC`,
    [workspaceId, assessmentId]
  );
}

/**
 * Batch-loads a workspace's readiness summaries in one query, keyed by
 * assessment_id, for the list route (which would otherwise N+1 a
 * readinessSummary per assessment). Assessments with zero obligations get
 * the zeroed summary from summarizeObligations([]) rather than being absent.
 */
export async function listReadinessSummaries(workspaceId: string): Promise<Map<string, ReadinessSummary>> {
  const rows = await query<Pick<ReadinessObligationRow, "assessment_id" | "gap" | "blocker" | "workspace_control_id">>(
    `SELECT assessment_id, gap, blocker, workspace_control_id FROM readiness_obligations WHERE workspace_id = $1`,
    [workspaceId]
  );
  const byAssessment = new Map<string, typeof rows>();
  for (const row of rows) {
    const bucket = byAssessment.get(row.assessment_id);
    if (bucket) bucket.push(row);
    else byAssessment.set(row.assessment_id, [row]);
  }
  const summaries = new Map<string, ReadinessSummary>();
  for (const [assessmentId, obligations] of byAssessment) {
    summaries.set(assessmentId, summarizeObligations(obligations));
  }
  return summaries;
}

export interface OpenReadinessBlockerRow extends ReadinessObligationRow {
  assessment_title: string;
}

/**
 * Every unresolved launch blocker (blocker = true AND gap != 'full') across
 * the whole workspace whose parent assessment is still open (not
 * approved_global/rejected/cancelled) - the governance dashboard's "open
 * launch blockers" surface. One join query rather than an N+1 over
 * listReadinessObligations per assessment; mirrors listReadinessSummaries'
 * whole-workspace-in-one-query shape. Uses the same isUnresolvedBlocker
 * predicate (blocker && gap != 'full') as lib/readiness/summary.ts, just
 * expressed in SQL rather than re-fetched-then-filtered in memory.
 */
export async function listOpenReadinessBlockers(workspaceId: string): Promise<OpenReadinessBlockerRow[]> {
  return query<OpenReadinessBlockerRow>(
    `SELECT ro.*, ra.title AS assessment_title
     FROM readiness_obligations ro
     JOIN readiness_assessments ra ON ra.id = ro.assessment_id AND ra.workspace_id = ro.workspace_id
     WHERE ro.workspace_id = $1 AND ro.blocker = true AND ro.gap != 'full'
       AND ra.status NOT IN ('approved_global', 'rejected', 'cancelled')
     ORDER BY ro.due_date ASC NULLS LAST`,
    [workspaceId]
  );
}

export async function getReadinessObligation(workspaceId: string, id: string): Promise<ReadinessObligationRow | null> {
  const rows = await query<ReadinessObligationRow>(
    `SELECT * FROM readiness_obligations WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, id]
  );
  return rows[0] ?? null;
}

/** Same lookup as getReadinessObligation, but participates in a caller-supplied transaction - for use inside withReadinessAssessmentLock's callback. */
export async function getReadinessObligationWithClient(
  client: DbTransactionClient,
  workspaceId: string,
  assessmentId: string,
  id: string
): Promise<ReadinessObligationRow | null> {
  const rows = await queryWithClient<ReadinessObligationRow>(
    client,
    `SELECT * FROM readiness_obligations WHERE workspace_id = $1 AND assessment_id = $2 AND id = $3`,
    [workspaceId, assessmentId, id]
  );
  return rows[0] ?? null;
}

export type GenerateObligationsResult =
  | { ok: true; created: number; existing: number }
  | { ok: false; reason: "not_found" | "unknown_profile" | "already_final" };

/**
 * Builds the obligation register from the REAL data/kyc library: loads the
 * CddProfile for the assessment's (entityType, jurisdiction) via
 * getCddProfile, runs buildRequirements(profile) (the same derivation the
 * KYC Matrix UI renders from), and upserts one readiness_obligations row per
 * requirement keyed by requirement_key = req.id, the id buildRequirements
 * already assigns each requirement
 * (`${entityType}-${jurisdiction}-${sectionKey}` /
 * `-eddt-${slug(trigger)}` / `-${ongoingId}`). That id is derived from
 * structural position (which section/trigger/ongoing-monitoring template it
 * is), NOT from the requirement's authored title, so a typo fix or wording
 * change upstream in data/kyc/requirements.ts never changes the key and
 * never orphans a user's existing work on that row.
 *
 * ON CONFLICT (assessment_id, requirement_key) DO UPDATE refreshes ONLY
 * title, rule_summary and legal_basis from the current library content -
 * the fields that legitimately drift when the source text is corrected -
 * and never touches the user-owned columns (workspace_control_id,
 * control_note, gap, blocker, owner_person_id, due_date, notes). "created"
 * counts genuinely new rows (via the `xmax = 0` trick, Postgres's standard
 * "was this an insert or an update" test on a RETURNING row); every existing
 * row that matched is counted in "existing" whether or not its title/summary
 * needed refreshing. Runs in one transaction so a generate is all-or-nothing.
 */
export async function generateObligations(
  workspaceId: string,
  assessmentId: string,
  actor: string
): Promise<GenerateObligationsResult> {
  return withTransaction(async (client) => {
    const rows = await queryWithClient<ReadinessAssessmentRow>(
      client,
      `SELECT * FROM readiness_assessments WHERE workspace_id = $1 AND id = $2 FOR UPDATE`,
      [workspaceId, assessmentId]
    );
    const assessment = rows[0];
    if (!assessment) return { ok: false, reason: "not_found" };
    if (isFinalReadinessStatus(assessment.status)) return { ok: false, reason: "already_final" };

    const lookup = getCddProfile(assessment.entity_type as EntityType, assessment.jurisdiction as Jurisdiction);
    if (!lookup) return { ok: false, reason: "unknown_profile" };

    const requirements = buildRequirements(lookup.profile);

    let created = 0;
    let existing = 0;
    for (const req of requirements) {
      const requirementKey = req.id;
      const insertRows = await queryWithClient<{ id: string; inserted: boolean }>(
        client,
        `INSERT INTO readiness_obligations
           (workspace_id, assessment_id, requirement_key, category, title, rule_summary, legal_basis, applies_at_risk)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (assessment_id, requirement_key) DO UPDATE
           SET title = EXCLUDED.title,
               rule_summary = EXCLUDED.rule_summary,
               legal_basis = EXCLUDED.legal_basis,
               updated_at = now()
         RETURNING id, (xmax = 0) AS inserted`,
        [
          workspaceId,
          assessmentId,
          requirementKey,
          req.category,
          req.title,
          req.ruleSummary ?? null,
          JSON.stringify(req.legalBasis),
          JSON.stringify(req.appliesAtRisk),
        ]
      );
      if (insertRows[0]?.inserted) created += 1;
      else existing += 1;
    }

    await writeAudit(
      workspaceId,
      actor,
      "readiness_assessment.generated",
      SUBJECT_TYPE,
      assessmentId,
      { created, existing, entityType: assessment.entity_type, jurisdiction: assessment.jurisdiction },
      client
    );

    return { ok: true, created, existing };
  });
}

export interface UpdateReadinessObligationInput {
  workspaceControlId?: string | null;
  controlNote?: string | null;
  gap?: ReadinessGap;
  blocker?: boolean;
  ownerPersonId?: string | null;
  dueDate?: string | null;
  notes?: string | null;
}

export type UpdateReadinessObligationResult =
  | { ok: true; obligation: ReadinessObligationRow }
  | { ok: false; reason: "not_found" | "assessment_final" };

/**
 * Updates an obligation's mapping/gap/blocker/notes. Refuses once the parent
 * assessment is final (approved_global/rejected/cancelled) - a launch
 * decision's obligation register is a historical record from that point.
 * Runs in a transaction with SELECT ... FOR UPDATE on the PARENT assessment
 * row (not the obligation) so a concurrent approval and a concurrent
 * obligation edit cannot race past each other's guard.
 */
export async function updateReadinessObligation(
  workspaceId: string,
  assessmentId: string,
  id: string,
  input: UpdateReadinessObligationInput,
  actor: string
): Promise<UpdateReadinessObligationResult> {
  return withTransaction(async (client) => {
    const assessment = await getAssessmentWithClient(client, workspaceId, assessmentId);
    if (!assessment) return { ok: false, reason: "not_found" };
    if (isFinalReadinessStatus(assessment.status)) return { ok: false, reason: "assessment_final" };

    const currentRows = await queryWithClient<ReadinessObligationRow>(
      client,
      `SELECT * FROM readiness_obligations WHERE workspace_id = $1 AND assessment_id = $2 AND id = $3 FOR UPDATE`,
      [workspaceId, assessmentId, id]
    );
    const current = currentRows[0];
    if (!current) return { ok: false, reason: "not_found" };

    const workspaceControlId = input.workspaceControlId !== undefined ? input.workspaceControlId : current.workspace_control_id;
    const controlNote = input.controlNote !== undefined ? input.controlNote : current.control_note;
    const gap = input.gap ?? current.gap;
    const blocker = input.blocker !== undefined ? input.blocker : current.blocker;
    const ownerPersonId = input.ownerPersonId !== undefined ? input.ownerPersonId : current.owner_person_id;
    const dueDate = input.dueDate !== undefined ? input.dueDate : current.due_date;
    const notes = input.notes !== undefined ? input.notes : current.notes;

    const rows = await queryWithClient<ReadinessObligationRow>(
      client,
      `UPDATE readiness_obligations
       SET workspace_control_id = $4, control_note = $5, gap = $6, blocker = $7,
           owner_person_id = $8, due_date = $9, notes = $10, updated_at = now()
       WHERE workspace_id = $1 AND assessment_id = $2 AND id = $3
       RETURNING *`,
      [workspaceId, assessmentId, id, workspaceControlId, controlNote, gap, blocker, ownerPersonId, dueDate, notes]
    );

    const updated = rows[0];
    await writeAudit(
      workspaceId,
      actor,
      "readiness_obligation.updated",
      READINESS_OBLIGATION_SUBJECT_TYPE,
      id,
      { assessmentId, fields: Object.keys(input) },
      client
    );

    return { ok: true, obligation: updated };
  });
}

// ---------------------------------------------------------------------------
// summary
// ---------------------------------------------------------------------------

export async function readinessSummary(workspaceId: string, assessmentId: string): Promise<ReadinessSummary> {
  const obligations = await listReadinessObligations(workspaceId, assessmentId);
  return summarizeObligations(obligations);
}

// ---------------------------------------------------------------------------
// approval path: submit / approveLocal / approveGlobal / reject
// ---------------------------------------------------------------------------

export interface ApprovalInput {
  decidedByPersonId: string;
  rationale?: string | null;
  /**
   * Conditions to attach to the decision this call records. Inserted in the
   * SAME transaction as the status flip and the decision row (see
   * runApproval/reject below) so a condition write failure - e.g. a bad
   * dueDate that slips past validation, or any other constraint violation -
   * rolls back the status transition too, rather than leaving the record
   * permanently in its new status with the conditions the approver actually
   * signed off on silently discarded.
   */
  conditions?: CreateConditionInput[];
}

export type SubmitResult =
  | { ok: true; assessment: ReadinessAssessmentRow }
  | { ok: false; reason: "not_found" | "already_final" | "wrong_status" | "no_obligations" };

/** Moves a draft assessment to in_review. Requires at least one generated obligation - there is nothing to review otherwise. */
export async function submitForReview(workspaceId: string, assessmentId: string, actor: string): Promise<SubmitResult> {
  return withTransaction(async (client) => {
    const assessment = await getAssessmentWithClient(client, workspaceId, assessmentId);
    if (!assessment) return { ok: false, reason: "not_found" };
    if (isFinalReadinessStatus(assessment.status)) return { ok: false, reason: "already_final" };
    if (assessment.status !== "draft") return { ok: false, reason: "wrong_status" };

    const obligationCountRows = await queryWithClient<{ count: string }>(
      client,
      `SELECT COUNT(*)::text as count FROM readiness_obligations WHERE workspace_id = $1 AND assessment_id = $2`,
      [workspaceId, assessmentId]
    );
    const obligationCount = parseInt(obligationCountRows[0]?.count ?? "0", 10);
    if (obligationCount === 0) return { ok: false, reason: "no_obligations" };

    const rows = await queryWithClient<ReadinessAssessmentRow>(
      client,
      `UPDATE readiness_assessments SET status = 'in_review', updated_at = now()
       WHERE workspace_id = $1 AND id = $2 RETURNING *`,
      [workspaceId, assessmentId]
    );
    const updated = rows[0];

    await writeAudit(workspaceId, actor, "readiness_assessment.submitted", SUBJECT_TYPE, assessmentId, {}, client);
    return { ok: true, assessment: updated };
  });
}

export type ApprovalResult =
  | { ok: true; assessment: ReadinessAssessmentRow; decision: DecisionRow; conditions: ConditionRow[] }
  | { ok: false; reason: "not_found" | "already_final" | "wrong_status" | "unresolved_blockers" | "not_locally_approved" };

/**
 * Approves an assessment at the local level. Refuses (unresolved_blockers)
 * while ANY obligation has blocker = true and gap != 'full' - a launch
 * blocker that has not been fully resolved is exactly what must stop an
 * approval; that guard is the module's reason to exist. Requires the
 * assessment to be in_review (wrong_status otherwise). Runs in a single
 * transaction with SELECT ... FOR UPDATE on the assessment row so a
 * concurrent obligation edit that would flip the blocker check cannot race
 * past this guard, mirroring closeIncident in lib/repo/incidents.ts.
 */
export async function approveLocal(workspaceId: string, assessmentId: string, input: ApprovalInput, actor: string): Promise<ApprovalResult> {
  return runApproval(workspaceId, assessmentId, input, actor, {
    requiredStatus: "in_review",
    wrongStatusIsNotLocallyApproved: false,
    nextStatus: "approved_local",
    verb: "readiness_assessment.approved_local",
    checkBlockers: true,
  });
}

/**
 * Approves an assessment at the global level. Requires the assessment to
 * already be approved_local (not_locally_approved otherwise) - global
 * approval is the second signature on top of local, never a replacement for
 * it. Re-checks unresolved blockers for the same reason as approveLocal: an
 * obligation could have been edited back to an unresolved blocker state
 * between the local and global approval.
 */
export async function approveGlobal(workspaceId: string, assessmentId: string, input: ApprovalInput, actor: string): Promise<ApprovalResult> {
  return runApproval(workspaceId, assessmentId, input, actor, {
    requiredStatus: "approved_local",
    wrongStatusIsNotLocallyApproved: true,
    nextStatus: "approved_global",
    verb: "readiness_assessment.approved_global",
    checkBlockers: true,
  });
}

export type RejectResult =
  | { ok: true; assessment: ReadinessAssessmentRow; decision: DecisionRow; conditions: ConditionRow[] }
  | { ok: false; reason: "not_found" | "already_final" };

/** Rejects an assessment from any non-final status. A rejection records a decision row like the approvals do, but is not blocked by outstanding gaps/blockers - a reviewer may reject an assessment precisely BECAUSE of them. */
export async function reject(workspaceId: string, assessmentId: string, input: ApprovalInput, actor: string): Promise<RejectResult> {
  return withTransaction(async (client) => {
    const assessment = await getAssessmentWithClient(client, workspaceId, assessmentId);
    if (!assessment) return { ok: false, reason: "not_found" };
    if (isFinalReadinessStatus(assessment.status)) return { ok: false, reason: "already_final" };

    const rows = await queryWithClient<ReadinessAssessmentRow>(
      client,
      `UPDATE readiness_assessments SET status = 'rejected', updated_at = now()
       WHERE workspace_id = $1 AND id = $2 RETURNING *`,
      [workspaceId, assessmentId]
    );
    const updated = rows[0];

    const decision = await createDecisionWithClient(
      client,
      workspaceId,
      {
        subjectType: SUBJECT_TYPE,
        subjectId: assessmentId,
        outcome: "reject",
        rationale: input.rationale ?? null,
        decidedByPersonId: input.decidedByPersonId,
      },
      actor
    );

    const conditions: ConditionRow[] = [];
    for (const conditionInput of input.conditions ?? []) {
      conditions.push(await createConditionWithClient(client, workspaceId, decision.id, conditionInput, actor));
    }

    await writeAudit(workspaceId, actor, "readiness_assessment.rejected", SUBJECT_TYPE, assessmentId, { decisionId: decision.id }, client);
    return { ok: true, assessment: updated, decision, conditions };
  });
}

interface RunApprovalOptions {
  requiredStatus: ReadinessStatus;
  wrongStatusIsNotLocallyApproved: boolean;
  nextStatus: ReadinessStatus;
  verb: string;
  checkBlockers: boolean;
}

async function runApproval(
  workspaceId: string,
  assessmentId: string,
  input: ApprovalInput,
  actor: string,
  options: RunApprovalOptions
): Promise<ApprovalResult> {
  return withTransaction(async (client) => {
    const assessment = await getAssessmentWithClient(client, workspaceId, assessmentId);
    if (!assessment) return { ok: false, reason: "not_found" };
    if (isFinalReadinessStatus(assessment.status)) return { ok: false, reason: "already_final" };
    if (assessment.status !== options.requiredStatus) {
      return { ok: false, reason: options.wrongStatusIsNotLocallyApproved ? "not_locally_approved" : "wrong_status" };
    }

    if (options.checkBlockers) {
      const blockerRows = await queryWithClient<{ count: string }>(
        client,
        `SELECT COUNT(*)::text as count FROM readiness_obligations
         WHERE workspace_id = $1 AND assessment_id = $2 AND blocker = true AND gap != 'full'`,
        [workspaceId, assessmentId]
      );
      const unresolvedCount = parseInt(blockerRows[0]?.count ?? "0", 10);
      if (unresolvedCount > 0) return { ok: false, reason: "unresolved_blockers" };
    }

    const rows = await queryWithClient<ReadinessAssessmentRow>(
      client,
      `UPDATE readiness_assessments SET status = $3, updated_at = now()
       WHERE workspace_id = $1 AND id = $2 RETURNING *`,
      [workspaceId, assessmentId, options.nextStatus]
    );
    const updated = rows[0];

    const conditionInputs = input.conditions ?? [];
    const decision = await createDecisionWithClient(
      client,
      workspaceId,
      {
        subjectType: SUBJECT_TYPE,
        subjectId: assessmentId,
        outcome: conditionInputs.length > 0 ? "approve_with_conditions" : "approve",
        rationale: input.rationale ?? null,
        decidedByPersonId: input.decidedByPersonId,
      },
      actor
    );

    // Conditions are inserted in this SAME transaction as the status flip and
    // decision above: a failure here (bad data, a constraint violation)
    // throws, withTransaction rolls the whole thing back, and the approver's
    // "subject to conditions" sign-off never ends up recorded as an
    // unconditional approval. See ApprovalInput's doc comment.
    const conditions: ConditionRow[] = [];
    for (const conditionInput of conditionInputs) {
      conditions.push(await createConditionWithClient(client, workspaceId, decision.id, conditionInput, actor));
    }

    await writeAudit(workspaceId, actor, options.verb, SUBJECT_TYPE, assessmentId, { decisionId: decision.id, status: options.nextStatus }, client);
    return { ok: true, assessment: updated, decision, conditions };
  });
}
