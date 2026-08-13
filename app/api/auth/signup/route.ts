import { NextRequest, NextResponse } from "next/server";
import { createUser, claimWorkspace, toPublicUser } from "@/lib/repo/users";
import { createSession } from "@/lib/repo/sessions";
import { getAuthenticatedWorkspace } from "@/lib/workspace-auth";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { isValidEmail, isValidPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/validation";
import { badRequest, conflict, serverError, tooManyRequests } from "@/lib/auth/helpers";
import { checkRateLimit, getClientIp, UNKNOWN_IP } from "@/lib/rate-limit";

const SIGNUP_LIMIT = 8;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;

/**
 * POST /api/auth/signup - body {email, password}. Creates an account,
 * signs it in immediately (session cookie set on the response), and - if
 * the request also carries a valid x-workspace-id / x-workspace-token pair
 * for an existing anonymous workspace (the browser's current one) - claims
 * that workspace into the new account in the same call, so a user's
 * existing work survives losing the browser. If there is no anonymous
 * workspace on the browser, signup just creates the account; the new
 * account has zero workspaces until one is created or another is claimed.
 * Rate limited per IP: signup writes a DB row with only an email/password,
 * the same abuse shape as workspace bootstrap.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (ip !== UNKNOWN_IP) {
      const { allowed } = checkRateLimit(`auth-signup:${ip}`, SIGNUP_LIMIT, SIGNUP_WINDOW_MS);
      if (!allowed) return tooManyRequests("Too many signup attempts from this address. Try again later.");
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

    if (!isValidEmail(b.email)) return badRequest("email must be a valid email address");
    if (!isValidPassword(b.password)) {
      return badRequest(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const created = await createUser(b.email, b.password);
    if (!created.ok) {
      // Deliberately not "invalid email or password"-style genericity here:
      // signup MUST tell the caller their own submission failed (they typed
      // an email that is already an account) to be usable at all - that is
      // a different property from login's "does not reveal whether the
      // email exists", which protects against probing OTHER people's
      // emails. A signup attempt is inherently the caller asserting an
      // email is theirs; confirming it is taken does not leak anything an
      // attacker could not already learn by attempting to log in and
      // reading the (generic) failure, except stated plainly at the point
      // it is actionable.
      return conflict("An account with this email already exists");
    }

    const userAgent = request.headers.get("user-agent");
    const session = await createSession(created.user.id, created.user.email, { userAgent, ip: ip === UNKNOWN_IP ? null : ip });

    let claimedWorkspaceId: string | null = null;
    const anonymousWorkspace = await getAuthenticatedWorkspace(request);
    if (anonymousWorkspace) {
      const claimResult = await claimWorkspace(anonymousWorkspace.id, created.user.id, created.user.email);
      if (claimResult.ok) claimedWorkspaceId = anonymousWorkspace.id;
    }

    const response = NextResponse.json(
      { user: toPublicUser(created.user), claimedWorkspaceId },
      { status: 201 }
    );
    setSessionCookie(response, request, session.token);
    return response;
  } catch (error) {
    return serverError("Signup error", error);
  }
}
