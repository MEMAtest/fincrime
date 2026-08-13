import { NextRequest, NextResponse } from "next/server";
import { verifyWorkspace, getWorkspace, type WorkspaceRow } from "@/lib/repo/workspace";
import { WORKSPACE_ID_HEADER, WORKSPACE_TOKEN_HEADER } from "@/lib/workspace-client";
import { readSessionCookie } from "@/lib/auth/session-cookie";
import { verifySession } from "@/lib/repo/sessions";
import { getMembership, getUserById } from "@/lib/repo/users";
import { isUuid } from "@/lib/auth/validation";

/**
 * Reads the x-workspace-id / x-workspace-token headers from a request and
 * verifies them against the stored token hash. Returns the workspace row, or
 * null if the headers are missing or do not verify. UNCHANGED by the
 * accounts work below - this is the header-only check, still used as-is by
 * app/api/export/pdf/route.ts and by withWorkspace's header path.
 */
export async function getAuthenticatedWorkspace(request: NextRequest): Promise<WorkspaceRow | null> {
  const id = request.headers.get(WORKSPACE_ID_HEADER);
  const token = request.headers.get(WORKSPACE_TOKEN_HEADER);
  if (!id || !token) return null;

  try {
    return await verifyWorkspace(id, token);
  } catch (error) {
    console.error("Workspace verification error:", error);
    return null;
  }
}

/**
 * The generic actor string every route used before accounts existed, and
 * still the actor for the anonymous header path - unchanged.
 */
export const ANONYMOUS_ACTOR = "workspace";

export interface ResolvedAuth {
  workspace: WorkspaceRow;
  /** "workspace" for the header path; the signed-in user's email for the session path. */
  actor: string;
  /** The authenticated user's id, or null when authenticated via the anonymous header token. */
  userId: string | null;
}

/**
 * Resolves a request to a workspace by EITHER path:
 *  1. The existing x-workspace-id / x-workspace-token headers (tried first,
 *     exactly as before - this path's outcome is byte-for-byte identical to
 *     the pre-accounts behaviour).
 *  2. A session cookie plus membership: the session cookie identifies a
 *     user, and the x-workspace-id header (token NOT required this time)
 *     names which of that user's workspaces to use - the user must have a
 *     workspace_members row for it, otherwise this path refuses exactly
 *     like an unknown/wrong header token would.
 * Returns null if neither path authenticates.
 */
export async function resolveWorkspaceAuth(request: NextRequest): Promise<ResolvedAuth | null> {
  const headerWorkspace = await getAuthenticatedWorkspace(request);
  if (headerWorkspace) {
    return { workspace: headerWorkspace, actor: ANONYMOUS_ACTOR, userId: null };
  }

  const sessionToken = readSessionCookie(request);
  const workspaceId = request.headers.get(WORKSPACE_ID_HEADER);
  if (!sessionToken || !workspaceId || !isUuid(workspaceId)) return null;

  const session = await verifySession(sessionToken);
  if (!session) return null;

  const membership = await getMembership(workspaceId, session.user_id);
  if (!membership) return null;

  const workspace = await getWorkspace(workspaceId);
  if (!workspace) return null;

  const user = await getUserById(session.user_id);
  if (!user) return null;

  return { workspace, actor: user.email, userId: user.id };
}

export type WorkspaceRouteHandler<Context = unknown> = (
  request: NextRequest,
  workspace: WorkspaceRow,
  context: Context,
  /**
   * Who to attribute this request's mutations to for audit_log: "workspace"
   * (today's default) for the anonymous header path, the signed-in user's
   * email for the session path. Existing route handlers do not need this
   * parameter (adding it is additive - a handler that only destructures
   * (request, workspace) keeps working unchanged); a route can opt in to
   * naming a real person in its audit trail by adding it, as
   * app/api/workspace/settings/route.ts's PATCH handler does.
   */
  actor: string
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a route handler with workspace auth, matching the response style of
 * the rest of app/api: JSON body with an `error` field, appropriate status
 * code. Accepts EITHER the x-workspace-id / x-workspace-token headers OR a
 * session cookie plus membership of the workspace named by x-workspace-id.
 * Returns 401 if neither authenticates. The header path's behaviour and
 * response shape are unchanged from before accounts existed.
 */
export function withWorkspace<Context = unknown>(handler: WorkspaceRouteHandler<Context>) {
  return async (request: NextRequest, context: Context): Promise<NextResponse> => {
    const resolved = await resolveWorkspaceAuth(request);
    if (!resolved) {
      return NextResponse.json({ error: "Missing or invalid workspace credentials" }, { status: 401 });
    }
    return handler(request, resolved.workspace, context, resolved.actor);
  };
}
