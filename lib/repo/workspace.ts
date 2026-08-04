import { randomBytes, randomUUID, createHash, timingSafeEqual } from "node:crypto";
import { query } from "@/lib/db";
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
  settings?: Record<string, unknown>;
}

/** Generic partial update of workspace fields; only sets what is passed in. */
export async function updateWorkspace(
  id: string,
  input: UpdateWorkspaceInput,
  actor: string
): Promise<WorkspaceRow | null> {
  const current = await getWorkspace(id);
  if (!current) return null;

  const name = input.name !== undefined ? input.name : current.name;
  const ownerEmail = input.ownerEmail !== undefined ? input.ownerEmail : current.owner_email;
  const appetiteThresholds = input.appetiteThresholds ?? current.appetite_thresholds;
  const settings = input.settings ?? current.settings;

  const rows = await query<WorkspaceRow>(
    `UPDATE workspaces
     SET name = $2, owner_email = $3, appetite_thresholds = $4, settings = $5, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, name, ownerEmail, JSON.stringify(appetiteThresholds), JSON.stringify(settings)]
  );

  const updated = rows[0] ?? null;
  if (updated) {
    await writeAudit(id, actor, "workspace.updated", "workspace", id, { ...input });
  }
  return updated;
}

/** Updates only the appetite thresholds used by the residual-risk scoring module. */
export async function updateAppetiteThresholds(
  id: string,
  appetiteThresholds: AppetiteThresholds,
  actor: string
): Promise<WorkspaceRow | null> {
  return updateWorkspace(id, { appetiteThresholds }, actor);
}

/** Updates only the free-form settings blob. */
export async function updateSettings(
  id: string,
  settings: Record<string, unknown>,
  actor: string
): Promise<WorkspaceRow | null> {
  return updateWorkspace(id, { settings }, actor);
}
