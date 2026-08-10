import { query, queryWithClient, withTransaction, type DbTransactionClient } from "@/lib/db";
import { writeAudit } from "./audit";
import { createDecisionWithClient, createConditionWithClient, type DecisionRow, type ConditionRow, type CreateConditionInput } from "./decisions";
import { createAction, type ActionRow } from "./actions";
import { getWorkspaceControl } from "./controls";
import { getControlTest } from "./control-tests";
import { getControlChange } from "./control-changes";
import { getIncident } from "./incidents";
import { getReadinessAssessment } from "./readiness";
import { getAssessment } from "./assessments";
import { getEvidence } from "./evidence";
import { regResponseSummary as summarize, type RegResponseSummary } from "../reg-response/summary";

export type RegRequestChannel = "email" | "portal" | "letter" | "meeting" | "s165" | "other";
export type RegRequestStatus = "draft" | "in_progress" | "in_review" | "approved" | "submitted" | "closed" | "cancelled";
export type RegQuestionStatus = "unanswered" | "drafted" | "reviewed";
export type RegQuestionLinkType =
  | "workspace_control"
  | "control_test"
  | "control_change"
  | "incident"
  | "readiness_assessment"
  | "pra_assessment"
  | "evidence";
export type RegCommitmentStatus = "open" | "in_progress" | "met" | "missed" | "withdrawn";

const SUBJECT_TYPE = "reg_request";
export const REG_REQUEST_SUBJECT_TYPE = SUBJECT_TYPE;
export const REG_COMMITMENT_SUBJECT_TYPE = "reg_commitment";

/** Terminal statuses: the request is a historical record and may not be mutated further via the general PATCH/child-mutation paths. */
export function isFinalRegRequestStatus(status: RegRequestStatus): boolean {
  return status === "closed" || status === "cancelled";
}

/** Terminal commitment statuses: no further work is expected against them. */
export function isTerminalCommitmentStatus(status: RegCommitmentStatus): boolean {
  return status === "met" || status === "missed" || status === "withdrawn";
}

export interface RegRequestRow {
  id: string;
  workspace_id: string;
  reference: string | null;
  title: string;
  regulator: string;
  channel: RegRequestChannel | null;
  received_at: string | null;
  deadline: string | null;
  status: RegRequestStatus;
  submitted_at: string | null;
  owner_person_id: string | null;
  summary: string | null;
  current_step: number;
  created_at: string;
  updated_at: string;
}

export interface RegQuestionRow {
  id: string;
  workspace_id: string;
  request_id: string;
  position: number;
  question: string;
  response: string | null;
  exception_note: string | null;
  status: RegQuestionStatus;
  created_at: string;
  updated_at: string;
}

