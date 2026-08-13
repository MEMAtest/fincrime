import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials, toPublicUser } from "@/lib/repo/users";
import { createSession } from "@/lib/repo/sessions";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { isValidEmail } from "@/lib/auth/validation";
import { badRequest, serverError, tooManyRequests, unauthorized, INVALID_CREDENTIALS_MESSAGE } from "@/lib/auth/helpers";
import { checkRateLimit, getClientIp, UNKNOWN_IP } from "@/lib/rate-limit";

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/**
 * POST /api/auth/login - body {email, password}. Sets a session cookie on
 * success. Every failure mode (unknown email, wrong password, malformed
 * input that still looks like an attempted login) returns the SAME generic
 * 401 message - never reveal whether an email has an account. Rate limited
 * per IP: this is the classic credential-stuffing target.
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

    const result = await verifyCredentials(b.email, b.password);
    if (!result.ok) return unauthorized(INVALID_CREDENTIALS_MESSAGE);

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
