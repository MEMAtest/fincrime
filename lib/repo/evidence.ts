import { query, queryWithClient, type DbTransactionClient } from "@/lib/db";
import { writeAudit } from "./audit";
import { deleteEvidenceFileBestEffort } from "@/lib/storage/blob";

const EVIDENCE_SUBJECT_TYPE = "evidence";
const COMMENT_SUBJECT_TYPE = "comment";

// ---------------------------------------------------------------------------
// evidence
// ---------------------------------------------------------------------------

export interface EvidenceRow {
  id: string;
  workspace_id: string;
  subject_type: string;
  subject_id: string;
  type: string;
  title: string;
  description: string | null;
  link_url: string | null;
  evidence_date: string | null;
  added_by_person_id: string | null;
  /** File attachment, added alongside (never instead of) link_url/description - migration 009. All five are null for link-only evidence, exactly today's shape. */
  file_url: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  file_content_type: string | null;
  uploaded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEvidenceInput {
  subjectType: string;
  subjectId: string;
  type: string;
  title: string;
  description?: string | null;
  linkUrl?: string | null;
  evidenceDate?: string | null;
  addedByPersonId?: string | null;
}

export async function listEvidenceBySubject(
  workspaceId: string,
  subjectType: string,
  subjectId: string
): Promise<EvidenceRow[]> {
  return query<EvidenceRow>(
    `SELECT * FROM evidence WHERE workspace_id = $1 AND subject_type = $2 AND subject_id = $3 ORDER BY created_at DESC`,
    [workspaceId, subjectType, subjectId]
  );
}

export async function getEvidence(workspaceId: string, id: string): Promise<EvidenceRow | null> {
  const rows = await query<EvidenceRow>(`SELECT * FROM evidence WHERE workspace_id = $1 AND id = $2`, [
    workspaceId,
    id,
  ]);
  return rows[0] ?? null;
}

/** Pass a transaction client when this evidence row's creation must be atomic with a check on its parent (e.g. the parent must still be non-final when the row lands - see readiness's obligation/assessment evidence routes). */
export async function createEvidence(
  workspaceId: string,
  input: CreateEvidenceInput,
  actor: string,
  client?: DbTransactionClient
): Promise<EvidenceRow> {
  const sql = `INSERT INTO evidence (workspace_id, subject_type, subject_id, type, title, description, link_url, evidence_date, added_by_person_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`;
  const params = [
    workspaceId,
    input.subjectType,
    input.subjectId,
    input.type,
    input.title,
    input.description || null,
    input.linkUrl || null,
    input.evidenceDate || null,
    input.addedByPersonId || null,
  ];
  const rows = client ? await queryWithClient<EvidenceRow>(client, sql, params) : await query<EvidenceRow>(sql, params);
  const evidence = rows[0];

  await writeAudit(
    workspaceId,
    actor,
    "evidence.created",
    EVIDENCE_SUBJECT_TYPE,
    evidence.id,
    { subjectType: input.subjectType, subjectId: input.subjectId, title: input.title },
    client
  );

  return evidence;
}

export interface UpdateEvidenceInput {
  type?: string;
  title?: string;
  description?: string | null;
  linkUrl?: string | null;
  evidenceDate?: string | null;
  addedByPersonId?: string | null;
}

export async function updateEvidence(
  workspaceId: string,
  id: string,
  input: UpdateEvidenceInput,
  actor: string
): Promise<EvidenceRow | null> {
  const current = await getEvidence(workspaceId, id);
  if (!current) return null;

  const type = input.type ?? current.type;
  const title = input.title ?? current.title;
  const description = input.description !== undefined ? input.description : current.description;
  const linkUrl = input.linkUrl !== undefined ? input.linkUrl : current.link_url;
  const evidenceDate = input.evidenceDate !== undefined ? input.evidenceDate : current.evidence_date;
  const addedByPersonId = input.addedByPersonId !== undefined ? input.addedByPersonId : current.added_by_person_id;

  const rows = await query<EvidenceRow>(
    `UPDATE evidence
     SET type = $3, title = $4, description = $5, link_url = $6, evidence_date = $7, added_by_person_id = $8, updated_at = now()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [workspaceId, id, type, title, description, linkUrl, evidenceDate, addedByPersonId]
  );

  const updated = rows[0] ?? null;
  if (updated) {
    await writeAudit(workspaceId, actor, "evidence.updated", EVIDENCE_SUBJECT_TYPE, id, { fields: Object.keys(input) });
  }
  return updated;
}

export async function deleteEvidence(workspaceId: string, id: string, actor: string): Promise<boolean> {
  const rows = await query<EvidenceRow>(`DELETE FROM evidence WHERE workspace_id = $1 AND id = $2 RETURNING *`, [
    workspaceId,
    id,
  ]);
  const deleted = rows.length > 0;

  if (deleted) {
    // Best-effort: the DB row is already gone (the source of truth for
    // whether this evidence exists), so a failed blob delete here must
    // never surface as a failure of the delete itself - it just leaves an
    // orphaned object in storage, logged by deleteEvidenceFileBestEffort.
    if (rows[0].file_url) void deleteEvidenceFileBestEffort(rows[0].file_url);
    await writeAudit(workspaceId, actor, "evidence.deleted", EVIDENCE_SUBJECT_TYPE, id, {});
  }
  return deleted;
}

export interface AttachEvidenceFileInput {
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
  fileContentType: string;
}

/**
 * Records a successfully uploaded file's metadata on an evidence row.
 * Replacing an existing attachment (re-upload) is the caller's job to
 * detect and best-effort-delete the old blob for BEFORE calling this - kept
 * separate so this function stays a pure "write these columns" op with one
 * job, matching every other repo module's single-purpose update functions.
 */
export async function attachEvidenceFile(
  workspaceId: string,
  id: string,
  input: AttachEvidenceFileInput,
  actor: string
): Promise<EvidenceRow | null> {
  const rows = await query<EvidenceRow>(
    `UPDATE evidence
     SET file_url = $3, file_name = $4, file_size_bytes = $5, file_content_type = $6, uploaded_at = now(), updated_at = now()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [workspaceId, id, input.fileUrl, input.fileName, input.fileSizeBytes, input.fileContentType]
  );
  const updated = rows[0] ?? null;
  if (updated) {
    await writeAudit(workspaceId, actor, "evidence.file_attached", EVIDENCE_SUBJECT_TYPE, id, {
      fileName: input.fileName,
      fileSizeBytes: input.fileSizeBytes,
    });
  }
  return updated;
}

/** Clears a file attachment's metadata (the blob itself is deleted best-effort by the caller before this). Leaves link_url/description/etc untouched. */
export async function clearEvidenceFile(workspaceId: string, id: string, actor: string): Promise<EvidenceRow | null> {
  const rows = await query<EvidenceRow>(
    `UPDATE evidence
     SET file_url = NULL, file_name = NULL, file_size_bytes = NULL, file_content_type = NULL, uploaded_at = NULL, updated_at = now()
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    [workspaceId, id]
  );
  const updated = rows[0] ?? null;
  if (updated) {
    await writeAudit(workspaceId, actor, "evidence.file_removed", EVIDENCE_SUBJECT_TYPE, id, {});
  }
  return updated;
}

// ---------------------------------------------------------------------------
// comments
// ---------------------------------------------------------------------------

export interface CommentRow {
  id: string;
  workspace_id: string;
  subject_type: string;
  subject_id: string;
  body: string;
  author_person_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCommentInput {
  subjectType: string;
  subjectId: string;
  body: string;
  authorPersonId?: string | null;
}

export async function listCommentsBySubject(
  workspaceId: string,
  subjectType: string,
  subjectId: string
): Promise<CommentRow[]> {
  return query<CommentRow>(
    `SELECT * FROM comments WHERE workspace_id = $1 AND subject_type = $2 AND subject_id = $3 ORDER BY created_at ASC`,
    [workspaceId, subjectType, subjectId]
  );
}

export async function getComment(workspaceId: string, id: string): Promise<CommentRow | null> {
  const rows = await query<CommentRow>(`SELECT * FROM comments WHERE workspace_id = $1 AND id = $2`, [
    workspaceId,
    id,
  ]);
  return rows[0] ?? null;
}

export async function createComment(
  workspaceId: string,
  input: CreateCommentInput,
  actor: string
): Promise<CommentRow> {
  const rows = await query<CommentRow>(
    `INSERT INTO comments (workspace_id, subject_type, subject_id, body, author_person_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [workspaceId, input.subjectType, input.subjectId, input.body, input.authorPersonId || null]
  );
  const comment = rows[0];

  await writeAudit(workspaceId, actor, "comment.created", COMMENT_SUBJECT_TYPE, comment.id, {
    subjectType: input.subjectType,
    subjectId: input.subjectId,
  });

  return comment;
}

export async function deleteComment(workspaceId: string, id: string, actor: string): Promise<boolean> {
  const rows = await query<{ id: string }>(`DELETE FROM comments WHERE workspace_id = $1 AND id = $2 RETURNING id`, [
    workspaceId,
    id,
  ]);
  const deleted = rows.length > 0;

  if (deleted) {
    await writeAudit(workspaceId, actor, "comment.deleted", COMMENT_SUBJECT_TYPE, id, {});
  }
  return deleted;
}
