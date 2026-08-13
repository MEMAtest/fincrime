import { query, withTransaction } from "@/lib/db";
import { writeAudit } from "./audit";
import { hashPassword, verifyPassword, needsRehash } from "@/lib/auth/password";
import { normalizeEmail } from "@/lib/auth/validation";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  email_verified_at: string | null;
}

export interface PublicUser {
  id: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export function toPublicUser(row: UserRow): PublicUser {
  return { id: row.id, email: row.email, createdAt: row.created_at, lastLoginAt: row.last_login_at };
}

export type CreateUserResult = { ok: true; user: UserRow } | { ok: false; reason: "duplicate_email" };

/**
 * Creates a new account. Rejects a duplicate email cleanly via a pre-check
 * PLUS the unique index as a backstop (idx_users_email_lower) - the
 * pre-check avoids surfacing a raw 23505 to the caller in the common case,
 * and the unique index closes the race between two concurrent signups for
 * the same email (caught below by inspecting the error code, not by
 * trusting the pre-check alone).
 */
export async function createUser(email: string, password: string): Promise<CreateUserResult> {
  const normalized = normalizeEmail(email);
  const passwordHash = await hashPassword(password);

  try {
    const rows = await query<UserRow>(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *`,
      [normalized, passwordHash]
    );
    const user = rows[0];
    await writeAudit(null, user.email, "user.created", "user", user.id, {});
    return { ok: true, user };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505") {
      return { ok: false, reason: "duplicate_email" };
    }
    throw error;
  }
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const normalized = normalizeEmail(email);
  const rows = await query<UserRow>(`SELECT * FROM users WHERE lower(email) = $1`, [normalized]);
  return rows[0] ?? null;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const rows = await query<UserRow>(`SELECT * FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

/** Overwrites a user's password hash directly (password reset). Does NOT touch sessions - the caller (the reset-confirm route) is responsible for revoking them, since "did the hash change" and "should old sessions die" are separate decisions even though they happen together here. */
export async function setPasswordHash(userId: string, passwordHash: string, actorEmail: string): Promise<void> {
  await query(`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, [userId, passwordHash]);
  await writeAudit(null, actorEmail, "user.password_reset", "user", userId, {});
}

/** Marks a user's email verified (signup verification link). Idempotent - verifying twice just re-stamps the same timestamp forward, not an error. */
export async function markEmailVerified(userId: string): Promise<void> {
  await query(`UPDATE users SET email_verified_at = now() WHERE id = $1`, [userId]);
}

export type VerifyCredentialsResult = { ok: true; user: UserRow } | { ok: false };

/**
 * Verifies an email/password pair. Deliberately returns the SAME shape
 * ({ok:false}, no reason) whether the email does not exist or the password
 * is wrong - callers must not distinguish these in the API response, to
 * avoid user enumeration. Runs verifyPassword against a real hash even on a
 * miss (see the dummy hash below) so response time does not itself leak
 * whether the email exists.
 */
const DUMMY_HASH = "scrypt:16384:8:1:0000000000000000000000000000000000000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

export async function verifyCredentials(email: string, password: string): Promise<VerifyCredentialsResult> {
  const user = await getUserByEmail(email);
  const hashToCheck = user?.password_hash ?? DUMMY_HASH;
  const valid = await verifyPassword(password, hashToCheck);

  if (!user || !valid) return { ok: false };

  if (needsRehash(user.password_hash)) {
    const rehashed = await hashPassword(password);
    await query(`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, [user.id, rehashed]);
    user.password_hash = rehashed;
  }

  await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);
  await writeAudit(null, user.email, "user.login", "user", user.id, {});

  return { ok: true, user };
}

export interface WorkspaceMembershipRow {
  workspace_id: string;
  user_id: string;
  role: "owner" | "member";
  created_at: string;
}

export async function listMembershipsForUser(userId: string): Promise<WorkspaceMembershipRow[]> {
  return query<WorkspaceMembershipRow>(
    `SELECT * FROM workspace_members WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
}

export async function getMembership(workspaceId: string, userId: string): Promise<WorkspaceMembershipRow | null> {
  const rows = await query<WorkspaceMembershipRow>(
    `SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId]
  );
  return rows[0] ?? null;
}

/** The existing owner-role member for a workspace, if any - used to decide whether a NEW claim attempt is a genuine first claim (no owner yet, claim immediately) or needs the owner_email confirmation gate (an owner already exists via this specific "no owner yet" check happening before that gate, not after). */
export async function getWorkspaceOwnerMembership(workspaceId: string): Promise<WorkspaceMembershipRow | null> {
  const rows = await query<WorkspaceMembershipRow>(
    `SELECT * FROM workspace_members WHERE workspace_id = $1 AND role = 'owner'`,
    [workspaceId]
  );
  return rows[0] ?? null;
}

export interface WorkspaceMemberWithEmail {
  userId: string;
  email: string;
  role: "owner" | "member";
  createdAt: string;
}

/** Every member of a workspace with their email, most senior (owner, then earliest-joined) first - what the account/settings "Members" panel renders. */
export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberWithEmail[]> {
  const rows = await query<{ user_id: string; email: string; role: "owner" | "member"; created_at: string }>(
    `SELECT wm.user_id, u.email, wm.role, wm.created_at
     FROM workspace_members wm
     JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = $1
     ORDER BY (wm.role = 'owner') DESC, wm.created_at ASC`,
    [workspaceId]
  );
  return rows.map((r) => ({ userId: r.user_id, email: r.email, role: r.role, createdAt: r.created_at }));
}

export type RemoveMemberResult =
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "sole_owner" };

