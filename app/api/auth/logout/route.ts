import { NextRequest, NextResponse } from "next/server";
import { revokeSession } from "@/lib/repo/sessions";
import { clearSessionCookie, readSessionCookie } from "@/lib/auth/session-cookie";
import { serverError } from "@/lib/auth/helpers";

/**
 * POST /api/auth/logout - revokes the session SERVER-SIDE (deletes the
 * sessions row, not just the cookie) so the token cannot be replayed even
 * if it was captured before logout, then clears the cookie. Idempotent: a
 * request with no cookie, or one that does not match any live session,
 * still returns 200 - logging out is "make sure I am logged out", not "you
 * must currently be logged in".
 */
export async function POST(request: NextRequest) {
  try {
    const token = readSessionCookie(request);
    if (token) await revokeSession(token);
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response, request);
    return response;
  } catch (error) {
    return serverError("Logout error", error);
  }
}
