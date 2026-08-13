/**
 * Single-use, hashed, short-lived tokens for password reset, signup email
 * verification, and workspace-claim confirmation - see migration
 * 012_auth_tokens.sql's doc comment for why these three share one table.
 * Mirrors lib/repo/sessions.ts's token pattern throughout: 32 random bytes,
 * only the sha256 hash ever persisted, the plaintext returned exactly once
 * for the caller to embed in an email link.
 */
import { randomBytes, createHash } from "node:crypto";
import { query } from "@/lib/db";

export type AuthTokenPurpose = "password_reset" | "email_verification" | "workspace_claim";

const TTL_MS: Record<AuthTokenPurpose, number> = {
  password_reset: 30 * 60 * 1000, // 30 minutes - a reset link is meant to be used immediately
  email_verification: 24 * 60 * 60 * 1000, // 24 hours - low stakes, no rush
  workspace_claim: 24 * 60 * 60 * 1000, // 24 hours - gives the owner_email holder a real chance to see and click it
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface CreatedAuthToken {
  token: string;
  expiresAt: string;
}

/** Issues a fresh token for (purpose, userId[, workspaceId]). Does NOT invalidate any prior unused token of the same purpose - a consumed-or-expired old token already fails to verify, so a user requesting a second reset link is harmless (both the old and new work until whichever is used or expires first). */
export async function createAuthToken(
  purpose: AuthTokenPurpose,
  userId: string,
  workspaceId: string | null = null
): Promise<CreatedAuthToken> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TTL_MS[purpose]).toISOString();

  await query(
    `INSERT INTO auth_tokens (purpose, user_id, workspace_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [purpose, userId, workspaceId, tokenHash, expiresAt]
  );

  return { token, expiresAt };
}

export interface ConsumedAuthToken {
  userId: string;
  workspaceId: string | null;
}

/**
 * Verifies and atomically consumes a token: the UPDATE's WHERE clause
 * (purpose match, used_at IS NULL, expires_at > now) IS the check - there is
 * no separate SELECT-then-UPDATE, so two concurrent requests racing to use
 * the same token cannot both succeed (only one row-level UPDATE can win).
 * Returns null for every failure mode (unknown token, wrong purpose, already
 * used, expired) - callers must not distinguish these in their response, to
 * avoid confirming or denying a token's validity to anyone probing it.
 */
export async function consumeAuthToken(purpose: AuthTokenPurpose, token: string): Promise<ConsumedAuthToken | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);

  const rows = await query<{ user_id: string; workspace_id: string | null }>(
    `UPDATE auth_tokens
     SET used_at = now()
     WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
     RETURNING user_id, workspace_id`,
    [tokenHash, purpose]
  );
  const row = rows[0];
  if (!row) return null;
  return { userId: row.user_id, workspaceId: row.workspace_id };
}