export interface RegQuestionLinkRow {
  id: string;
  workspace_id: string;
  question_id: string;
  link_type: RegQuestionLinkType;
  target_id: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegCommitmentRow {
  id: string;
  workspace_id: string;
  request_id: string;
  question_id: string | null;
  description: string;
  due_date: string | null;
  owner_person_id: string | null;
  status: RegCommitmentStatus;
  action_id: string | null;
  met_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// reg_requests
// ---------------------------------------------------------------------------

export interface CreateRegRequestInput {
  title: string;
  reference?: string | null;
  regulator?: string;
  channel?: RegRequestChannel | null;
  receivedAt?: string | null;
  deadline?: string | null;
  ownerPersonId?: string | null;
  summary?: string | null;
}

export interface ListRegRequestsFilter {
  status?: RegRequestStatus;
}

export async function listRegRequests(workspaceId: string, filter: ListRegRequestsFilter = {}): Promise<RegRequestRow[]> {
  if (filter.status) {
    return query<RegRequestRow>(`SELECT * FROM reg_requests WHERE workspace_id = $1 AND status = $2 ORDER BY created_at DESC`, [
      workspaceId,
      filter.status,
    ]);
  }
  return query<RegRequestRow>(`SELECT * FROM reg_requests WHERE workspace_id = $1 ORDER BY created_at DESC`, [workspaceId]);
}

export interface RegRequestWithSummary extends RegRequestRow {
  /**
   * The roll-up summary, named `progress` (not `summary`) because
   * RegRequestRow already has a `summary` column - the request's own
   * free-text summary field - and attaching the roll-up under that same key
   * would silently clobber it.
   */
  progress: RegResponseSummary;
}

/**
 * Same rows as listRegRequests, with each request's roll-up summary
 * attached - for the list page's per-row progress/commitment counts, which
 * previously fetched the full detail endpoint per listed request purely for
 * this arithmetic (an N+1: one GET per row). Fetches every question and
 * every commitment for the whole matching set of requests in TWO queries
 * total (not one per request), then groups them in memory before calling
 * the same regResponseSummary arithmetic the detail endpoint uses, so the
 * two never drift.
 */
export async function listRegRequestsWithSummary(
  workspaceId: string,
  filter: ListRegRequestsFilter = {}
): Promise<RegRequestWithSummary[]> {
  const requests = await listRegRequests(workspaceId, filter);
  if (requests.length === 0) return [];

  const ids = requests.map((r) => r.id);
  const [questions, commitments] = await Promise.all([
    query<{ request_id: string; status: RegQuestionStatus }>(
      `SELECT request_id, status FROM reg_questions WHERE workspace_id = $1 AND request_id = ANY($2::uuid[])`,
      [workspaceId, ids]
    ),
    query<{ request_id: string; status: RegCommitmentStatus; due_date: string | Date | null }>(
      `SELECT request_id, status, due_date FROM reg_commitments WHERE workspace_id = $1 AND request_id = ANY($2::uuid[])`,
      [workspaceId, ids]
    ),
  ]);

  const questionsByRequest = new Map<string, { status: RegQuestionStatus }[]>();
  for (const q of questions) {
    const bucket = questionsByRequest.get(q.request_id);
    if (bucket) bucket.push({ status: q.status });
    else questionsByRequest.set(q.request_id, [{ status: q.status }]);
  }

  const commitmentsByRequest = new Map<string, { status: RegCommitmentStatus; due_date: string | Date | null }[]>();
  for (const c of commitments) {
    const bucket = commitmentsByRequest.get(c.request_id);
    if (bucket) bucket.push({ status: c.status, due_date: c.due_date });
    else commitmentsByRequest.set(c.request_id, [{ status: c.status, due_date: c.due_date }]);
  }

  return requests.map((r) => ({
    ...r,
    progress: summarize(questionsByRequest.get(r.id) ?? [], commitmentsByRequest.get(r.id) ?? [], r.deadline),
  }));
}

export async function getRegRequest(workspaceId: string, id: string): Promise<RegRequestRow | null> {
  const rows = await query<RegRequestRow>(`SELECT * FROM reg_requests WHERE workspace_id = $1 AND id = $2`, [workspaceId, id]);
  return rows[0] ?? null;
}

export async function createRegRequest(workspaceId: string, input: CreateRegRequestInput, actor: string): Promise<RegRequestRow> {
  const rows = await query<RegRequestRow>(
    `INSERT INTO reg_requests (workspace_id, title, reference, regulator, channel, received_at, deadline, owner_person_id, summary)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      workspaceId,
      input.title,
      input.reference ?? null,
      input.regulator ?? "FCA",
      input.channel ?? null,
      input.receivedAt ?? null,
      input.deadline ?? null,
      input.ownerPersonId ?? null,
      input.summary ?? null,
    ]
  );
  const request = rows[0];

  await writeAudit(workspaceId, actor, "reg_request.created", SUBJECT_TYPE, request.id, { title: input.title, regulator: request.regulator });
  return request;
}

export interface UpdateRegRequestInput {
  title?: string;
  reference?: string | null;
  regulator?: string;
  channel?: RegRequestChannel | null;
  receivedAt?: string | null;
  deadline?: string | null;
  ownerPersonId?: string | null;
  summary?: string | null;
  currentStep?: number;
}

export type UpdateRegRequestResult = { ok: true; request: RegRequestRow } | { ok: false; reason: "not_found" | "already_final" };

/**
 * Updates a reg_request (never status - that only moves via approve/submit/
 * close/reject, each with its own guarded path). Runs in a transaction with
 * SELECT ... FOR UPDATE so a concurrent PATCH cannot race past a status
 * transition to final, mirroring updateReadinessAssessment.
 */
export async function updateRegRequest(
  workspaceId: string,
  id: string,
  input: UpdateRegRequestInput,
  actor: string
): Promise<UpdateRegRequestResult> {
  return withTransaction(async (client) => {
    const current = await getRequestWithClient(client, workspaceId, id);
    if (!current) return { ok: false, reason: "not_found" };
    if (isFinalRegRequestStatus(current.status)) return { ok: false, reason: "already_final" };

    const title = input.title ?? current.title;
    const reference = input.reference !== undefined ? input.reference : current.reference;
    const regulator = input.regulator ?? current.regulator;
    const channel = input.channel !== undefined ? input.channel : current.channel;
    const receivedAt = input.receivedAt !== undefined ? input.receivedAt : current.received_at;
    const deadline = input.deadline !== undefined ? input.deadline : current.deadline;
    const ownerPersonId = input.ownerPersonId !== undefined ? input.ownerPersonId : current.owner_person_id;
    const summary = input.summary !== undefined ? input.summary : current.summary;
    const currentStep = input.currentStep ?? current.current_step;

    const rows = await queryWithClient<RegRequestRow>(
      client,
      `UPDATE reg_requests
       SET title = $3, reference = $4, regulator = $5, channel = $6, received_at = $7, deadline = $8,
           owner_person_id = $9, summary = $10, current_step = $11, updated_at = now()
       WHERE workspace_id = $1 AND id = $2 AND status NOT IN ('closed', 'cancelled')
       RETURNING *`,
      [workspaceId, id, title, reference, regulator, channel, receivedAt, deadline, ownerPersonId, summary, currentStep]
    );
    const updated = rows[0];
    if (!updated) return { ok: false, reason: "already_final" };

    await writeAudit(workspaceId, actor, "reg_request.updated", SUBJECT_TYPE, id, { fields: Object.keys(input) }, client);
    return { ok: true, request: updated };
  });
}

export type DeleteRegRequestResult = { ok: true } | { ok: false; reason: "not_found" | "already_final" };

/**
 * Deletes a reg_request. 'closed' is never deletable (it went all the way
 * through submission, a real historical record). 'cancelled' is normally
 * blocked too, EXCEPT when the request never accumulated any substantive
 * work (zero questions, zero commitments) - that is the create-then-reject
 * shape of an empty draft opened by mistake, and without this exception it
 * is permanent, undeletable junk (PATCH is already unconditionally blocked
 * on a final status, so DELETE is the only way out).
 */
export async function deleteRegRequest(workspaceId: string, id: string, actor: string): Promise<DeleteRegRequestResult> {
  return withTransaction(async (client) => {
    const current = await getRequestWithClient(client, workspaceId, id);
    if (!current) return { ok: false, reason: "not_found" };

    if (isFinalRegRequestStatus(current.status)) {
      if (current.status !== "cancelled") return { ok: false, reason: "already_final" };

      const substanceRows = await queryWithClient<{ count: string }>(
        client,
        `SELECT
           (SELECT COUNT(*) FROM reg_questions WHERE workspace_id = $1 AND request_id = $2) +
           (SELECT COUNT(*) FROM reg_commitments WHERE workspace_id = $1 AND request_id = $2) AS count`,
        [workspaceId, id]
      );
      const hasSubstance = parseInt(substanceRows[0]?.count ?? "0", 10) > 0;
      if (hasSubstance) return { ok: false, reason: "already_final" };
    }

    const rows = await queryWithClient<{ id: string }>(client, `DELETE FROM reg_requests WHERE workspace_id = $1 AND id = $2 RETURNING id`, [
      workspaceId,
      id,
    ]);
    if (rows.length === 0) return { ok: false, reason: "already_final" };

    await writeAudit(workspaceId, actor, "reg_request.deleted", SUBJECT_TYPE, id, {}, client);
    return { ok: true };
  });
}

async function getRequestWithClient(client: DbTransactionClient, workspaceId: string, id: string): Promise<RegRequestRow | null> {
  const rows = await queryWithClient<RegRequestRow>(client, `SELECT * FROM reg_requests WHERE workspace_id = $1 AND id = $2 FOR UPDATE`, [
    workspaceId,
    id,
  ]);
  return rows[0] ?? null;
}

export type WithRegRequestLockResult<T> = { ok: true; request: RegRequestRow; result: T } | { ok: false; reason: "not_found" | "already_final" };

/**
 * Locks the parent reg_request row (SELECT ... FOR UPDATE) and re-checks it
 * is non-final, then runs `work` in the SAME transaction before committing.
 * Every child write under a request (questions, links, commitments,
 * evidence) MUST route through this - reading request.status with a plain
 * SELECT before an unrelated INSERT leaves a window where a concurrent
 * approve/close/reject can flip the request to final in between, letting a
 * child row land on an already-finalised record (the Phase 4 catastrophe
 * this codebase already shipped once). Mirrors withReadinessAssessmentLock.
 */
export async function withRegRequestLock<T>(
  workspaceId: string,
  requestId: string,
  work: (client: DbTransactionClient, request: RegRequestRow) => Promise<T>
): Promise<WithRegRequestLockResult<T>> {
  return withTransaction(async (client) => {
    const request = await getRequestWithClient(client, workspaceId, requestId);
    if (!request) return { ok: false, reason: "not_found" };
    if (isFinalRegRequestStatus(request.status)) return { ok: false, reason: "already_final" };
    const result = await work(client, request);
    return { ok: true, request, result };
  });
}

// ---------------------------------------------------------------------------
// reg_questions
// ---------------------------------------------------------------------------

export async function listRegQuestions(workspaceId: string, requestId: string): Promise<RegQuestionRow[]> {
  return query<RegQuestionRow>(`SELECT * FROM reg_questions WHERE workspace_id = $1 AND request_id = $2 ORDER BY position ASC`, [
    workspaceId,
    requestId,
  ]);
}

export async function getRegQuestion(workspaceId: string, id: string): Promise<RegQuestionRow | null> {
  const rows = await query<RegQuestionRow>(`SELECT * FROM reg_questions WHERE workspace_id = $1 AND id = $2`, [workspaceId, id]);
  return rows[0] ?? null;
}

export interface CreateRegQuestionInput {
  question: string;
  response?: string | null;
  exceptionNote?: string | null;
}

export type CreateRegQuestionResult = { ok: true; question: RegQuestionRow } | { ok: false; reason: "not_found" | "already_final" };

/** Appends a question at the next position (1-based). Position is never client-supplied at creation - see reorderRegQuestions for reordering. */
export async function createRegQuestion(
  workspaceId: string,
  requestId: string,
  input: CreateRegQuestionInput,
  actor: string
): Promise<CreateRegQuestionResult> {
  const locked = await withRegRequestLock(workspaceId, requestId, async (client) => {
    const posRows = await queryWithClient<{ next: number }>(
      client,
      `SELECT COALESCE(MAX(position), 0) + 1 AS next FROM reg_questions WHERE workspace_id = $1 AND request_id = $2`,
      [workspaceId, requestId]
    );
    const nextPosition = posRows[0]?.next ?? 1;

    const rows = await queryWithClient<RegQuestionRow>(
      client,
      `INSERT INTO reg_questions (workspace_id, request_id, position, question, response, exception_note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [workspaceId, requestId, nextPosition, input.question, input.response ?? null, input.exceptionNote ?? null]
    );
    const question = rows[0];

    await writeAudit(workspaceId, actor, "reg_question.created", "reg_question", question.id, { requestId, position: nextPosition }, client);
    return question;
  });

  if (!locked.ok) return locked;
  return { ok: true, question: locked.result };
}

export interface UpdateRegQuestionInput {
  question?: string;
  response?: string | null;
  exceptionNote?: string | null;
  status?: RegQuestionStatus;
}

export type UpdateRegQuestionResult =
  | { ok: true; question: RegQuestionRow }
  | { ok: false; reason: "not_found" | "already_final" | "question_not_found" | "answer_required" };

/**
 * Updates a question. Refuses (answer_required) a status of 'drafted' or
 * 'reviewed' unless the MERGED post-patch row (this patch's response/
 * exceptionNote, falling back to what is already stored) has non-empty text
 * in response OR exception_note - checking the request body alone would let
 * {status: "reviewed"} on an already-empty question through unchallenged. A
 * question with a status flag but no answer text and no acknowledged
 * exception is exactly what approveResponse's unanswered_questions guard
 * exists to catch, and a status-only field defeats it.
 */
export async function updateRegQuestion(
  workspaceId: string,
  requestId: string,
  questionId: string,
  input: UpdateRegQuestionInput,
  actor: string
): Promise<UpdateRegQuestionResult> {
  const locked = await withRegRequestLock(workspaceId, requestId, async (client) => {
    const currentRows = await queryWithClient<RegQuestionRow>(
      client,
      `SELECT * FROM reg_questions WHERE workspace_id = $1 AND request_id = $2 AND id = $3 FOR UPDATE`,
      [workspaceId, requestId, questionId]
    );
    const current = currentRows[0];
    if (!current) return { ok: false as const, reason: "question_not_found" as const };

    const question = input.question ?? current.question;
    const response = input.response !== undefined ? input.response : current.response;
    const exceptionNote = input.exceptionNote !== undefined ? input.exceptionNote : current.exception_note;
    const status = input.status ?? current.status;

    if ((status === "drafted" || status === "reviewed") && !response?.trim() && !exceptionNote?.trim()) {
      return { ok: false as const, reason: "answer_required" as const };
    }

    const rows = await queryWithClient<RegQuestionRow>(
      client,
      `UPDATE reg_questions
       SET question = $4, response = $5, exception_note = $6, status = $7, updated_at = now()
       WHERE workspace_id = $1 AND request_id = $2 AND id = $3
       RETURNING *`,
      [workspaceId, requestId, questionId, question, response, exceptionNote, status]
    );
    const updated = rows[0];

    await writeAudit(workspaceId, actor, "reg_question.updated", "reg_question", questionId, { requestId, fields: Object.keys(input) }, client);
    return { ok: true as const, question: updated };
  });

  if (!locked.ok) return locked;
  if (!locked.result.ok) return { ok: false, reason: locked.result.reason };
  return { ok: true, question: locked.result.question };
}

export type DeleteRegQuestionResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "already_final" | "question_not_found" };

