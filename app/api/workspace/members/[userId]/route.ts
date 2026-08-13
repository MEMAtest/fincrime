import { NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session-cookie";
import { verifySession } from "@/lib/repo/sessions";
import { getMembership, getUserById, removeMember } from "@/lib/repo/users";
import { isUuid } from "@/lib/auth/validation";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

/**
 * DELETE /api/workspace/members/[userId]?workspaceId=... - owner-only. This
 * is the actual fix for "a claimed workspace can never be un-claimed": a
 * leaked token used to claim a workspace previously granted permanent,
 * unrevokable access with no path to remove it. Now the workspace's owner
 * can remove any member (including a claimer they did not authorise), which
 * immediately fails that user's session against THIS workspace on their
 * very next request (see lib/repo/users.ts's removeMember doc comment).
 * Refuses to remove the workspace's only owner (lib/repo/users.ts's
 * removeMember) - there is no invite flow yet to add a replacement, so that
 * would orphan the workspace with nobody able to administer it.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { userId: targetUserId } = await context.params;
  const workspaceId = request.nextUrl.searchParams.get("workspaceId") || "";
  if (!isUuid(workspaceId)) return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  if (!isUuid(targetUserId)) return NextResponse.json({ error: "Invalid member id" }, { status: 400 });

  const token = readSessionCookie(request);
  if (!token) return NextResponse.json({ error: "Sign in and select a workspace you own" }, { status: 401 });
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Sign in and select a workspace you own" }, { status: 401 });
  const requesterMembership = await getMembership(workspaceId, session.user_id);
  if (!requesterMembership) return NextResponse.json({ error: "Sign in and select a workspace you own" }, { status: 401 });
  const requester = await getUserById(session.user_id);
  if (!requester) return NextResponse.json({ error: "Sign in and select a workspace you own" }, { status: 401 });

  if (requesterMembership.role !== "owner") {
    return NextResponse.json({ error: "Only a workspace owner can remove a member" }, { status: 403 });
  }

  const result = await removeMember(workspaceId, targetUserId, requester.email);
  if (!result.ok) {
    if (result.reason === "not_found") return NextResponse.json({ error: "Member not found" }, { status: 404 });
    return NextResponse.json({ error: "Cannot remove the workspace's only owner" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
