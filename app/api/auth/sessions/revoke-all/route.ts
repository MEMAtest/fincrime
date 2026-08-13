import { NextRequest, NextResponse } from "next/server";
import { readSessionCookie, clearSessionCookie } from "@/lib/auth/session-cookie";
import { verifySession, revokeAllSessionsForUser } from "@/lib/repo/sessions";
import { getUserById } from "@/lib/repo/users";
import { serverError, unauthorized } from "@/lib/auth/helpers";

/**
 * POST /api/auth/sessions/revoke-all - "sign out everywhere": revokes every
 * session row for the calling user (not just this browser's), then clears
 * this browser's cookie too, so the device that requested it also ends up
 * signed out.
 */
export async function POST(request: NextRequest) {
  try {
    const token = readSessionCookie(request);
    if (!token) return unauthorized("Sign in required");
    const session = await verifySession(token);
    if (!session) return unauthorized("Sign in required");
    const user = await getUserById(session.user_id);
    if (!user) return unauthorized("Sign in required");

    const count = await revokeAllSessionsForUser(user.id, user.email);

    const response = NextResponse.json({ ok: true, revoked: count });
    clearSessionCookie(response, request);
    return response;
  } catch (error) {
    return serverError("Revoke all sessions error", error);
  }
}