/** Deletes a question and renumbers the remaining questions to stay contiguous (1..n) so the UNIQUE (request_id, position) constraint is never a trap for the next insert. */
export async function deleteRegQuestion(workspaceId: string, requestId: string, questionId: string, actor: string): Promise<DeleteRegQuestionResult> {
  const locked = await withRegRequestLock(workspaceId, requestId, async (client) => {
    const deletedRows = await queryWithClient<{ id: string }>(
      client,
      `DELETE FROM reg_questions WHERE workspace_id = $1 AND request_id = $2 AND id = $3 RETURNING id`,
      [workspaceId, requestId, questionId]
    );
    if (deletedRows.length === 0) return false;

    const remaining = await queryWithClient<{ id: string }>(
      client,
      `SELECT id FROM reg_questions WHERE workspace_id = $1 AND request_id = $2 ORDER BY position ASC`,
      [workspaceId, requestId]
    );
    await renumberQuestions(client, workspaceId, requestId, remaining.map((r) => r.id));

    await writeAudit(workspaceId, actor, "reg_question.deleted", "reg_question", questionId, { requestId }, client);
    return true;
  });

  if (!locked.ok) return locked;
  if (!locked.result) return { ok: false, reason: "question_not_found" };
  return { ok: true };
}

export type ReorderRegQuestionsResult =
  | { ok: true; questions: RegQuestionRow[] }
  | { ok: false; reason: "not_found" | "already_final" | "invalid_question_set" };

