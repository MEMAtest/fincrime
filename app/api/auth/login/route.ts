import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials, toPublicUser } from "@/lib/repo/users";
import { createSession, revokeSession } from "@/lib/repo/sessions";
import { setSessionCookie, readSessionCookie } from "@/lib/auth/session-cookie";
import { isValidEmail, normalizeEmail } from "@/lib/auth/validation";
import { badRequest, serverError, tooManyRequests, unauthorized, INVALID_CREDENTIALS_MESSAGE } from "@/lib/auth/helpers";
import { checkRateLimit, getClientIp, UNKNOWN_IP } from "@/lib/rate-limit";

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// A SECOND bucket, keyed on the normalised email rather than the IP. The
// IP bucket above defends a single attacker hammering one IP; it does
// nothing against DISTRIBUTED credential stuffing - many source IPs, each
// well under the per-IP limit, all trying the same known/breached email.
// This bucket catches that shape regardless of how many IPs it is spread
// across. A higher limit than the IP bucket (this is shared across every
// legitimate device that email owns too - a family/team sharing one
// mailbox's password attempts should not lock out real users faster than a
// single attacker IP would trip its own limit).
const LOGIN_EMAIL_LIMIT = 20;
const LOGIN_EMAIL_WINDOW_MS = 15 * 60 * 1000;

/**
 * POST /api/auth/login - body {email, password}. Sets a session cookie on
 * success. Every failure mode (unknown email, wrong password, malformed
 * input that still looks like an attempted login) returns the SAME generic
 * 401 message - never reveal whether an email has an account. Rate limited
 * on TWO independent buckets: per IP (the classic credential-stuffing
 * target) and per normalised email (distributed credential stuffing against
 * one known/breached email, spread across many IPs to duck the IP bucket).
 * Either bucket tripping is sufficient to block the request.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (ip !== UNKNOWN_IP) {
      const { allowed } = checkRateLimit(`auth-login:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
      if (!allowed) return tooManyRequests("Too many login attempts from this address. Try again later.");
    }

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

    if (!isValidEmail(b.email) || typeof b.password !== "string" || !b.password) {
      // Still a generic 400 shape - not the login-specific 401 message,
      // since this is "you did not submit an email/password at all",
      // structurally distinct from "these credentials are wrong". It does
      // not reveal anything about any particular email.
      return badRequest("email and password are required");
    }

    const emailKey = `auth-login-email:${normalizeEmail(b.email)}`;
    const { allowed: emailAllowed } = checkRateLimit(emailKey, LOGIN_EMAIL_LIMIT, LOGIN_EMAIL_WINDOW_MS);
    if (!emailAllowed) return tooManyRequests("Too many login attempts for this account. Try again later.");

    const result = await verifyCredentials(b.email, b.password);
    if (!result.ok) return unauthorized(INVALID_CREDENTIALS_MESSAGE);

    // Revoke whatever session THIS BROWSER already had, server-side, before
    // minting the new one - a shared machine where A signs out by just
    // closing the tab (never clicking "Sign out") and B then signs in must
    // not leave A's 30-day session live and replayable. This revokes only
    // the cookie already presented on THIS request, never the new signed-in
    // user's OTHER sessions on other devices - "sign out everywhere" (POST
    // /api/auth/sessions/revoke-all) remains the only way to do that
    // deliberately.
    const priorToken = readSessionCookie(request);
    if (priorToken) await revokeSession(priorToken);

    const userAgent = request.headers.get("user-agent");
    const session = await createSession(result.user.id, result.user.email, {
      userAgent,
      ip: ip === UNKNOWN_IP ? null : ip,
    });

    const response = NextResponse.json({ user: toPublicUser(result.user) });
    setSessionCookie(response, request, session.token);
    return response;
  } catch (error) {
    return serverError("Login error", error);
  }
}
