import { NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session-cookie";
import { verifySession } from "@/lib/repo/sessions";
import { getMembership, getUserById } from "@/lib/repo/users";
import { getWorkspace } from "@/lib/repo/workspace";
import { isUuid } from "@/lib/auth/validation";
import { resolveWorkspaceSettings } from "@/lib/workspace/settings";
import { loadGovernancePortfolio } from "@/lib/governance/load";
import { buildDigest } from "@/lib/notifications/digest";
import { sendDigestEmail, unsubscribeUrlForToken } from "@/lib/notifications/send";
import { getOrCreatePreferences } from "@/lib/repo/notifications";
import { checkRateLimit } from "@/lib/rate-limit";
import { tooManyRequests } from "@/lib/auth/helpers";

// Keyed on the USER id, not the caller's IP: this route runs a full
// portfolio aggregation AND an SES send per call, so it is a shared-SES-quota
// abuse vector (30 rapid POSTs from one account previously all returned 200 -
// each real senders on the shared quota, which the same PDF-delivery and
// lead-capture sends depend on). An IP-keyed limit would not stop a single
// account script-looping this from behind a rotating/shared IP; a user-keyed
// limit stops the abusive ACCOUNT regardless of source IP.
const TEST_DIGEST_LIMIT = 5;
const TEST_DIGEST_WINDOW_MS = 10 * 60 * 1000;

/**
 * POST /api/notifications/test - body {workspaceId}. Session-authenticated.
 * Builds and immediately sends the CALLER's own digest (bypassing the
 * frequency-due-today and unchanged-hash checks the cron endpoint applies -
 * this is "show me exactly what I would receive right now", not a real
 * scheduled send, so it is never throttled and never recorded in
 * notification_log as a 'digest' kind send that would suppress the next
 * real cron send of the same content). If there is nothing outstanding,
 * says so rather than sending an empty "all clear" email - the same
 * noise-risk rule the real digest follows.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const workspaceId = body && typeof body === "object" && "workspaceId" in body ? String((body as Record<string, unknown>).workspaceId) : "";
  if (!isUuid(workspaceId)) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const token = readSessionCookie(request);
  if (!token) return NextResponse.json({ error: "Sign in and select a workspace you are a member of" }, { status: 401 });
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Sign in and select a workspace you are a member of" }, { status: 401 });
  const membership = await getMembership(workspaceId, session.user_id);
  if (!membership) return NextResponse.json({ error: "Sign in and select a workspace you are a member of" }, { status: 401 });
  const user = await getUserById(session.user_id);
  if (!user) return NextResponse.json({ error: "Sign in and select a workspace you are a member of" }, { status: 401 });

  const { allowed } = checkRateLimit(`notifications-test:${user.id}`, TEST_DIGEST_LIMIT, TEST_DIGEST_WINDOW_MS);
  if (!allowed) return tooManyRequests("Too many test digests requested. Try again in a few minutes.");

  const workspace = await getWorkspace(workspaceId);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const settings = resolveWorkspaceSettings(workspace.settings);
  const today = new Date();
  const portfolio = await loadGovernancePortfolio(workspaceId, today, settings.reviewReminderDays);
  const preference = await getOrCreatePreferences(user.id, workspaceId);

  // A test send always uses the member's category toggles (so the preview
  // is honest about what they would actually receive) but ignores
  // frequency='off' - a member testing the feature should be able to see
  // the preview even before deciding to turn digests on.
  const digest = buildDigest(portfolio, { frequency: "daily", categories: preference.categories }, today);
  if (!digest) {
    return NextResponse.json({ sent: false, message: "Nothing outstanding right now - no digest to send." });
  }

  const delivered = await sendDigestEmail({
    to: user.email,
    digest,
    organisationName: settings.organisationName,
    dateFormat: settings.dateFormat,
    unsubscribeUrl: unsubscribeUrlForToken(preference.unsubscribe_token),
  });

  if (!delivered) {
    return NextResponse.json({ sent: false, message: "Could not send the test digest. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ sent: true, itemCount: digest.totalItems });
}
