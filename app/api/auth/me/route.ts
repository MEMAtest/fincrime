import { NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session-cookie";
import { verifySession } from "@/lib/repo/sessions";
import { getUserById, listMembershipsForUser, toPublicUser } from "@/lib/repo/users";
import { getWorkspace, toWorkspaceSummary } from "@/lib/repo/workspace";

/**
 * GET /api/auth/me - the current session's user plus their workspaces with
 * roles. Returns { user: null } (200, not 401) when there is no valid
 * session - this endpoint is polled by the UI (e.g. the AppShell account
 * control) to decide whether to show "Sign in" or the user's email, which
 * is a normal state, not an error.
 */
export async function GET(request: NextRequest) {
  const token = readSessionCookie(request);
  if (!token) return NextResponse.json({ user: null, workspaces: [] });

  const session = await verifySession(token);
  if (!session) return NextResponse.json({ user: null, workspaces: [] });

  const user = await getUserById(session.user_id);
  if (!user) return NextResponse.json({ user: null, workspaces: [] });

  const memberships = await listMembershipsForUser(user.id);
  const workspaces = await Promise.all(
    memberships.map(async (m) => {
      const workspace = await getWorkspace(m.workspace_id);
      if (!workspace) return null;
      const summary = toWorkspaceSummary(workspace);
      return { ...summary, role: m.role };
    })
  );

  return NextResponse.json({
    user: toPublicUser(user),
    workspaces: workspaces.filter((w): w is NonNullable<typeof w> => w !== null),
  });
}
