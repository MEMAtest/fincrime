import { randomBytes, randomUUID, createHash, timingSafeEqual } from "node:crypto";
import { query, withTransaction } from "@/lib/db";
import { writeAudit } from "./audit";
import {
  DEFAULT_APPETITE_THRESHOLDS,
  type AppetiteThresholds,
} from "@/data/scoring/residual-risk";

export type { AppetiteThresholds };

export interface WorkspaceRow {
  id: string;
  token_hash: string;
  name: string | null;
  owner_email: string | null;
  appetite_thresholds: AppetiteThresholds;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreatedWorkspace {
  id: string;
  token: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string | null;
  ownerEmail: string | null;
  appetiteThresholds: AppetiteThresholds;
  settings: Record<string, unknown>;
  createdAt: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a new anonymous workspace: a random UUID id and a random 32-byte
 * token. Only the sha256 hash of the token is ever persisted; the plaintext
 * token is returned once, here, for the client to store.
 */
export async function createWorkspace(name?: string | null): Promise<CreatedWorkspace> {
  const id = randomUUID();
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  await query(
    `INSERT INTO workspaces (id, token_hash, name, appetite_thresholds, settings)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, tokenHash, name || null, JSON.stringify(DEFAULT_APPETITE_THRESHOLDS), JSON.stringify({})]
  );

  await writeAudit(id, "system", "workspace.created", "workspace", id, { name: name || null });

  return { id, token };
}

/**
 * Verifies a workspace id + token pair against the stored hash, using a
 * constant-time comparison. Returns the workspace row, or null if the id is
 * unknown or the token does not match.
 */
export async function verifyWorkspace(id: string, token: string): Promise<WorkspaceRow | null> {
  if (!id || !token) return null;

  const rows = await query<WorkspaceRow>(`SELECT * FROM workspaces WHERE id = $1`, [id]);
  const workspace = rows[0];
  if (!workspace) return null;

  const candidateHash = Buffer.from(hashToken(token));
  const storedHash = Buffer.from(workspace.token_hash);
  if (candidateHash.length !== storedHash.length) return null;
  if (!timingSafeEqual(candidateHash, storedHash)) return null;

  return workspace;
}

export async function getWorkspace(id: string): Promise<WorkspaceRow | null> {
  const rows = await query<WorkspaceRow>(`SELECT * FROM workspaces WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export function toWorkspaceSummary(row: WorkspaceRow): WorkspaceSummary {
  return {
    id: row.id,
    name: row.name,
    ownerEmail: row.owner_email,
    appetiteThresholds: row.appetite_thresholds,
    settings: row.settings,
    createdAt: row.created_at,
  };
}

export interface UpdateWorkspaceInput {
  name?: string | null;
  ownerEmail?: string | null;
  appetiteThresholds?: AppetiteThresholds;
  /**
   * A PARTIAL patch onto the stored settings JSONB, merged with Postgres's
   * `||` operator INSIDE the same transaction that locks the row (see
   * below) - never a full replacement value computed by the caller outside
   * a transaction. Two concurrent PATCHes of different keys (e.g. the
   * Settings page's per-field blur-save on Organisation fields racing the
   * Operational card's own save button) must both persist; merging a
   * caller-computed `{...old, ...patch}` object at write time loses
   * whichever request's read happened first, because the second write's
   * `old` is already stale by the time it lands.
   */
  settingsPatch?: Record<string, unknown>;
}

/**
 * Generic partial update of workspace fields; only sets what is passed in.
 * Runs inside a transaction with `SELECT ... FOR UPDATE` to serialise
 * concurrent writers against the SAME workspace row, and merges
 * `settingsPatch` in SQL (`settings || $n::jsonb`) rather than in
 * application code, so no concurrent partial settings patch can be lost to
 * a read-then-write race. name/ownerEmail/appetiteThresholds remain
 * last-write-wins full replacements (as before) since callers always
 * supply their complete intended value for those, not a partial patch.
 */
export async function updateWorkspace(
  id: string,
  input: UpdateWorkspaceInput,
  actor: string
): Promise<WorkspaceRow | null> {
  return withTransaction(async (client) => {
    const lockedRows = await client.query<WorkspaceRow>(`SELECT * FROM workspaces WHERE id = $1 FOR UPDATE`, [id]);
    const current = lockedRows.rows[0];
    if (!current) return null;

    const name = input.name !== undefined ? input.name : current.name;
    const ownerEmail = input.ownerEmail !== undefined ? input.ownerEmail : current.owner_email;
    const appetiteThresholds = input.appetiteThresholds ?? current.appetite_thresholds;
    const settingsPatchJson = JSON.stringify(input.settingsPatch ?? {});

    const rows = await client.query<WorkspaceRow>(
      `UPDATE workspaces
       SET name = $2, owner_email = $3, appetite_thresholds = $4, settings = settings || $5::jsonb, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, name, ownerEmail, JSON.stringify(appetiteThresholds), settingsPatchJson]
    );

    const updated = rows.rows[0] ?? null;
    if (updated) {
      // MUST pass `client` here: writeAudit's default path opens a NEW
      // pooled connection, and audit_log.workspace_id has a FK to
      // workspaces(id) - inserting from a second connection would need a
      // lock on the row this transaction's SELECT ... FOR UPDATE already
      // holds and has not yet committed, self-deadlocking the two
      // connections until pg's query_timeout kills it ("Query read
      // timeout"). Participating in the same transaction avoids that
      // entirely.
      await writeAudit(id, actor, "workspace.updated", "workspace", id, { ...input }, client);
    }
    return updated;
  });
}

/** Updates only the appetite thresholds used by the residual-risk scoring module. */
export async function updateAppetiteThresholds(
  id: string,
  appetiteThresholds: AppetiteThresholds,
  actor: string
): Promise<WorkspaceRow | null> {
  return updateWorkspace(id, { appetiteThresholds }, actor);
}

/** Merges a partial patch onto the free-form settings blob (see updateWorkspace's settingsPatch doc). */
export async function updateSettings(
  id: string,
  settingsPatch: Record<string, unknown>,
  actor: string
): Promise<WorkspaceRow | null> {
  return updateWorkspace(id, { settingsPatch }, actor);
}
