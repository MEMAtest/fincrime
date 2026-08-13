import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { query } from "@/lib/db";
import { writeAudit } from "./audit";

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  last_seen_at: string;
  user_agent: string | null;
  ip: string | null;
}

export interface CreatedSession {
  id: string;
  token: string;
  expiresAt: string;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a session: 32 random bytes, sha256 hash stored (mirrors
 * workspaces' token_hash pattern in lib/repo/workspace.ts), 30-day expiry.
 * The plaintext token is returned once for the caller to set as an httpOnly
 * cookie - it is never stored or logged.
 */
export async function createSession(
  userId: string,
  actorEmail: string,
  meta: { userAgent?: string | null; ip?: string | null } = {}
): Promise<CreatedSession> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const rows = await query<SessionRow>(
    `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, tokenHash, expiresAt, meta.userAgent ?? null, meta.ip ?? null]
  );
  const session = rows[0];

  await writeAudit(null, actorEmail, "session.created", "session", session.id, {});

  return { id: session.id, token, expiresAt: session.expires_at };
}

/**
 * Verifies a session token: hashes it, looks up the row, checks it has not
 * expired, and (if valid) slides last_seen_at forward. Returns null for any
 * failure mode (unknown token, expired) - callers must not distinguish
 * these in a response.
 */
export async function verifySession(token: string): Promise<SessionRow | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);

  const rows = await query<SessionRow>(`SELECT * FROM sessions WHERE token_hash = $1`, [tokenHash]);
  const session = rows[0];
  if (!session) return null;

  // Constant-time compare against the row found by the hash lookup itself
  // (the lookup is already exact-match on the hash, so this is a defensive
  // second check rather than the primary guard - included so a future
  // refactor to a prefix-based lookup would not silently drop the
  // constant-time property).
  const candidateHash = Buffer.from(tokenHash);
  const storedHash = Buffer.from(session.token_hash);
  if (candidateHash.length !== storedHash.length || !timingSafeEqual(candidateHash, storedHash)) return null;

  if (new Date(session.expires_at).getTime() <= Date.now()) return null;

  await query(`UPDATE sessions SET last_seen_at = now() WHERE id = $1`, [session.id]);

  return session;
}

/**
 * Revokes a single session by its plaintext token (e.g. logout on this
 * device). Resolves the actor's email itself (via a join to users, in the
 * same DELETE) rather than requiring the caller to look it up first - a
 * logout route just has a cookie, not necessarily an already-loaded user.
 */
export async function revokeSession(token: string): Promise<boolean> {
  if (!token) return false;
  const tokenHash = hashToken(token);

  const rows = await query<{ id: string; email: string }>(
    `DELETE FROM sessions s USING users u
     WHERE s.token_hash = $1 AND u.id = s.user_id
     RETURNING s.id, u.email`,
    [tokenHash]
  );
  const revoked = rows.length > 0;
  if (revoked) {
    await writeAudit(null, rows[0].email, "session.revoked", "session", rows[0].id, {});
  }
  return revoked;
}

/** Revokes every session for a user (e.g. "sign out everywhere" from the account page). */
export async function revokeAllSessionsForUser(userId: string, actorEmail: string): Promise<number> {
  const rows = await query<{ id: string }>(`DELETE FROM sessions WHERE user_id = $1 RETURNING id`, [userId]);
  if (rows.length > 0) {
    await writeAudit(null, actorEmail, "session.revoked_all", "user", userId, { count: rows.length });
  }
  return rows.length;
}

/**
 * Deletes every expired session. Not wired to a cron in this codebase (no
 * scheduler exists here) - callers can invoke this opportunistically (e.g.
 * the smoke test calls it directly); an expired session is already rejected
 * by verifySession() regardless of whether this has run, so correctness
 * does not depend on it, only table bloat.
 */
export async function pruneExpiredSessions(): Promise<number> {
  const rows = await query<{ id: string }>(`DELETE FROM sessions WHERE expires_at <= now() RETURNING id`);
  return rows.length;
}
