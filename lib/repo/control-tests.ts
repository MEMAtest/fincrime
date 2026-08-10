import { query, queryWithClient, withTransaction, type DbTransactionClient } from "@/lib/db";
import { writeAudit } from "./audit";
import { getControlBySlug } from "@/data/controls";
import { scoreTestEffectiveness, nextTestDueFrom, type FindingSeverity } from "@/data/scoring/test-effectiveness";
import { updateWorkspaceControlWithClient, type WorkspaceControlRow } from "./controls";

export type ControlTestMethod = "sample" | "walkthrough" | "reperformance" | "data_analysis" | "other";
export type ControlTestStatus = "planned" | "in_progress" | "complete" | "cancelled";
export type ControlTestResult = "pass" | "pass_with_findings" | "fail";

const SUBJECT_TYPE = "control_test";
const FINDING_SUBJECT_TYPE = "control_test_finding";

export interface ControlTestRow {
  id: string;
  workspace_id: string;
  workspace_control_id: string;
  title: string;
  method: ControlTestMethod | null;
  period_start: string | null;
  period_end: string | null;
  tester_person_id: string | null;
  sample_size: number | null;
  samples_passed: number | null;
  samples_failed: number | null;
  samples_partial: number | null;
  status: ControlTestStatus;
  result: ControlTestResult | null;
  conclusion: string | null;
  applied_rating: "strong" | "adequate" | "weak" | "not_assessed" | null;
  applied_version: number | null;
  tested_at: string | null;
  next_test_due: string | null;
  current_step: number;
  created_at: string;
  updated_at: string;
}

