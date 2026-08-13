-- FinCrime Control Lab: notification digests.
--
-- Additive: builds on migration 010's users/workspace_members. Notifications
-- go to account holders (workspace_members, i.e. users with a real login),
-- not workspace_people (named individuals used for decision sign-off who
-- may have no mailbox this app can safely email) - see
-- docs/auth-and-notifications.md's "who to tell" argument. A workspace with
-- no members therefore has nothing in either table below and the cron
-- endpoint sends it nothing.
--
-- notification_preferences: one row per (user, workspace) pair, created
-- lazily on first access with all-on defaults (see
-- lib/repo/notifications.ts's getOrCreatePreferences) rather than backfilled
-- here for every existing membership - a membership added after this
-- migration runs still gets a coherent default the first time the cron or
-- the settings page touches it. frequency gates whether/how often that pair
-- is emailed at all; categories is a per-section on/off toggle so a user can
-- mute e.g. control-testing reminders without going fully 'off'.
-- unsubscribe_token is the opaque value embedded in every digest's one-click
-- unsubscribe link (GET /api/notifications/unsubscribe?token=...) - unique,
-- generated once at row-creation time, never reused.
--
-- notification_log: one row per actually-attempted send (never per skip -
-- see lib/notifications - "nothing outstanding" and "unchanged since last
-- successful send" are not attempts and do not get a row). Success and
-- failure both get a row (error NULL vs populated) so a failing workspace
-- is visible without aborting the run for the rest, and so the next run can
-- retry a failure while still correctly skipping an unchanged situation
-- that was already sent successfully. summary_hash is compared against the
-- most recent error-free row for the same (workspace_id, user_id, kind) to
-- decide whether the current digest is a repeat.
--
-- Idempotent: IF NOT EXISTS throughout, safe to re-run.
-- Apply with: npm run db:migrate (scripts/db-migrate.mjs)

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('off', 'daily', 'weekly')),
  categories JSONB NOT NULL DEFAULT '{"decisions": true, "actions": true, "conditions": true, "commitments": true, "controlTests": true}'::jsonb,
  unsubscribe_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, workspace_id)
);

-- One-click unsubscribe looks this up with no other credential, so it must
-- be unique and indexed for a fast, safe lookup.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_preferences_unsubscribe_token
  ON notification_preferences (unsubscribe_token);

CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind TEXT NOT NULL,
  summary_hash TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  error TEXT
);

-- Covers both lookups the cron endpoint needs: "what was the last
-- successful send for this (workspace, user, kind)" (summary_hash
-- comparison) and general workspace/user audit queries.
CREATE INDEX IF NOT EXISTS idx_notification_log_workspace_user
  ON notification_log (workspace_id, user_id, kind, sent_at DESC);