/**
 * Reorders every question under a request to match `orderedQuestionIds`
 * (must be exactly the request's current question ids, each exactly once -
 * anything else is rejected as invalid_question_set rather than silently
 * dropping or duplicating a question's position). Renumbers in TWO passes
 * inside one transaction: first every touched row moves to a negative
 * temporary position, then to its final 1-based position - a single pass
 * would collide with the UNIQUE (request_id, position) constraint the
 * moment two rows' old and new positions overlap.
 */
export async function reorderRegQuestions(
  workspaceId: string,
  requestId: string,
  orderedQuestionIds: string[],
  actor: string
): Promise<ReorderRegQuestionsResult> {
  const locked = await withRegRequestLock(workspaceId, requestId, async (client) => {
    const existing = await queryWithClient<{ id: string }>(
      client,
      `SELECT id FROM reg_questions WHERE workspace_id = $1 AND request_id = $2 FOR UPDATE`,
      [workspaceId, requestId]
    );
    const existingIds = new Set(existing.map((r) => r.id));
    const suppliedIds = new Set(orderedQuestionIds);
    const sameSize = existingIds.size === suppliedIds.size && existingIds.size === orderedQuestionIds.length;
    const sameMembers = sameSize && orderedQuestionIds.every((id) => existingIds.has(id));
    if (!sameSize || !sameMembers) return { ok: false as const };

    await renumberQuestions(client, workspaceId, requestId, orderedQuestionIds);
    await writeAudit(workspaceId, actor, "reg_question.reordered", "reg_question", requestId, { requestId }, client);

    const questions = await queryWithClient<RegQuestionRow>(
      client,
      `SELECT * FROM reg_questions WHERE workspace_id = $1 AND request_id = $2 ORDER BY position ASC`,
      [workspaceId, requestId]
    );
    return { ok: true as const, questions };
  });

  if (!locked.ok) return locked;
  if (!locked.result.ok) return { ok: false, reason: "invalid_question_set" };
  return { ok: true, questions: locked.result.questions };
}

async function renumberQuestions(client: DbTransactionClient, workspaceId: string, requestId: string, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i += 1) {
    await queryWithClient(client, `UPDATE reg_questions SET position = $4, updated_at = now() WHERE workspace_id = $1 AND request_id = $2 AND id = $3`, [
      workspaceId,
      requestId,
      orderedIds[i],
      -(i + 1),
    ]);
  }
  for (let i = 0; i < orderedIds.length; i += 1) {
    await queryWithClient(client, `UPDATE reg_questions SET position = $4, updated_at = now() WHERE workspace_id = $1 AND request_id = $2 AND id = $3`, [
      workspaceId,
      requestId,
      orderedIds[i],
      i + 1,
    ]);
  }
}

// ---------------------------------------------------------------------------
// reg_question_links
// ---------------------------------------------------------------------------

export async function listRegQuestionLinks(workspaceId: string, questionId: string): Promise<RegQuestionLinkRow[]> {
  return query<RegQuestionLinkRow>(`SELECT * FROM reg_question_links WHERE workspace_id = $1 AND question_id = $2 ORDER BY created_at ASC`, [
    workspaceId,
    questionId,
  ]);
}

export async function getRegQuestionLink(workspaceId: string, id: string): Promise<RegQuestionLinkRow | null> {
  const rows = await query<RegQuestionLinkRow>(`SELECT * FROM reg_question_links WHERE workspace_id = $1 AND id = $2`, [workspaceId, id]);
  return rows[0] ?? null;
}

/**
 * Proves `targetId` belongs to this workspace AND is a row of the table
 * `linkType` claims - a control_test id passed as 'incident' (or any
 * cross-kind swap, or a foreign workspace's id of the RIGHT kind) must be
 * rejected here rather than accepted on faith. Every link_type in this
 * table names a table with a live, workspace-scoped row (no target_ref
 * fallback, unlike incident_links).
 */
async function verifyLinkTarget(workspaceId: string, linkType: RegQuestionLinkType, targetId: string): Promise<boolean> {
  switch (linkType) {
    case "workspace_control":
      return (await getWorkspaceControl(workspaceId, targetId)) !== null;
    case "control_test":
      return (await getControlTest(workspaceId, targetId)) !== null;
    case "control_change":
      return (await getControlChange(workspaceId, targetId)) !== null;
    case "incident":
      return (await getIncident(workspaceId, targetId)) !== null;
    case "readiness_assessment":
      return (await getReadinessAssessment(workspaceId, targetId)) !== null;
    case "pra_assessment":
      return (await getAssessment(workspaceId, targetId)) !== null;
    case "evidence":
      return (await getEvidence(workspaceId, targetId)) !== null;
    default:
      return false;
  }
}

