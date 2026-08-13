import { NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session-cookie";
import { verifySession } from "@/lib/repo/sessions";
import { getMembership, getUserById, listWorkspaceMembers } from "@/lib/repo/users";
import { isUuid } from "@/lib/auth/validation";

/**
 * GET /api/workspace/members?workspaceId=... - session-authenticated,
 * membership-gated (same requireMember shape as
 * app/api/notifications/preferences/route.ts). Member listing/removal is
 * inherently account-scoped - there is no anonymous-header equivalent of
 * "who else can access this workspace," since the header-token path has no
 * concept of a distinct person at all.
 */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId") || "";
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

  const members = await listWorkspaceMembers(workspaceId);
  return NextResponse.json({
    members: members.map((m) => ({ userId: m.userId, email: m.email, role: m.role, createdAt: m.createdAt, isSelf: m.userId === user.id })),
  });
}
