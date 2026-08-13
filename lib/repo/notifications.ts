import { randomBytes } from "node:crypto";
import { query } from "@/lib/db";
import { writeAudit } from "./audit";
import {
  DEFAULT_NOTIFICATION_CATEGORIES,
  type NotificationCategories,
  type NotificationFrequency,
} from "@/lib/notifications/digest";

export interface NotificationPreferenceRow {
  user_id: string;
  workspace_id: string;
  frequency: NotificationFrequency;
  categories: NotificationCategories;
  unsubscribe_token: string;
  created_at: string;
  updated_at: string;
}

function generateUnsubscribeToken(): string {
  return randomBytes(24).toString("hex");
}

/**
 * Fetches the (userId, workspaceId) preference row, creating one with
 * documented defaults (frequency 'daily', every category on, a fresh
 * unsubscribe token) on first access. Every workspace member is therefore
 * implicitly opted in to the daily digest without a separate "enable
 * notifications" step - this is safe precisely because buildDigest (lib/
 * notifications/digest.ts) never sends when there is nothing outstanding,
 * so a member who never visits the settings page only ever hears from this
 * system when something genuinely needs their attention.
 *
 * INSERT ... ON CONFLICT DO NOTHING handles the race between two concurrent
 * first-accesses (e.g. two cron workers, or a cron run overlapping a user
 * loading the settings page) without a transaction: at most one INSERT
 * wins, and the loser's caller falls through to the SELECT and reads the
 * winner's row.
 */
export async function getOrCreatePreferences(userId: string, workspaceId: string): Promise<NotificationPreferenceRow> {
  const existing = await query<NotificationPreferenceRow>(
    `SELECT * FROM notification_preferences WHERE user_id = $1 AND workspace_id = $2`,
    [userId, workspaceId]
  );
  if (existing[0]) return existing[0];

  const token = generateUnsubscribeToken();
  const inserted = await query<NotificationPreferenceRow>(
    `INSERT INTO notification_preferences (user_id, workspace_id, unsubscribe_token)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, workspace_id) DO NOTHING
     RETURNING *`,
    [userId, workspaceId, token]
  );
  if (inserted[0]) return inserted[0];

  const rows = await query<NotificationPreferenceRow>(
    `SELECT * FROM notification_preferences WHERE user_id = $1 AND workspace_id = $2`,
    [userId, workspaceId]
  );
  return rows[0];
}

export interface UpdatePreferencesInput {
  frequency?: NotificationFrequency;
  categories?: NotificationCategories;
}

/** Updates frequency and/or categories for an existing (or lazily-created) preference row. */
export async function updatePreferences(
  userId: string,
  workspaceId: string,
  patch: UpdatePreferencesInput,
  actor: string
): Promise<NotificationPreferenceRow> {
  const current = await getOrCreatePreferences(userId, workspaceId);
  const frequency = patch.frequency ?? current.frequency;
  const categories = patch.categories ?? current.categories;

  const rows = await query<NotificationPreferenceRow>(
    `UPDATE notification_preferences
     SET frequency = $3, categories = $4::jsonb, updated_at = now()
     WHERE user_id = $1 AND workspace_id = $2
     RETURNING *`,
    [userId, workspaceId, frequency, JSON.stringify(categories)]
  );
  const updated = rows[0];
  await writeAudit(workspaceId, actor, "notification_preferences.updated", "notification_preferences", userId, { ...patch });
  return updated;
}

/**
 * Resolves an unsubscribe token to its preference row. Callers (the
 * unsubscribe route) must not distinguish "unknown token" from any other
 * failure mode in the response, to avoid confirming or denying a token's
 * validity to anyone probing it.
 */
export async function getPreferencesByToken(token: string): Promise<NotificationPreferenceRow | null> {
  if (!token) return null;
  const rows = await query<NotificationPreferenceRow>(
    `SELECT * FROM notification_preferences WHERE unsubscribe_token = $1`,
    [token]
  );
  return rows[0] ?? null;
}

/**
 * Sets frequency to 'off' for whatever preference row the token resolves
 * to. Idempotent (setting an already-off row to 'off' again is a no-op
 * write, not an error) and silent about whether the token existed at all -
 * the route built on this always returns the same confirmation page either
 * way, so a token guess cannot be used to enumerate valid tokens.
 */
