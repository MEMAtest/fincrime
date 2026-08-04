import { query } from "@/lib/db";
import { writeAudit } from "./audit";

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

export async function createEvidence(
  workspaceId: string,
  input: CreateEvidenceInput,
  actor: string
): Promise<EvidenceRow> {
  const rows = await query<EvidenceRow>(
    `INSERT INTO evidence (workspace_id, subject_type, subject_id, type, title, description, link_url, evidence_date, added_by_person_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      workspaceId,
      input.subjectType,
      input.subjectId,
      input.type,
      input.title,
      input.description || null,
      input.linkUrl || null,
      input.evidenceDate || null,
      input.addedByPersonId || null,
    ]
  );
  const evidence = rows[0];

  await writeAudit(workspaceId, actor, "evidence.created", EVIDENCE_SUBJECT_TYPE, evidence.id, {
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    title: input.title,
  });

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
  const rows = await query<{ id: string }>(`DELETE FROM evidence WHERE workspace_id = $1 AND id = $2 RETURNING id`, [
    workspaceId,
    id,
  ]);
  const deleted = rows.length > 0;

  if (deleted) {
    await writeAudit(workspaceId, actor, "evidence.deleted", EVIDENCE_SUBJECT_TYPE, id, {});
  }
  return deleted;
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
