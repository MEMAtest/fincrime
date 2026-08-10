import { query, queryWithClient, type DbTransactionClient } from "@/lib/db";
import { writeAudit } from "./audit";

export type DecisionOutcome = "approve" | "approve_with_conditions" | "reject";
export type ConditionStatus = "open" | "met" | "breached";

const DECISION_SUBJECT_TYPE = "decision";
const CONDITION_SUBJECT_TYPE = "condition";

// ---------------------------------------------------------------------------
// decisions
// ---------------------------------------------------------------------------

export interface DecisionRow {
  id: string;
  workspace_id: string;
  subject_type: string;
  subject_id: string;
  outcome: DecisionOutcome;
  rationale: string | null;
  decided_by_person_id: string;
  decided_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreateDecisionInput {
  subjectType: string;
  subjectId: string;
  outcome: DecisionOutcome;
  rationale?: string | null;
  decidedByPersonId: string;
}

export async function listDecisionsBySubject(
  workspaceId: string,
  subjectType: string,
  subjectId: string
): Promise<DecisionRow[]> {
  return query<DecisionRow>(
    `SELECT * FROM decisions
     WHERE workspace_id = $1 AND subject_type = $2 AND subject_id = $3
     ORDER BY decided_at DESC`,
    [workspaceId, subjectType, subjectId]
  );
}

/** Batch-loads decisions by id, scoped to the workspace, for callers (e.g. the governance portfolio) that would otherwise N+1 a getDecision per row - e.g. once per open condition, to resolve the parent decision's subject for a link. */
export async function listDecisionsByIds(workspaceId: string, ids: string[]): Promise<DecisionRow[]> {
  if (ids.length === 0) return [];
  return query<DecisionRow>(`SELECT * FROM decisions WHERE workspace_id = $1 AND id = ANY($2::uuid[])`, [workspaceId, ids]);
}

export async function getDecision(workspaceId: string, id: string): Promise<DecisionRow | null> {
  const rows = await query<DecisionRow>(`SELECT * FROM decisions WHERE workspace_id = $1 AND id = $2`, [
    workspaceId,
    id,
  ]);
  return rows[0] ?? null;
}

export async function createDecision(
  workspaceId: string,
  input: CreateDecisionInput,
  actor: string
): Promise<DecisionRow> {
  const rows = await query<DecisionRow>(
    `INSERT INTO decisions (workspace_id, subject_type, subject_id, outcome, rationale, decided_by_person_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [workspaceId, input.subjectType, input.subjectId, input.outcome, input.rationale || null, input.decidedByPersonId]
  );
  const decision = rows[0];

  await writeAudit(workspaceId, actor, "decision.created", DECISION_SUBJECT_TYPE, decision.id, {
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    outcome: input.outcome,
  });

  return decision;
}

/**
 * Same behaviour as createDecision, but participates in a caller-supplied
 * transaction instead of opening its own. For callers (e.g. the readiness
 * approval path in lib/repo/readiness.ts) that must write the decision and
 * the status transition it records atomically in a single transaction, so a
 * crash between the two never leaves an approved-looking status with no
 * decision row backing it, or vice versa.
 */
export async function createDecisionWithClient(
  client: DbTransactionClient,
  workspaceId: string,
  input: CreateDecisionInput,
  actor: string
): Promise<DecisionRow> {
  const rows = await queryWithClient<DecisionRow>(
    client,
    `INSERT INTO decisions (workspace_id, subject_type, subject_id, outcome, rationale, decided_by_person_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [workspaceId, input.subjectType, input.subjectId, input.outcome, input.rationale || null, input.decidedByPersonId]
  );
  const decision = rows[0];

  await writeAudit(
    workspaceId,
    actor,
    "decision.created",
    DECISION_SUBJECT_TYPE,
    decision.id,
    { subjectType: input.subjectType, subjectId: input.subjectId, outcome: input.outcome },
    client
  );

  return decision;
}

export async function deleteDecision(workspaceId: string, id: string, actor: string): Promise<boolean> {
  const rows = await query<{ id: string }>(`DELETE FROM decisions WHERE workspace_id = $1 AND id = $2 RETURNING id`, [
    workspaceId,
    id,
  ]);
  const deleted = rows.length > 0;

  if (deleted) {
    await writeAudit(workspaceId, actor, "decision.deleted", DECISION_SUBJECT_TYPE, id, {});
  }
  return deleted;
}

// ---------------------------------------------------------------------------
// conditions
// ---------------------------------------------------------------------------

export interface ConditionRow {
  id: string;
  workspace_id: string;
  decision_id: string;
  description: string;
  due_date: string | null;
  status: ConditionStatus;
  owner_person_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateConditionInput {
  description: string;
  dueDate?: string | null;
  ownerPersonId?: string | null;
}

export async function listConditionsByDecision(workspaceId: string, decisionId: string): Promise<ConditionRow[]> {
  return query<ConditionRow>(
    `SELECT * FROM conditions WHERE workspace_id = $1 AND decision_id = $2 ORDER BY created_at ASC`,
    [workspaceId, decisionId]
  );
}

export async function getCondition(workspaceId: string, id: string): Promise<ConditionRow | null> {
  const rows = await query<ConditionRow>(`SELECT * FROM conditions WHERE workspace_id = $1 AND id = $2`, [
    workspaceId,
    id,
  ]);
  return rows[0] ?? null;
}

/** Non-terminal conditions (not yet met or breached) with a due date in the past, across the whole workspace. */
export async function listOverdueConditions(workspaceId: string): Promise<ConditionRow[]> {
  return query<ConditionRow>(
    `SELECT * FROM conditions
     WHERE workspace_id = $1 AND status NOT IN ('met', 'breached') AND due_date IS NOT NULL AND due_date < CURRENT_DATE
     ORDER BY due_date ASC`,
    [workspaceId]
  );
}

/**
 * Every non-terminal condition (not yet met or breached) across the whole
 * workspace, regardless of due date - a superset of listOverdueConditions.
 * The governance dashboard's "open launch conditions" surface: a condition
 * with no due date (or one not yet due) is still open work a committee needs
 * to see, not just the overdue subset.
 */
export async function listOpenConditions(workspaceId: string): Promise<ConditionRow[]> {
  return query<ConditionRow>(
    `SELECT * FROM conditions
     WHERE workspace_id = $1 AND status NOT IN ('met', 'breached')
     ORDER BY due_date ASC NULLS LAST`,
    [workspaceId]
  );
}

export async function createCondition(
  workspaceId: string,
  decisionId: string,
  input: CreateConditionInput,
  actor: string
): Promise<ConditionRow> {
  const rows = await query<ConditionRow>(
    `INSERT INTO conditions (workspace_id, decision_id, description, due_date, owner_person_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [workspaceId, decisionId, input.description, input.dueDate || null, input.ownerPersonId || null]
  );
  const condition = rows[0];

  await writeAudit(workspaceId, actor, "condition.created", CONDITION_SUBJECT_TYPE, condition.id, {
    decisionId,
    description: input.description,
  });

  return condition;
}

/**
 * Same behaviour as createCondition, but participates in a caller-supplied
 * transaction instead of opening its own. Mirrors createDecisionWithClient:
 * callers that must write a decision and its conditions atomically with the
 * status transition they record (e.g. approveLocal/approveGlobal/reject in
 * lib/repo/readiness.ts) use this so a condition insert failure - a bad
 * dueDate slipping past validation, a constraint violation, anything - rolls
 * back the whole transaction rather than leaving the status flipped and the
 * decision recorded with its conditions silently missing.
 */
export async function createConditionWithClient(
  client: DbTransactionClient,
  workspaceId: string,
  decisionId: string,
  input: CreateConditionInput,
  actor: string
): Promise<ConditionRow> {
  const rows = await queryWithClient<ConditionRow>(
    client,
    `INSERT INTO conditions (workspace_id, decision_id, description, due_date, owner_person_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [workspaceId, decisionId, input.description, input.dueDate || null, input.ownerPersonId || null]
  );
  const condition = rows[0];

  await writeAudit(
    workspaceId,
    actor,
    "condition.created",
    CONDITION_SUBJECT_TYPE,
    condition.id,
    { decisionId, description: input.description },
    client
  );

  return condition;
}

export interface UpdateConditionInput {
  description?: string;
  dueDate?: string | null;
  status?: ConditionStatus;
  ownerPersonId?: string | null;
}

export async function updateCondition(
  workspaceId: string,
  id: string,
  input: UpdateConditionInput,
  actor: string
): Promise<ConditionRow | null> {
  const current = await getCondition(workspaceId, id);
  if (!current) return null;

  const description = input.description ?? current.description;
  const dueDate = input.dueDate !== undefined ? input.dueDate : current.due_date;
  const status = input.status ?? current.status;
  const ownerPersonId = input.ownerPersonId !== undefined ? input.ownerPersonId : current.owner_person_id;

  const rows = await query<ConditionRow>(
    `UPDATE conditions
     SET description = $3, due_date = $4, status = $5, owner_person_id = $6, updated_at = now()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [workspaceId, id, description, dueDate, status, ownerPersonId]
  );

  const updated = rows[0] ?? null;
  if (updated) {
    await writeAudit(workspaceId, actor, "condition.updated", CONDITION_SUBJECT_TYPE, id, { fields: Object.keys(input) });
  }
  return updated;
}

export async function deleteCondition(workspaceId: string, id: string, actor: string): Promise<boolean> {
  const rows = await query<{ id: string }>(`DELETE FROM conditions WHERE workspace_id = $1 AND id = $2 RETURNING id`, [
    workspaceId,
    id,
  ]);
  const deleted = rows.length > 0;

  if (deleted) {
    await writeAudit(workspaceId, actor, "condition.deleted", CONDITION_SUBJECT_TYPE, id, {});
  }
  return deleted;
}
