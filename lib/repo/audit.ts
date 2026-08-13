import { query, queryWithClient, type DbTransactionClient } from "@/lib/db";

export interface AuditLogRow {
  id: string;
  workspace_id: string | null;
  actor: string;
  verb: string;
  subject_type: string | null;
  subject_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Writes an audit_log row. Every mutating repo function calls this after a
 * successful write, describing who (actor) did what (verb) to which subject.
 * Pass an existing transaction client to include the audit row in the same
 * transaction as the mutation it describes. workspaceId is null for
 * account-level mutations that are not scoped to any single workspace
 * (signup, login, logout, session create/revoke) - see migration 010, which
 * dropped audit_log.workspace_id's NOT NULL constraint for exactly this.
 */
export async function writeAudit(
  workspaceId: string | null,
  actor: string,
  verb: string,
  subjectType: string | null,
  subjectId: string | null,
  detail: Record<string, unknown> = {},
  client?: DbTransactionClient
): Promise<void> {
  const sql = `
    INSERT INTO audit_log (workspace_id, actor, verb, subject_type, subject_id, detail)
    VALUES ($1, $2, $3, $4, $5, $6)
  `;
  const params = [workspaceId, actor, verb, subjectType, subjectId, JSON.stringify(detail)];

  if (client) {
    await queryWithClient(client, sql, params);
  } else {
    await query(sql, params);
  }
}

export interface ListAuditOptions {
  limit?: number;
  subjectType?: string;
  subjectId?: string;
}

/** Reads the audit trail for a workspace, most recent first. */
export async function listAuditLog(workspaceId: string, options: ListAuditOptions = {}): Promise<AuditLogRow[]> {
  const limit = options.limit ?? 50;

  if (options.subjectType && options.subjectId) {
    return query<AuditLogRow>(
      `SELECT * FROM audit_log
       WHERE workspace_id = $1 AND subject_type = $2 AND subject_id = $3
       ORDER BY created_at DESC
       LIMIT $4`,
      [workspaceId, options.subjectType, options.subjectId, limit]
    );
  }

  return query<AuditLogRow>(
    `SELECT * FROM audit_log WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [workspaceId, limit]
  );
}
