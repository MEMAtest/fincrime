-- FinCrime Control Lab: optional accounts and authentication.
--
-- Additive, not a replacement: the anonymous workspace/token model (see
-- 001_workflow_foundation.sql) is untouched and remains valid indefinitely.
-- This adds a parallel identity layer - users can sign up, sign in, and
-- "claim" an anonymous workspace they already hold the token for, gaining
-- session-based access to it alongside the existing header-token access.
--
-- users: an account (email + password hash). CITEXT is not enabled anywhere
-- else in this schema, so email uniqueness is enforced by storing/comparing
-- lower(email) via a unique index on a generated lowercase expression rather
-- than pulling in an extra Postgres extension for one column.
--
-- sessions: one row per logged-in browser. Only sha256(token) is stored,
-- mirroring workspaces.token_hash; the plaintext token is a bearer cookie.
--
-- workspace_members: join table granting a user access to a workspace via
-- session, alongside (not instead of) the existing header-token path. role
-- 'owner' is the account that claimed/created the workspace via an account;
-- 'member' is anyone else later added. workspace_people (named individuals
-- for approvals) is untouched and not linked here - conflating the two was
-- explicitly ruled out by the design doc.
--
-- Idempotent: IF NOT EXISTS / IF NOT EXISTS throughout, safe to re-run.
-- Apply with: npm run db:migrate (scripts/db-migrate.mjs)

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  email_verified_at TIMESTAMPTZ
);

-- Case-insensitive uniqueness without CITEXT: unique index on lower(email).
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);

-- audit_log (001_workflow_foundation.sql) was workspace-scoped only:
-- workspace_id UUID NOT NULL REFERENCES workspaces(id). Account-level
-- mutations (signup, login, logout, session create/revoke) are not scoped
-- to any single workspace, so audit_log needs to accept a null
-- workspace_id for those rows - everything workspace-scoped keeps passing
-- a real id exactly as before (writeAudit's signature only widened to
-- accept `string | null`, every existing caller is untouched). DROP NOT
-- NULL is idempotent: re-running this against an already-nullable column
-- is a no-op, not an error.
ALTER TABLE audit_log ALTER COLUMN workspace_id DROP NOT NULL;