export async function unsubscribeByToken(token: string): Promise<void> {
  if (!token) return;
  const rows = await query<NotificationPreferenceRow>(
    `UPDATE notification_preferences
     SET frequency = 'off', updated_at = now()
     WHERE unsubscribe_token = $1
     RETURNING user_id, workspace_id`,
    [token]
  );
  const row = rows[0];
  if (row) {
    await writeAudit(row.workspace_id ?? null, "unsubscribe-link", "notification_preferences.unsubscribed", "notification_preferences", row.user_id, {});
  }
}

export interface WorkspaceMemberForNotify {
  workspace_id: string;
  user_id: string;
  email: string;
}

/**
 * Every (workspace, user) membership with a real login, grouped by the
 * caller for per-workspace processing.
 *
 * Ordered by each WORKSPACE's last successful digest send (oldest/never-sent
 * first, NULLS FIRST) rather than by workspace_id - workspace_id ASC is a
 * fixed, deterministic order, so under app/api/notifications/run's
 * MAX_WORKSPACES_PER_RUN cap the same tail of workspaces (whichever sort
 * last alphabetically by UUID) would NEVER be reached, run after run. Once
 * a workspace's digest succeeds, its last-sent timestamp advances to "now",
 * which pushes it to the BACK of this ordering for the next run - so the
 * cap rotates which workspaces get skipped instead of permanently starving
 * one tail. A workspace with no successful send yet sorts first (NULLS
 * FIRST), so a brand-new workspace is never queued behind an established
 * one purely because of the tiebreak. workspace_id/user_id remain secondary
 * sort keys only to make the order stable when timestamps tie (e.g. two
 * workspaces that have never sent).
 */
export async function listWorkspaceMembersWithEmail(kind = "digest"): Promise<WorkspaceMemberForNotify[]> {
  return query<WorkspaceMemberForNotify>(
    `SELECT wm.workspace_id, wm.user_id, u.email
     FROM workspace_members wm
     JOIN users u ON u.id = wm.user_id
     LEFT JOIN (
       SELECT workspace_id, MAX(sent_at) AS last_sent_at
       FROM notification_log
       WHERE kind = $1 AND error IS NULL
       GROUP BY workspace_id
     ) last_send ON last_send.workspace_id = wm.workspace_id
     ORDER BY last_send.last_sent_at ASC NULLS FIRST, wm.workspace_id ASC, wm.user_id ASC`,
    [kind]
  );
}

export interface NotificationLogRow {
  id: string;
  workspace_id: string;
  user_id: string;
  sent_at: string;
  kind: string;
  summary_hash: string;
  item_count: number;
  error: string | null;
}

/** The most recent SUCCESSFUL (error IS NULL) log row for this (workspace, user, kind) - what a new digest's summaryHash is compared against to decide whether it is a repeat. A failed attempt is deliberately excluded so a transient SES failure never blocks a retry. */
export async function getLastSuccessfulLog(
  workspaceId: string,
  userId: string,
  kind: string
): Promise<NotificationLogRow | null> {
  const rows = await query<NotificationLogRow>(
    `SELECT * FROM notification_log
     WHERE workspace_id = $1 AND user_id = $2 AND kind = $3 AND error IS NULL
     ORDER BY sent_at DESC
     LIMIT 1`,
    [workspaceId, userId, kind]
  );
  return rows[0] ?? null;
}

export interface RecordLogInput {
  workspaceId: string;
  userId: string;
  kind: string;
  summaryHash: string;
  itemCount: number;
  error?: string | null;
}

/** Records one send attempt, success or failure. Every call here corresponds to an actual delivery attempt - a skip (nothing outstanding, or an unchanged hash) never reaches this function and never gets a row. */
export async function recordNotificationLog(input: RecordLogInput): Promise<void> {
  await query(
    `INSERT INTO notification_log (workspace_id, user_id, kind, summary_hash, item_count, error)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [input.workspaceId, input.userId, input.kind, input.summaryHash, input.itemCount, input.error ?? null]
  );
}

export { DEFAULT_NOTIFICATION_CATEGORIES };
