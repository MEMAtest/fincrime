import { NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session-cookie";
import { verifySession } from "@/lib/repo/sessions";
import { getUserById } from "@/lib/repo/users";
import { verifyWorkspace, toWorkspaceSummary } from "@/lib/repo/workspace";
import { attemptClaimWorkspace } from "@/lib/auth/claim-flow";
import { isUuid } from "@/lib/auth/validation";
import { badRequest, conflict, serverError, unauthorized } from "@/lib/auth/helpers";

/**
 * POST /api/auth/claim-workspace - body {workspaceId, workspaceToken}.
 * Requires a signed-in session (this is the "save this workspace to your
 * account" action, only meaningful once signed in). Proves the caller
 * actually holds the anonymous workspace's token (same verification
 * withWorkspace's header path uses - not merely a workspaceId the caller
 * could guess).
 *
 * What happens next depends on the workspace's state (see
 * lib/auth/claim-flow.ts's attemptClaimWorkspace): a workspace with no
 * owner yet and no owner_email set claims immediately (201); a workspace
 * with no owner yet but a KNOWN owner_email instead defers behind an
 * emailed confirmation link to that address (202, `pending: true`) - proving
 * you hold the raw token is not, on its own, enough to permanently claim a
 * workspace someone already gave an owner_email for, precisely because a
 * bare token can leak (a stolen laptop, a support screenshare) without its
 * owner ever knowing; a workspace that already has a DIFFERENT owner
 * refuses outright (409) regardless of owner_email, since claiming is
 * one-shot.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionToken = readSessionCookie(request);
    if (!sessionToken) return unauthorized("Sign in required");
    const session = await verifySession(sessionToken);
    if (!session) return unauthorized("Sign in required");
    const user = await getUserById(session.user_id);
    if (!user) return unauthorized("Sign in required");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Invalid JSON body");
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return badRequest("Body must be an object");
    }
    const b = body as Record<string, unknown>;

    if (!isUuid(b.workspaceId)) return badRequest("workspaceId must be a valid UUID");
    if (typeof b.workspaceToken !== "string" || !b.workspaceToken) {
      return badRequest("workspaceToken is required");
    }

    const workspace = await verifyWorkspace(b.workspaceId, b.workspaceToken);
    if (!workspace) return badRequest("Unknown or invalid workspace credentials");

    const result = await attemptClaimWorkspace(workspace, user.id, user.email);
    switch (result.kind) {
      case "already_member":
        // Idempotent: claiming a workspace you already belong to is a
        // harmless no-op, not an error.
        return NextResponse.json({ workspace: toWorkspaceSummary(workspace), role: "already_member" });
      case "owned_by_other":
        return conflict("This workspace is already owned by a different account");
      case "pending":
        return NextResponse.json(
          {
            pending: true,
            message: "This workspace has a registered owner email. We sent a confirmation link to that address - access is granted once it is clicked.",
          },
          { status: 202 }
        );
      case "claimed":
        return NextResponse.json({ workspace: toWorkspaceSummary(workspace), role: result.role }, { status: 201 });
      default:
        return serverError("Claim workspace error", new Error(`Unexpected claim result: ${JSON.stringify(result)}`));
    }
  } catch (error) {
    return serverError("Claim workspace error", error);
  }
}
