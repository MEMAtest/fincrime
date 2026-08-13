/**
 * The one place workspace-claiming logic lives, shared by BOTH routes that
 * can trigger it: POST /api/auth/claim-workspace (explicit "save this
 * browser's workspace to my account") and POST /api/auth/signup (implicit
 * auto-claim of the browser's current anonymous workspace at signup time).
 * Sharing this is deliberate, not incidental: the owner_email confirmation
 * gate below is a security control against a leaked/stolen workspace token
 * being turned into permanent third-party access - if signup had its OWN,
 * simpler claim call that skipped the gate, an attacker holding a stolen
 * token could bypass the gate entirely just by signing up a fresh account
 * with it instead of using the claim-workspace route.
 */
import { getWorkspaceOwnerMembership, claimWorkspace } from "@/lib/repo/users";
import { createAuthToken } from "@/lib/repo/auth-tokens";
import { sendSimpleEmail } from "@/lib/email";
import type { WorkspaceRow } from "@/lib/repo/workspace";

const APP_BASE_URL = (process.env.APP_BASE_URL || "https://fincrime.memaconsultants.com").replace(/\/$/, "");

export type ClaimAttemptResult =
  | { kind: "claimed"; role: "owner" | "member" }
  | { kind: "pending" }
  | { kind: "already_member" }
  | { kind: "owned_by_other" };

/**
 * Attempts to claim `workspace` for `userId`. Three cases:
 *  1. The workspace already has an owner (a DIFFERENT user, or this same
 *     user re-claiming) - delegate straight to claimWorkspace, which
 *     already handles "already mine" (idempotent) vs "owned by someone
 *     else" (refused) correctly. No email gate applies here: an
 *     already-claimed workspace cannot be claimed out from under its owner
 *     regardless of whether owner_email is set, so there is nothing the
 *     gate would protect that claimWorkspace does not already refuse.
 *  2. No owner yet, and owner_email is NOT set - this is a genuinely
 *     unclaimed workspace with nobody to confirm with; claim immediately
 *     (first claimant becomes owner), exactly as before this gate existed.
 *  3. No owner yet, and owner_email IS set (e.g. backfilled by a PDF
 *     export's lead capture) - this is the case the security review
 *     flagged: anyone who merely holds the workspace's TOKEN (a leaked
 *     laptop, a support screenshare, a stolen browser profile) could
 *     otherwise claim it permanently for their own account with no
 *     confirmation from the workspace's actual owner. Instead of claiming
 *     immediately, issue a single-use confirmation token and email a link
 *     to owner_email; the claim only completes when that link is clicked
 *     (GET /api/auth/claim-workspace/confirm), which only the person with
 *     access to that inbox can do.
 */
export async function attemptClaimWorkspace(
  workspace: WorkspaceRow,
  userId: string,
  actorEmail: string
): Promise<ClaimAttemptResult> {
  const existingOwner = await getWorkspaceOwnerMembership(workspace.id);

  if (!existingOwner && workspace.owner_email) {
    const { token } = await createAuthToken("workspace_claim", userId, workspace.id);
    const confirmUrl = `${APP_BASE_URL}/api/auth/claim-workspace/confirm?token=${encodeURIComponent(token)}`;
    // Best-effort: a transient SES failure must not crash the calling
    // route (signup, or the claim-workspace route) - the requester can
    // always retry the claim, which issues a fresh token.
    await sendSimpleEmail({
      to: workspace.owner_email,
      subject: "Confirm access to your FinCrime Control Lab workspace",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <p style="color:#1e293b;">${actorEmail} is asking to link their account to a FinCrime Control Lab workspace registered to this address.</p>
          <p style="color:#1e293b;">If this was you, confirm access:</p>
          <p><a href="${confirmUrl}" style="display:inline-block;background:#14b8a6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Confirm access</a></p>
          <p style="color:#64748b;font-size:13px;">If you did not expect this, you can safely ignore this email - no access is granted until this link is clicked. This link expires in 24 hours.</p>
        </div>`,
    }).catch((error: unknown) => console.error("Claim confirmation email error:", error));
    return { kind: "pending" };
  }

  const result = await claimWorkspace(workspace.id, userId, actorEmail);
  if (!result.ok) {
    return result.reason === "already_member" ? { kind: "already_member" } : { kind: "owned_by_other" };
  }
  return { kind: "claimed", role: result.role };
}
