import { NextRequest, NextResponse } from "next/server";
import { verifyWorkspace, type WorkspaceRow } from "@/lib/repo/workspace";
import { WORKSPACE_ID_HEADER, WORKSPACE_TOKEN_HEADER } from "@/lib/workspace-client";

/**
 * Reads the x-workspace-id / x-workspace-token headers from a request and
 * verifies them against the stored token hash. Returns the workspace row, or
 * null if the headers are missing or do not verify.
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

export type WorkspaceRouteHandler<Context = unknown> = (
  request: NextRequest,
  workspace: WorkspaceRow,
  context: Context
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a route handler with workspace header auth, matching the response
 * style of the rest of app/api: JSON body with an `error` field, appropriate
 * status code. Returns 401 if the x-workspace-id / x-workspace-token headers
 * are missing or do not verify against a workspace's token_hash.
 */
export function withWorkspace<Context = unknown>(handler: WorkspaceRouteHandler<Context>) {
  return async (request: NextRequest, context: Context): Promise<NextResponse> => {
    const workspace = await getAuthenticatedWorkspace(request);
    if (!workspace) {
      return NextResponse.json({ error: "Missing or invalid workspace credentials" }, { status: 401 });
    }
    return handler(request, workspace, context);
  };
}
