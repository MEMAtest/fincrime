import { NextRequest, NextResponse } from "next/server";
import { consumeAuthToken } from "@/lib/repo/auth-tokens";
import { getUserById, setPasswordHash } from "@/lib/repo/users";
import { revokeAllSessionsForUser } from "@/lib/repo/sessions";
import { hashPassword } from "@/lib/auth/password";
import { isValidPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/validation";
import { badRequest, serverError } from "@/lib/auth/helpers";

/**
 * POST /api/auth/password-reset/confirm - body {token, password}. Consumes
 * the single-use reset token (atomic - see lib/repo/auth-tokens.ts's
 * consumeAuthToken), sets the new password, and revokes EVERY existing
 * session for the account. A password reset is the exact scenario "someone
 * else might already have a live session on this account" is most likely
 * true (that is often WHY the legitimate owner is resetting it - they
 * suspect the old password leaked) - leaving old sessions alive after a
 * reset would make the reset pointless as a security response.
 */
export async function POST(request: NextRequest) {
  try {
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

    if (typeof b.token !== "string" || !b.token) return badRequest("token is required");
    if (!isValidPassword(b.password)) {
      return badRequest(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const consumed = await consumeAuthToken("password_reset", b.token);
    if (!consumed) {
      // Same generic message whether the token is unknown, already used, or
      // expired - never distinguish these, for the same reason login never
      // distinguishes "unknown email" from "wrong password".
      return badRequest("This reset link is invalid or has expired. Request a new one.");
    }

    const user = await getUserById(consumed.userId);
    if (!user) return badRequest("This reset link is invalid or has expired. Request a new one.");

    const passwordHash = await hashPassword(b.password);
    await setPasswordHash(user.id, passwordHash, user.email);
    await revokeAllSessionsForUser(user.id, user.email);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError("Password reset confirm error", error);
  }
}
