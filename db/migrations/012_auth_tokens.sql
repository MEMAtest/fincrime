-- FinCrime Control Lab: single-use email-delivered tokens.
--
-- One table, three purposes, rather than three near-identical tables -
-- password reset, email verification (at signup), and workspace-claim
-- confirmation (sent to a workspace's owner_email when one is already set,
-- so a leaked anonymous workspace token alone cannot be turned into a
-- permanent account claim - see 010_accounts.sql's claimWorkspace and the
-- security review that asked for this). All three share the same shape:
-- issued to exactly one user, single-use, short-lived, and only ever
-- verified by a sha256 hash of the raw token (mirrors sessions.token_hash
-- and workspaces.token_hash - the plaintext token is never stored).
--
-- workspace_id is only populated for purpose = 'workspace_claim' (which
-- workspace the confirmation grants); NULL for the other two purposes.
--
-- Idempotent: IF NOT EXISTS throughout, safe to re-run.
-- Apply with: npm run db:migrate (scripts/db-migrate.mjs)

CREATE TABLE IF NOT EXISTS auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose TEXT NOT NULL CHECK (purpose IN ('password_reset', 'email_verification', 'workspace_claim')),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

-- Every lookup is by hash; unique because two live tokens hashing to the
-- same value would be a collision (astronomically unlikely at 32 random
-- bytes, but the constraint costs nothing and documents the invariant).
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_tokens_token_hash ON auth_tokens (token_hash);

-- Supports "does this user already have a live token of this purpose"
-- checks (e.g. re-requesting a password reset need not be capped here -
-- that is rate-limit's job - but a stale unused token should not silently
-- linger forever; see lib/repo/auth-tokens.ts).
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_purpose ON auth_tokens (user_id, purpose);