export interface ControlTestFindingRow {
  id: string;
  workspace_id: string;
  test_id: string;
  description: string;
  severity: FindingSeverity;
  sample_ref: string | null;
  action_id: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// control_tests
// ---------------------------------------------------------------------------

export interface CreateControlTestInput {
  workspaceControlId: string;
  title: string;
  method?: ControlTestMethod | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  testerPersonId?: string | null;
}

export async function listControlTests(workspaceId: string): Promise<ControlTestRow[]> {
  return query<ControlTestRow>(`SELECT * FROM control_tests WHERE workspace_id = $1 ORDER BY created_at DESC`, [
    workspaceId,
  ]);
}

export async function listControlTestsByControl(workspaceId: string, workspaceControlId: string): Promise<ControlTestRow[]> {
  return query<ControlTestRow>(
    `SELECT * FROM control_tests WHERE workspace_id = $1 AND workspace_control_id = $2 ORDER BY created_at DESC`,
    [workspaceId, workspaceControlId]
  );
}

export async function getControlTest(workspaceId: string, id: string): Promise<ControlTestRow | null> {
  const rows = await query<ControlTestRow>(`SELECT * FROM control_tests WHERE workspace_id = $1 AND id = $2`, [
    workspaceId,
    id,
  ]);
  return rows[0] ?? null;
}

export async function createControlTest(
  workspaceId: string,
  input: CreateControlTestInput,
  actor: string
): Promise<ControlTestRow> {
  const rows = await query<ControlTestRow>(
    `INSERT INTO control_tests (workspace_id, workspace_control_id, title, method, period_start, period_end, tester_person_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      workspaceId,
      input.workspaceControlId,
      input.title,
      input.method ?? null,
      input.periodStart ?? null,
      input.periodEnd ?? null,
      input.testerPersonId ?? null,
    ]
  );
  const test = rows[0];

  await writeAudit(workspaceId, actor, "control_test.created", SUBJECT_TYPE, test.id, {
    workspaceControlId: input.workspaceControlId,
    title: input.title,
  });

  return test;
}

export interface UpdateControlTestInput {
  title?: string;
  method?: ControlTestMethod | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  testerPersonId?: string | null;
  sampleSize?: number | null;
  samplesPassed?: number | null;
  samplesFailed?: number | null;
  samplesPartial?: number | null;
  conclusion?: string | null;
  currentStep?: number;
  /** Only 'planned' <-> 'in_progress' is settable via this path; 'complete' is only reachable via completeControlTest. */
  status?: "planned" | "in_progress";
}

export async function updateControlTest(
  workspaceId: string,
  id: string,
  input: UpdateControlTestInput,
  actor: string
): Promise<ControlTestRow | null> {
  const current = await getControlTest(workspaceId, id);
  if (!current) return null;

  const title = input.title ?? current.title;
  const method = input.method !== undefined ? input.method : current.method;
  const periodStart = input.periodStart !== undefined ? input.periodStart : current.period_start;
  const periodEnd = input.periodEnd !== undefined ? input.periodEnd : current.period_end;
  const testerPersonId = input.testerPersonId !== undefined ? input.testerPersonId : current.tester_person_id;
  const sampleSize = input.sampleSize !== undefined ? input.sampleSize : current.sample_size;
  const samplesPassed = input.samplesPassed !== undefined ? input.samplesPassed : current.samples_passed;
  const samplesFailed = input.samplesFailed !== undefined ? input.samplesFailed : current.samples_failed;
  const samplesPartial = input.samplesPartial !== undefined ? input.samplesPartial : current.samples_partial;
  const conclusion = input.conclusion !== undefined ? input.conclusion : current.conclusion;
  const currentStep = input.currentStep ?? current.current_step;
  const status = input.status ?? current.status;

  const rows = await query<ControlTestRow>(
    `UPDATE control_tests
     SET title = $3, method = $4, period_start = $5, period_end = $6, tester_person_id = $7,
         sample_size = $8, samples_passed = $9, samples_failed = $10, samples_partial = $11,
         conclusion = $12, current_step = $13, status = $14, updated_at = now()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [
      workspaceId,
      id,
      title,
      method,
      periodStart,
      periodEnd,
      testerPersonId,
      sampleSize,
      samplesPassed,
      samplesFailed,
      samplesPartial,
      conclusion,
      currentStep,
      status,
    ]
  );

  const updated = rows[0] ?? null;
  if (updated) {
    await writeAudit(workspaceId, actor, "control_test.updated", SUBJECT_TYPE, id, { fields: Object.keys(input) });
  }
  return updated;
}

export async function deleteControlTest(workspaceId: string, id: string, actor: string): Promise<boolean> {
  const rows = await query<{ id: string }>(`DELETE FROM control_tests WHERE workspace_id = $1 AND id = $2 RETURNING id`, [
    workspaceId,
    id,
  ]);
  const deleted = rows.length > 0;

  if (deleted) {
    await writeAudit(workspaceId, actor, "control_test.deleted", SUBJECT_TYPE, id, {});
  }
  return deleted;
}

// ---------------------------------------------------------------------------
// control_test_findings
// ---------------------------------------------------------------------------

export interface CreateControlTestFindingInput {
  description: string;
  severity: FindingSeverity;
  sampleRef?: string | null;
  actionId?: string | null;
}

export async function listControlTestFindings(workspaceId: string, testId: string): Promise<ControlTestFindingRow[]> {
  return query<ControlTestFindingRow>(
    `SELECT * FROM control_test_findings WHERE workspace_id = $1 AND test_id = $2 ORDER BY created_at ASC`,
    [workspaceId, testId]
  );
}

export async function getControlTestFinding(workspaceId: string, id: string): Promise<ControlTestFindingRow | null> {
  const rows = await query<ControlTestFindingRow>(
    `SELECT * FROM control_test_findings WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, id]
  );
  return rows[0] ?? null;
}

/** Pass a transaction client when the finding must not be visible unless a sibling write (e.g. the action it spawned) also succeeds. */
export async function createControlTestFinding(
  workspaceId: string,
  testId: string,
  input: CreateControlTestFindingInput,
  actor: string,
  client?: DbTransactionClient
): Promise<ControlTestFindingRow> {
  const sql = `INSERT INTO control_test_findings (workspace_id, test_id, description, severity, sample_ref, action_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`;
  const params = [workspaceId, testId, input.description, input.severity, input.sampleRef ?? null, input.actionId ?? null];
  const rows = client
    ? await queryWithClient<ControlTestFindingRow>(client, sql, params)
    : await query<ControlTestFindingRow>(sql, params);
  const finding = rows[0];

  await writeAudit(
    workspaceId,
    actor,
    "control_test_finding.created",
    FINDING_SUBJECT_TYPE,
    finding.id,
    { testId, severity: input.severity },
    client
  );

  return finding;
}

export interface UpdateControlTestFindingInput {
  description?: string;
  severity?: FindingSeverity;
  sampleRef?: string | null;
}

export async function updateControlTestFinding(
  workspaceId: string,
  id: string,
  input: UpdateControlTestFindingInput,
  actor: string
): Promise<ControlTestFindingRow | null> {
  const current = await getControlTestFinding(workspaceId, id);
  if (!current) return null;

  const description = input.description ?? current.description;
  const severity = input.severity ?? current.severity;
  const sampleRef = input.sampleRef !== undefined ? input.sampleRef : current.sample_ref;

  const rows = await query<ControlTestFindingRow>(
    `UPDATE control_test_findings
     SET description = $3, severity = $4, sample_ref = $5, updated_at = now()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [workspaceId, id, description, severity, sampleRef]
  );

  const updated = rows[0] ?? null;
  if (updated) {
    await writeAudit(workspaceId, actor, "control_test_finding.updated", FINDING_SUBJECT_TYPE, id, {
      fields: Object.keys(input),
    });
  }
  return updated;
}

export async function deleteControlTestFinding(workspaceId: string, id: string, actor: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM control_test_findings WHERE workspace_id = $1 AND id = $2 RETURNING id`,
    [workspaceId, id]
  );
  const deleted = rows.length > 0;

  if (deleted) {
    await writeAudit(workspaceId, actor, "control_test_finding.deleted", FINDING_SUBJECT_TYPE, id, {});
  }
  return deleted;
}

// ---------------------------------------------------------------------------
// complete
// ---------------------------------------------------------------------------

async function getControlTestWithClient(
  client: DbTransactionClient,
  workspaceId: string,
  id: string
): Promise<ControlTestRow | null> {
  const rows = await queryWithClient<ControlTestRow>(
    client,
    `SELECT * FROM control_tests WHERE workspace_id = $1 AND id = $2 FOR UPDATE`,
    [workspaceId, id]
  );
  return rows[0] ?? null;
}

export type CompleteControlTestResult =
  | { ok: true; test: ControlTestRow; control: WorkspaceControlRow }
  | { ok: false; reason: "not_found" | "already_final" | "no_samples" | "counts_mismatch" };

/**
 * Completes a test cycle: recomputes result + rating from the STORED counts
 * and findings using data/scoring/test-effectiveness.ts (never trusts a
 * client-supplied rating), writes effectiveness_rating, last_tested_at and
 * next_test_due onto the linked workspace_control via
 * updateWorkspaceControlWithClient (so it version-bumps and snapshots to
 * object_versions with a change note referencing this test), then stamps the
 * test itself: status 'complete', result, applied_rating, applied_version,
 * tested_at, next_test_due. Runs in a single transaction; SELECT ... FOR
 * UPDATE on the test row guards against a concurrent second complete()
 * double-applying. 409-equivalent ("already_final") if the test is already
 * complete or cancelled; ("no_samples") if no samples were ever recorded -
 * completing then would silently wipe the control's rating to not_assessed,
 * which must never happen without the tester explicitly seeing why; ("counts_mismatch")
 * if a sample size was stated but the recorded pass/fail/partial counts
 * don't add up to it, so a materially incomplete count can never be scored
 * and written onto a live control as if it were final. Neither guard writes
 * anything to the control - they refuse before any write happens.
 */
export async function completeControlTest(
  workspaceId: string,
  testId: string,
  actor: string
): Promise<CompleteControlTestResult> {
  return withTransaction(async (client) => {
    const test = await getControlTestWithClient(client, workspaceId, testId);
    if (!test) return { ok: false, reason: "not_found" };
    if (test.status === "complete" || test.status === "cancelled") {
      return { ok: false, reason: "already_final" };
    }

    const findingRows = await queryWithClient<{ severity: FindingSeverity }>(
      client,
      `SELECT severity FROM control_test_findings WHERE workspace_id = $1 AND test_id = $2`,
      [workspaceId, testId]
    );

    const scored = scoreTestEffectiveness({
      sampleSize: test.sample_size,
      samplesPassed: test.samples_passed,
      samplesFailed: test.samples_failed,
      samplesPartial: test.samples_partial,
      findings: findingRows.map((f) => ({ severity: f.severity })),
    });

    if (scored.result === null) {
      return { ok: false, reason: "no_samples" };
    }

    const recordedTotal = (test.samples_passed ?? 0) + (test.samples_failed ?? 0) + (test.samples_partial ?? 0);
    if (test.sample_size !== null && test.sample_size !== recordedTotal) {
      return { ok: false, reason: "counts_mismatch" };
    }

    const testedAt = new Date();

    const controlRows = await queryWithClient<WorkspaceControlRow>(
      client,
      `SELECT * FROM workspace_controls WHERE workspace_id = $1 AND id = $2 FOR UPDATE`,
      [workspaceId, test.workspace_control_id]
    );
    const existingControl = controlRows[0];
    if (!existingControl) return { ok: false, reason: "not_found" };

    const libraryControl = existingControl.control_slug ? getControlBySlug(existingControl.control_slug) : undefined;
    const nextTestDue = nextTestDueFrom(testedAt, libraryControl?.reviewCadence ?? null);
    const nextTestDueIso = nextTestDue.toISOString().slice(0, 10);
    const testedAtIso = testedAt.toISOString();

    const control = await updateWorkspaceControlWithClient(
      client,
      workspaceId,
      test.workspace_control_id,
      {
        effectivenessRating: scored.rating,
        lastTestedAt: testedAtIso,
        nextTestDue: nextTestDueIso,
      },
      actor,
      `control test ${test.id} completed`
    );
    if (!control) return { ok: false, reason: "not_found" };

    const rows = await queryWithClient<ControlTestRow>(
      client,
      `UPDATE control_tests
       SET status = 'complete', result = $3, applied_rating = $4, applied_version = $5,
           tested_at = $6, next_test_due = $7, updated_at = now()
       WHERE workspace_id = $1 AND id = $2
       RETURNING *`,
      [workspaceId, testId, scored.result, scored.rating, control.version, testedAtIso, nextTestDueIso]
    );
    const updated = rows[0];

    await writeAudit(
      workspaceId,
      actor,
      "control_test.completed",
      SUBJECT_TYPE,
      testId,
      {
        workspaceControlId: test.workspace_control_id,
        result: scored.result,
        appliedRating: scored.rating,
        appliedVersion: control.version,
      },
      client
    );

    return { ok: true, test: updated, control };
  });
}