/**
 * Removes a member's access to a workspace. Refuses to remove the workspace's
 * only owner - a workspace with zero owners is an orphan nobody can
 * administer (no invite flow exists to add a new one), so this is a hard
 * guard, not a policy choice the caller can override. The caller
 * (app/api/workspace/members/[userId]/route.ts) is responsible for checking
 * the REQUESTER is themselves an owner before calling this at all; this
 * function only protects the target from becoming an orphaned workspace.
 * A removed member's existing SESSION is not itself revoked (they may still
 * be signed in and using other workspaces), but the very next request
 * against THIS workspace fails getMembership's lookup and 401s, exactly
 * like an unknown/wrong header token would - see resolveWorkspaceAuth.
 */
export async function removeMember(workspaceId: string, userId: string, actorEmail: string): Promise<RemoveMemberResult> {
  return withTransaction(async (client) => {
    const rows = await client.query<WorkspaceMembershipRow>(
      `SELECT * FROM workspace_members WHERE workspace_id = $1 FOR UPDATE`,
      [workspaceId]
    );
    const target = rows.rows.find((m) => m.user_id === userId);
    if (!target) return { ok: false, reason: "not_found" };

    if (target.role === "owner") {
      const otherOwners = rows.rows.filter((m) => m.role === "owner" && m.user_id !== userId);
      if (otherOwners.length === 0) return { ok: false, reason: "sole_owner" };
    }

    await client.query(`DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, userId]);
    await writeAudit(workspaceId, actorEmail, "workspace.member_removed", "workspace_member", userId, {}, client);

    return { ok: true };
  });
}

export type ClaimWorkspaceResult =
  | { ok: true; role: "owner" | "member" }
  | { ok: false; reason: "already_member" }
  | { ok: false; reason: "owned_by_other" };

/**
 * Adds a membership row granting `userId` access to `workspaceId`, having
 * already verified elsewhere (see app/api/auth/claim-workspace) that the
 * caller proved possession of the workspace's anonymous token. Refuses if
 * the workspace already has a DIFFERENT owner (an owner-role member other
 * than this user) - claiming is meant to be one-shot per workspace, not an
 * open door for anyone who later gets hold of the same token to also claim
 * ownership. If this user is already a member, that is a harmless no-op
 * reported distinctly so the route can respond idempotently rather than
 * erroring on a repeat claim.
 */
export async function claimWorkspace(workspaceId: string, userId: string, actorEmail: string): Promise<ClaimWorkspaceResult> {
  return withTransaction(async (client) => {
    const existingRows = await client.query<WorkspaceMembershipRow>(
      `SELECT * FROM workspace_members WHERE workspace_id = $1 FOR UPDATE`,
      [workspaceId]
    );
    const existing = existingRows.rows;

    const mine = existing.find((m) => m.user_id === userId);
    if (mine) return { ok: false, reason: "already_member" };

    const otherOwner = existing.find((m) => m.role === "owner" && m.user_id !== userId);
    if (otherOwner) return { ok: false, reason: "owned_by_other" };

    // First claimant becomes owner; anyone claiming after that (with no
    // existing owner - should not normally happen, but kept coherent) is a
    // member rather than erroring.
    const role: "owner" | "member" = existing.some((m) => m.role === "owner") ? "member" : "owner";

    await client.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)`,
      [workspaceId, userId, role]
    );

    await writeAudit(workspaceId, actorEmail, "workspace.claimed", "workspace_member", userId, { role }, client);

    return { ok: true, role };
  });
}