export interface CreateRegQuestionLinkInput {
  linkType: RegQuestionLinkType;
  targetId: string;
  note?: string | null;
}

export type CreateRegQuestionLinkResult =
  | { ok: true; link: RegQuestionLinkRow }
  | { ok: false; reason: "not_found" | "already_final" | "question_not_found" | "invalid_target" | "duplicate" };

export async function createRegQuestionLink(
  workspaceId: string,
  requestId: string,
  questionId: string,
  input: CreateRegQuestionLinkInput,
  actor: string
): Promise<CreateRegQuestionLinkResult> {
  const question = await getRegQuestion(workspaceId, questionId);
  if (!question || question.request_id !== requestId) {
    const request = await getRegRequest(workspaceId, requestId);
    if (!request) return { ok: false, reason: "not_found" };
    return { ok: false, reason: "question_not_found" };
  }

  const targetOk = await verifyLinkTarget(workspaceId, input.linkType, input.targetId);
  if (!targetOk) return { ok: false, reason: "invalid_target" };

  const locked = await withRegRequestLock(workspaceId, requestId, async (client) => {
    const stillThere = await queryWithClient<RegQuestionRow>(
      client,
      `SELECT * FROM reg_questions WHERE workspace_id = $1 AND request_id = $2 AND id = $3`,
      [workspaceId, requestId, questionId]
    );
    if (stillThere.length === 0) return { ok: false as const, reason: "question_not_found" as const };

    let rows: RegQuestionLinkRow[];
    try {
      rows = await queryWithClient<RegQuestionLinkRow>(
        client,
        `INSERT INTO reg_question_links (workspace_id, question_id, link_type, target_id, note)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [workspaceId, questionId, input.linkType, input.targetId, input.note ?? null]
      );
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "23505") return { ok: false as const, reason: "duplicate" as const };
      throw error;
    }
    const link = rows[0];

    await writeAudit(
      workspaceId,
      actor,
      "reg_question_link.created",
      "reg_question_link",
      link.id,
      { questionId, linkType: input.linkType, targetId: input.targetId },
      client
    );
    return { ok: true as const, link };
  });

  if (!locked.ok) return locked;
  return locked.result;
}

export type DeleteRegQuestionLinkResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "already_final" | "link_not_found" };

export async function deleteRegQuestionLink(
  workspaceId: string,
  requestId: string,
  linkId: string,
  actor: string
): Promise<DeleteRegQuestionLinkResult> {
  const locked = await withRegRequestLock(workspaceId, requestId, async (client) => {
    const rows = await queryWithClient<{ id: string }>(
      client,
      `DELETE FROM reg_question_links l
       USING reg_questions q
       WHERE l.question_id = q.id AND q.request_id = $2
         AND l.workspace_id = $1 AND l.id = $3
       RETURNING l.id`,
      [workspaceId, requestId, linkId]
    );
    if (rows.length === 0) return false;
    await writeAudit(workspaceId, actor, "reg_question_link.deleted", "reg_question_link", linkId, { requestId }, client);
    return true;
  });

  if (!locked.ok) return locked;
  if (!locked.result) return { ok: false, reason: "link_not_found" };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// reg_commitments
// ---------------------------------------------------------------------------

export async function listRegCommitments(workspaceId: string, requestId: string): Promise<RegCommitmentRow[]> {
  return query<RegCommitmentRow>(`SELECT * FROM reg_commitments WHERE workspace_id = $1 AND request_id = $2 ORDER BY created_at ASC`, [
    workspaceId,
    requestId,
  ]);
}

/**
 * Every commitment across the whole workspace (not scoped to one request) -
 * the governance dashboard's "regulatory commitments" surface. One query
 * rather than an N+1 over listRegCommitments per request.
 *
 * Joins to the parent request and excludes commitments whose request has
 * reached a final status (closed/cancelled, i.e. isFinalRegRequestStatus -
 * inlined into the predicate below since this is SQL, not TS) - reject()
 * flips a request to 'cancelled' without touching its commitments (a
 * commitment IS still a historical record of what was promised, so it is not
 * deleted or force-terminated), and a commitment attached to a withdrawn or
 * long-closed request is not live work: it must not still count as "open" or
 * "overdue" on the governance dashboard. Filtering here (rather than having
 * reject() cascade a status change onto every open commitment) keeps
 * historically-accurate data too: the commitment rows still show whatever
 * status they were actually in when the request was cancelled, they are just
 * excluded from this whole-workspace roll-up.
 */
export async function listAllRegCommitments(workspaceId: string): Promise<RegCommitmentRow[]> {
  return query<RegCommitmentRow>(
    `SELECT rc.* FROM reg_commitments rc
     JOIN reg_requests rr ON rr.id = rc.request_id AND rr.workspace_id = rc.workspace_id
     WHERE rc.workspace_id = $1 AND rr.status NOT IN ('closed', 'cancelled')
     ORDER BY rc.due_date ASC NULLS LAST`,
    [workspaceId]
  );
}

export async function getRegCommitment(workspaceId: string, id: string): Promise<RegCommitmentRow | null> {
  const rows = await query<RegCommitmentRow>(`SELECT * FROM reg_commitments WHERE workspace_id = $1 AND id = $2`, [workspaceId, id]);
  return rows[0] ?? null;
}

export interface CreateRegCommitmentInput {
  questionId?: string | null;
  description: string;
  dueDate?: string | null;
  ownerPersonId?: string | null;
  note?: string | null;
}

export type CreateRegCommitmentResult =
  | { ok: true; commitment: RegCommitmentRow }
  | { ok: false; reason: "not_found" | "already_final" | "question_not_found" };

/**
 * Creates a commitment. If a due_date is supplied, a TRACKED action
 * (subject_type 'reg_commitment', subject_id = the new commitment's id) is
 * created in the SAME transaction and its id stored back onto
 * reg_commitments.action_id - this is the mechanic the whole module exists
 * for: a promise with a date is never just prose, it is live overdue work
 * the moment it is recorded. No due_date means no action (nothing would be
 * overdue against). The commitment row is inserted first (without
 * action_id) so the action can reference its real id, then the action is
 * inserted, then the commitment is patched with the action's id - all three
 * writes commit or roll back together.
 */
export async function createRegCommitment(
  workspaceId: string,
  requestId: string,
  input: CreateRegCommitmentInput,
  actor: string
): Promise<CreateRegCommitmentResult> {
  const locked = await withRegRequestLock(workspaceId, requestId, async (client) => {
    if (input.questionId) {
      const qRows = await queryWithClient<RegQuestionRow>(
        client,
        `SELECT * FROM reg_questions WHERE workspace_id = $1 AND request_id = $2 AND id = $3`,
        [workspaceId, requestId, input.questionId]
      );
      if (qRows.length === 0) return { ok: false as const, reason: "question_not_found" as const };
    }

    const insertRows = await queryWithClient<RegCommitmentRow>(
      client,
      `INSERT INTO reg_commitments (workspace_id, request_id, question_id, description, due_date, owner_person_id, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [workspaceId, requestId, input.questionId ?? null, input.description, input.dueDate ?? null, input.ownerPersonId ?? null, input.note ?? null]
    );
    let commitment = insertRows[0];

    if (input.dueDate) {
      const action: ActionRow = await createAction(
        workspaceId,
        {
          subjectType: REG_COMMITMENT_SUBJECT_TYPE,
          subjectId: commitment.id,
          title: input.description,
          ownerPersonId: input.ownerPersonId ?? null,
          dueDate: input.dueDate,
          priority: "medium",
        },
        actor,
        client
      );

      const updatedRows = await queryWithClient<RegCommitmentRow>(
        client,
        `UPDATE reg_commitments SET action_id = $3, updated_at = now() WHERE workspace_id = $1 AND id = $2 RETURNING *`,
        [workspaceId, commitment.id, action.id]
      );
      commitment = updatedRows[0];
    }

    await writeAudit(
      workspaceId,
      actor,
      "reg_commitment.created",
      REG_COMMITMENT_SUBJECT_TYPE,
      commitment.id,
      { requestId, hasDueDate: Boolean(input.dueDate), actionId: commitment.action_id },
      client
    );

    return { ok: true as const, commitment };
  });

  if (!locked.ok) return locked;
  return locked.result;
}

export interface UpdateRegCommitmentInput {
  description?: string;
  dueDate?: string | null;
  ownerPersonId?: string | null;
  status?: RegCommitmentStatus;
  note?: string | null;
  metAt?: string | null;
}

export type UpdateRegCommitmentResult =
  | { ok: true; commitment: RegCommitmentRow }
  | { ok: false; reason: "not_found" | "already_final" | "commitment_not_found" };

/**
 * Updates a commitment, keeping its linked TRACKED action (if any) honest
 * with the commitment record throughout - every transition below happens in
 * the SAME transaction as the commitment row's own UPDATE:
 *
 *  - due_date arrives where none existed before (action_id IS NULL): a
 *    tracked action is created now, exactly like createRegCommitment does
 *    at insert time - "add a date later" must create the same live overdue
 *    work as "add a date up front", not silently store a date nothing
 *    tracks.
 *  - action_id is already set and the commitment stays non-terminal
 *    (open/in_progress): description/due_date/owner_person_id are
 *    propagated onto the action, so pulling a date forward or renaming the
 *    commitment does not leave the tracked action contradicting the record
 *    it exists to track.
 *  - status transitions INTO 'met': the action is closed 'done' and met_at
 *    is stamped (input.metAt or today).
 *  - status transitions INTO 'missed' or 'withdrawn' (terminal, not met):
 *    the action is closed 'cancelled' - these are still promises that
 *    stopped being live work, and leaving the action open would strand it:
 *    once the commitment reaches a terminal status,
 *    lib/workspace/subject-mutability.ts refuses to let the generic actions
 *    route touch it either, so this is the only chance to close it.
 *
 * The reverse (moving a commitment OFF 'met'/'missed'/'withdrawn' back to
 * open) does not reopen its action - out of scope per the module spec.
 */
export async function updateRegCommitment(
  workspaceId: string,
  requestId: string,
  commitmentId: string,
  input: UpdateRegCommitmentInput,
  actor: string
): Promise<UpdateRegCommitmentResult> {
  const locked = await withRegRequestLock(workspaceId, requestId, async (client) => {
    const currentRows = await queryWithClient<RegCommitmentRow>(
      client,
      `SELECT * FROM reg_commitments WHERE workspace_id = $1 AND request_id = $2 AND id = $3 FOR UPDATE`,
      [workspaceId, requestId, commitmentId]
    );
    const current = currentRows[0];
    if (!current) return null;

    const description = input.description ?? current.description;
    const dueDate = input.dueDate !== undefined ? input.dueDate : current.due_date;
    const ownerPersonId = input.ownerPersonId !== undefined ? input.ownerPersonId : current.owner_person_id;
    const status = input.status ?? current.status;
    const note = input.note !== undefined ? input.note : current.note;
    const becomingMet = status === "met" && current.status !== "met";
    const becomingClosedOut = (status === "missed" || status === "withdrawn") && current.status !== status;
    const metAt = becomingMet ? input.metAt ?? new Date().toISOString().slice(0, 10) : input.metAt !== undefined ? input.metAt : current.met_at;

    const rows = await queryWithClient<RegCommitmentRow>(
      client,
      `UPDATE reg_commitments
       SET description = $4, due_date = $5, owner_person_id = $6, status = $7, note = $8, met_at = $9, updated_at = now()
       WHERE workspace_id = $1 AND request_id = $2 AND id = $3
       RETURNING *`,
      [workspaceId, requestId, commitmentId, description, dueDate, ownerPersonId, status, note, metAt]
    );
    let updated = rows[0];

    // Fix: a due date newly supplied where none (and no action) existed
    // before creates the tracked action now, mirroring createRegCommitment.
    let actionJustCreated = false;
    if (dueDate && !updated.action_id) {
      const action: ActionRow = await createAction(
        workspaceId,
        {
          subjectType: REG_COMMITMENT_SUBJECT_TYPE,
          subjectId: updated.id,
          title: description,
          ownerPersonId,
          dueDate,
          priority: "medium",
        },
        actor,
        client
      );
      const withAction = await queryWithClient<RegCommitmentRow>(
        client,
        `UPDATE reg_commitments SET action_id = $3, updated_at = now() WHERE workspace_id = $1 AND id = $2 RETURNING *`,
        [workspaceId, updated.id, action.id]
      );
      updated = withAction[0];
      actionJustCreated = true;
      await writeAudit(
        workspaceId,
        actor,
        "reg_commitment.action_created",
        REG_COMMITMENT_SUBJECT_TYPE,
        updated.id,
        { requestId, actionId: action.id },
        client
      );
    }

    if (updated.action_id) {
      if (becomingMet) {
        const actionRows = await queryWithClient<{ id: string }>(
          client,
          `UPDATE actions SET status = 'done', updated_at = now()
           WHERE workspace_id = $1 AND id = $2 AND status NOT IN ('done', 'cancelled')
           RETURNING id`,
          [workspaceId, updated.action_id]
        );
        if (actionRows.length > 0) {
          await writeAudit(workspaceId, actor, "action.updated", "action", updated.action_id, { via: "reg_commitment.met", commitmentId }, client);
        }
      } else if (becomingClosedOut) {
        const actionRows = await queryWithClient<{ id: string }>(
          client,
          `UPDATE actions SET status = 'cancelled', updated_at = now()
           WHERE workspace_id = $1 AND id = $2 AND status NOT IN ('done', 'cancelled')
           RETURNING id`,
          [workspaceId, updated.action_id]
        );
        if (actionRows.length > 0) {
          await writeAudit(workspaceId, actor, "action.updated", "action", updated.action_id, { via: `reg_commitment.${status}`, commitmentId }, client);
        }
      } else if (!actionJustCreated && !isTerminalCommitmentStatus(updated.status)) {
        const actionRows = await queryWithClient<{ id: string }>(
          client,
          `UPDATE actions SET title = $3, due_date = $4, owner_person_id = $5, updated_at = now()
           WHERE workspace_id = $1 AND id = $2 AND status NOT IN ('done', 'cancelled')
           RETURNING id`,
          [workspaceId, updated.action_id, description, dueDate, ownerPersonId]
        );
        if (actionRows.length > 0) {
          await writeAudit(workspaceId, actor, "action.updated", "action", updated.action_id, { via: "reg_commitment.updated", commitmentId }, client);
        }
      }
    }

    await writeAudit(workspaceId, actor, "reg_commitment.updated", REG_COMMITMENT_SUBJECT_TYPE, commitmentId, { requestId, fields: Object.keys(input) }, client);
    return updated;
  });

  if (!locked.ok) return locked;
  if (!locked.result) return { ok: false, reason: "commitment_not_found" };
  return { ok: true, commitment: locked.result };
}

export type DeleteRegCommitmentResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "already_final" | "commitment_not_found" };

export async function deleteRegCommitment(workspaceId: string, requestId: string, commitmentId: string, actor: string): Promise<DeleteRegCommitmentResult> {
  const locked = await withRegRequestLock(workspaceId, requestId, async (client) => {
    const rows = await queryWithClient<{ id: string }>(
      client,
      `DELETE FROM reg_commitments WHERE workspace_id = $1 AND request_id = $2 AND id = $3 RETURNING id`,
      [workspaceId, requestId, commitmentId]
    );
    if (rows.length === 0) return false;
    await writeAudit(workspaceId, actor, "reg_commitment.deleted", REG_COMMITMENT_SUBJECT_TYPE, commitmentId, { requestId }, client);
    return true;
  });

  if (!locked.ok) return locked;
  if (!locked.result) return { ok: false, reason: "commitment_not_found" };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// summary
// ---------------------------------------------------------------------------

export async function getRegResponseSummary(workspaceId: string, requestId: string): Promise<RegResponseSummary | null> {
  const request = await getRegRequest(workspaceId, requestId);
  if (!request) return null;
  const [questions, commitments] = await Promise.all([listRegQuestions(workspaceId, requestId), listRegCommitments(workspaceId, requestId)]);
  return summarize(questions, commitments, request.deadline);
}

// ---------------------------------------------------------------------------
// approval path: approveResponse / markSubmitted / closeRequest / reject
// ---------------------------------------------------------------------------

export type ApproveRegRequestResult =
  | { ok: true; request: RegRequestRow; decision: DecisionRow; conditions: ConditionRow[] }
  | { ok: false; reason: "not_found" | "already_final" | "wrong_status" | "unanswered_questions" | "no_questions" };

/**
 * Approves a reg_request: records a decision (approve or
 * approve_with_conditions, matching the readiness/PRA convention) and moves
 * status to 'approved'. Refuses (no_questions) a request with zero
 * questions recorded - an empty request has nothing for a reviewer to have
 * actually checked, so it must not be indistinguishable from one that
 * passed a real review (the same vacuous-guard shape readiness had to
 * close). Refuses (unanswered_questions) while ANY question is still
 * 'unanswered' - an unanswered question in a regulator response is exactly
 * what must block sign-off, the module's reason to exist. Requires the
 * request to be draft/in_progress/in_review (wrong_status otherwise -
 * covers re-approving an already-approved/submitted request). Runs in one
 * transaction with SELECT ... FOR UPDATE so a concurrent question edit that
 * would flip the unanswered check cannot race past this guard, and the
 * decision + conditions are written INSIDE the same transaction as the
 * status flip (see readiness's runApproval doc comment for why - a
 * condition write failure must never leave a record permanently
 * "approved" with the sign-off's conditions silently discarded).
 */
export async function approveResponse(
  workspaceId: string,
  requestId: string,
  decidedByPersonId: string,
  rationale: string | null,
  conditions: CreateConditionInput[],
  actor: string
): Promise<ApproveRegRequestResult> {
  return withTransaction(async (client) => {
    const request = await getRequestWithClient(client, workspaceId, requestId);
    if (!request) return { ok: false, reason: "not_found" };
    if (isFinalRegRequestStatus(request.status)) return { ok: false, reason: "already_final" };
    if (request.status !== "draft" && request.status !== "in_progress" && request.status !== "in_review") {
      return { ok: false, reason: "wrong_status" };
    }

    const countRows = await queryWithClient<{ total: string; unanswered: string }>(
      client,
      `SELECT COUNT(*)::text as total, COUNT(*) FILTER (WHERE status = 'unanswered')::text as unanswered
       FROM reg_questions WHERE workspace_id = $1 AND request_id = $2`,
      [workspaceId, requestId]
    );
    const totalQuestions = parseInt(countRows[0]?.total ?? "0", 10);
    if (totalQuestions === 0) return { ok: false, reason: "no_questions" };
    const unansweredCount = parseInt(countRows[0]?.unanswered ?? "0", 10);
    if (unansweredCount > 0) return { ok: false, reason: "unanswered_questions" };

    const rows = await queryWithClient<RegRequestRow>(
      client,
      `UPDATE reg_requests SET status = 'approved', updated_at = now() WHERE workspace_id = $1 AND id = $2 RETURNING *`,
      [workspaceId, requestId]
    );
    const updated = rows[0];

    const decision = await createDecisionWithClient(
      client,
      workspaceId,
      {
        subjectType: SUBJECT_TYPE,
        subjectId: requestId,
        outcome: conditions.length > 0 ? "approve_with_conditions" : "approve",
        rationale,
        decidedByPersonId,
      },
      actor
    );

    const conditionRows: ConditionRow[] = [];
    for (const conditionInput of conditions) {
      conditionRows.push(await createConditionWithClient(client, workspaceId, decision.id, conditionInput, actor));
    }

    await writeAudit(workspaceId, actor, "reg_request.approved", SUBJECT_TYPE, requestId, { decisionId: decision.id }, client);
    return { ok: true, request: updated, decision, conditions: conditionRows };
  });
}

export type SubmitRegRequestResult =
  | { ok: true; request: RegRequestRow }
  | { ok: false; reason: "not_found" | "already_final" | "not_approved" };

/** Marks a reg_request submitted. Requires status = 'approved' (not_approved otherwise) - nothing may be sent to the regulator that has not been signed off. */
export async function markSubmitted(workspaceId: string, requestId: string, actor: string): Promise<SubmitRegRequestResult> {
  return withTransaction(async (client) => {
    const request = await getRequestWithClient(client, workspaceId, requestId);
    if (!request) return { ok: false, reason: "not_found" };
    if (isFinalRegRequestStatus(request.status)) return { ok: false, reason: "already_final" };
    if (request.status !== "approved") return { ok: false, reason: "not_approved" };

    const rows = await queryWithClient<RegRequestRow>(
      client,
      `UPDATE reg_requests SET status = 'submitted', submitted_at = now(), updated_at = now() WHERE workspace_id = $1 AND id = $2 RETURNING *`,
      [workspaceId, requestId]
    );
    const updated = rows[0];

    await writeAudit(workspaceId, actor, "reg_request.submitted", SUBJECT_TYPE, requestId, {}, client);
    return { ok: true, request: updated };
  });
}

export type CloseRegRequestResult =
  | { ok: true; request: RegRequestRow }
  | { ok: false; reason: "not_found" | "already_final" | "not_submitted" | "open_commitments" };

/**
 * Closes a reg_request. Requires status = 'submitted' (not_submitted
 * otherwise) AND every commitment recorded against it to be in a terminal
 * state (met/missed/withdrawn) - an open or in_progress commitment means the
 * matter with the regulator is not actually closed, which is the whole
 * point of tracking commitments as live work instead of prose.
 */
export async function closeRequest(workspaceId: string, requestId: string, actor: string): Promise<CloseRegRequestResult> {
  return withTransaction(async (client) => {
    const request = await getRequestWithClient(client, workspaceId, requestId);
    if (!request) return { ok: false, reason: "not_found" };
    if (isFinalRegRequestStatus(request.status)) return { ok: false, reason: "already_final" };
    if (request.status !== "submitted") return { ok: false, reason: "not_submitted" };

    const openRows = await queryWithClient<{ count: string }>(
      client,
      `SELECT COUNT(*)::text as count FROM reg_commitments
       WHERE workspace_id = $1 AND request_id = $2 AND status NOT IN ('met', 'missed', 'withdrawn')`,
      [workspaceId, requestId]
    );
    const openCount = parseInt(openRows[0]?.count ?? "0", 10);
    if (openCount > 0) return { ok: false, reason: "open_commitments" };

    const rows = await queryWithClient<RegRequestRow>(
      client,
      `UPDATE reg_requests SET status = 'closed', updated_at = now() WHERE workspace_id = $1 AND id = $2 RETURNING *`,
      [workspaceId, requestId]
    );
    const updated = rows[0];

    await writeAudit(workspaceId, actor, "reg_request.closed", SUBJECT_TYPE, requestId, {}, client);
    return { ok: true, request: updated };
  });
}

export type RejectRegRequestResult =
  | { ok: true; request: RegRequestRow; decision: DecisionRow; conditions: ConditionRow[] }
  | { ok: false; reason: "not_found" | "already_final" };

/** Rejects/cancels a reg_request from any non-final status, recording a decision like approveResponse does. Not blocked by unanswered questions - a reviewer may reject precisely because of them. */
export async function reject(
  workspaceId: string,
  requestId: string,
  decidedByPersonId: string,
  rationale: string | null,
  conditions: CreateConditionInput[],
  actor: string
): Promise<RejectRegRequestResult> {
  return withTransaction(async (client) => {
    const request = await getRequestWithClient(client, workspaceId, requestId);
    if (!request) return { ok: false, reason: "not_found" };
    if (isFinalRegRequestStatus(request.status)) return { ok: false, reason: "already_final" };

    const rows = await queryWithClient<RegRequestRow>(
      client,
      `UPDATE reg_requests SET status = 'cancelled', updated_at = now() WHERE workspace_id = $1 AND id = $2 RETURNING *`,
      [workspaceId, requestId]
    );
    const updated = rows[0];

    const decision = await createDecisionWithClient(
      client,
      workspaceId,
      { subjectType: SUBJECT_TYPE, subjectId: requestId, outcome: "reject", rationale, decidedByPersonId },
      actor
    );

    const conditionRows: ConditionRow[] = [];
    for (const conditionInput of conditions) {
      conditionRows.push(await createConditionWithClient(client, workspaceId, decision.id, conditionInput, actor));
    }

    await writeAudit(workspaceId, actor, "reg_request.rejected", SUBJECT_TYPE, requestId, { decisionId: decision.id }, client);
    return { ok: true, request: updated, decision, conditions: conditionRows };
  });
}
