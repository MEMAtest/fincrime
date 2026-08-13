import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/repo/workspace";
import { resolveWorkspaceSettings } from "@/lib/workspace/settings";
import { loadGovernancePortfolio } from "@/lib/governance/load";
import { buildDigest, isFrequencyDueToday } from "@/lib/notifications/digest";
import { sendDigestEmail, unsubscribeUrlForToken } from "@/lib/notifications/send";
import {
  listWorkspaceMembersWithEmail,
  getOrCreatePreferences,
  getLastSuccessfulLog,
  recordNotificationLog,
  type WorkspaceMemberForNotify,
} from "@/lib/repo/notifications";

const DIGEST_KIND = "digest";

/** Caps how many workspaces one invocation processes, so a very large membership table cannot make a single cron run unbounded - the daily GitHub Actions schedule simply catches the rest on the next run. */
const MAX_WORKSPACES_PER_RUN = Number.parseInt(process.env.NOTIFICATIONS_MAX_WORKSPACES_PER_RUN || "500", 10);

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Padding to a fixed comparison length before the constant-time compare
  // avoids leaking the secret's length via early return on a length
  // mismatch, mirroring the intent (if not the exact mechanism) of
  // lib/repo/sessions.ts's verifySession token comparison.
  const maxLen = Math.max(bufA.length, bufB.length, 32);
  const paddedA = Buffer.alloc(maxLen);
  const paddedB = Buffer.alloc(maxLen);
  bufA.copy(paddedA);
  bufB.copy(paddedB);
  return bufA.length === bufB.length && timingSafeEqual(paddedA, paddedB);
}

function isAuthorized(request: NextRequest): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return false;
  return timingSafeEqualStrings(match[1], secret);
}

function groupByWorkspace(members: WorkspaceMemberForNotify[]): Map<string, WorkspaceMemberForNotify[]> {
  const map = new Map<string, WorkspaceMemberForNotify[]>();
  for (const member of members) {
    const list = map.get(member.workspace_id);
    if (list) list.push(member);
    else map.set(member.workspace_id, [member]);
  }
  return map;
}

/**
 * POST /api/notifications/run - the cron entry point (see
 * .github/workflows/notifications.yml). Protected by a shared secret
 * compared with timingSafeEqual, never revealed in any error response.
 *
 * For each workspace with at least one account-holding member: loads the
 * SAME governance portfolio the dashboard uses (lib/governance/load.ts, via
 * the workspace's own reviewReminderDays setting), then for each member
 * builds their digest and skips it (no email, no log row) when there is
 * nothing outstanding, the member's frequency is not due today, or the
 * digest is unchanged since their last successful send. Every ACTUAL send
 * attempt (success or failure) is recorded in notification_log. One
 * workspace's failure (a bad row, a portfolio load error) is caught and
 * logged without aborting the rest of the run - resilience across
 * workspaces is the whole point of the per-workspace try/catch below.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const members = await listWorkspaceMembersWithEmail();
  const byWorkspace = groupByWorkspace(members);

  let workspacesProcessed = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const workspaceErrors: { workspaceId: string; error: string }[] = [];

  for (const [workspaceId, workspaceMembers] of byWorkspace) {
    if (workspacesProcessed >= MAX_WORKSPACES_PER_RUN) break;
    workspacesProcessed += 1;

    try {
      const workspace = await getWorkspace(workspaceId);
      if (!workspace) continue;

      const settings = resolveWorkspaceSettings(workspace.settings);
      const portfolio = await loadGovernancePortfolio(workspaceId, today, settings.reviewReminderDays);

      for (const member of workspaceMembers) {
        try {
          const preference = await getOrCreatePreferences(member.user_id, workspaceId);
          if (preference.frequency === "off") {
            skipped += 1;
            continue;
          }
          if (!isFrequencyDueToday(preference.frequency, today)) {
            skipped += 1;
            continue;
          }

          const digest = buildDigest(portfolio, { frequency: preference.frequency, categories: preference.categories }, today);
          if (!digest) {
            skipped += 1;
            continue;
          }

          const lastSuccessful = await getLastSuccessfulLog(workspaceId, member.user_id, DIGEST_KIND);
          if (lastSuccessful && lastSuccessful.summary_hash === digest.summaryHash) {
            skipped += 1;
            continue;
          }

          let sendError: string | null = null;
          try {
            const delivered = await sendDigestEmail({
              to: member.email,
              digest,
              organisationName: settings.organisationName,
              dateFormat: settings.dateFormat,
              unsubscribeUrl: unsubscribeUrlForToken(preference.unsubscribe_token),
            });
            if (!delivered) sendError = "Email provider returned failure";
          } catch (error) {
            sendError = error instanceof Error ? error.message : "Unknown send error";
          }

          await recordNotificationLog({
            workspaceId,
            userId: member.user_id,
            kind: DIGEST_KIND,
            summaryHash: digest.summaryHash,
            itemCount: digest.totalItems,
            error: sendError,
          });

          if (sendError) failed += 1;
          else sent += 1;
        } catch (memberError) {
          failed += 1;
          console.error(`notifications/run: member ${member.user_id} in workspace ${workspaceId} failed`, memberError);
        }
      }
    } catch (workspaceError) {
      const message = workspaceError instanceof Error ? workspaceError.message : "Unknown workspace error";
      workspaceErrors.push({ workspaceId, error: message });
      console.error(`notifications/run: workspace ${workspaceId} failed`, workspaceError);
    }
  }

  return NextResponse.json({
    workspacesProcessed,
    sent,
    skipped,
    failed,
    workspaceErrors,
  });
}
