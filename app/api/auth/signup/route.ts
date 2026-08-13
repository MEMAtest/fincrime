import { NextRequest, NextResponse } from "next/server";
import { createUser, toPublicUser } from "@/lib/repo/users";
import { createSession } from "@/lib/repo/sessions";
import { createAuthToken } from "@/lib/repo/auth-tokens";
import { getAuthenticatedWorkspace } from "@/lib/workspace-auth";
import { attemptClaimWorkspace } from "@/lib/auth/claim-flow";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { isValidEmail, isValidPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/validation";
import { badRequest, conflict, serverError, tooManyRequests } from "@/lib/auth/helpers";
import { checkRateLimit, getClientIp, UNKNOWN_IP } from "@/lib/rate-limit";
import { sendSimpleEmail } from "@/lib/email";

const APP_BASE_URL = (process.env.APP_BASE_URL || "https://fincrime.memaconsultants.com").replace(/\/$/, "");

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
      // emails. Honest trade-off, not a non-leak: this DOES confirm the
      // email has an account, to anyone who tries signing up with it - the
      // review measured login's own generic-401 timing as flat, so this is
      // NOT covered by "an attacker could already learn it from login's
      // response" (that claim was wrong; login reveals nothing). We accept
      // the leak here anyway because a usable signup form has no honest way
      // to hide it (silently no-op-ing on a duplicate email one, and
      // "check your inbox" for the wrong account is a worse and confusing
      // UX for the far more common case of someone who simply forgot they
      // already had an account) - this is a deliberate, scoped exception to
      // the enumeration-resistance rule login/password-reset both hold to,
      // not evidence the codebase is inconsistent about it.
      return conflict("An account with this email already exists");
    }

    // Email verification: best-effort, non-blocking, and never gates
    // anything - the account is fully usable (session minted below) whether
    // or not this link is ever clicked. It exists so users.email_verified_at
    // is not a column nothing writes (see migration 010's doc comment), and
    // so a typo'd signup email is at least visibly unconfirmed rather than
    // silently trusted forever.
    try {
      const { token: verifyToken } = await createAuthToken("email_verification", created.user.id);
      const verifyUrl = `${APP_BASE_URL}/api/auth/verify-email?token=${encodeURIComponent(verifyToken)}`;
      await sendSimpleEmail({
        to: created.user.email,
        subject: "Verify your email - FinCrime Control Lab",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <p style="color:#1e293b;">Confirm this is your email address:</p>
            <p><a href="${verifyUrl}" style="display:inline-block;background:#14b8a6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Verify email</a></p>
            <p style="color:#64748b;font-size:13px;">If you did not create this account, you can ignore this email.</p>
          </div>`,
      });
    } catch (error) {
      console.error("Signup verification email error:", error);
    }

    const userAgent = request.headers.get("user-agent");
    const session = await createSession(created.user.id, created.user.email, { userAgent, ip: ip === UNKNOWN_IP ? null : ip });

    // Auto-claim the browser's current anonymous workspace, if any, into the
    // brand-new account - routed through attemptClaimWorkspace (see
    // lib/auth/claim-flow.ts) rather than calling claimWorkspace directly,
    // so a workspace with an owner_email already set still gets the SAME
    // confirmation-link gate here as the explicit claim-workspace route -
    // otherwise this would be a bypass for exactly the attack that gate
    // exists to stop (a stolen token turned into an account claim, just by
    // signing up a fresh account with it instead of "claiming" with an
    // existing one).
    let claimedWorkspaceId: string | null = null;
    let claimPending = false;
    const anonymousWorkspace = await getAuthenticatedWorkspace(request);
    if (anonymousWorkspace) {
      const claimResult = await attemptClaimWorkspace(anonymousWorkspace, created.user.id, created.user.email);
      if (claimResult.kind === "claimed") claimedWorkspaceId = anonymousWorkspace.id;
      else if (claimResult.kind === "pending") claimPending = true;
    }

    const response = NextResponse.json(
      { user: toPublicUser(created.user), claimedWorkspaceId, claimPending },
      { status: 201 }
    );
    setSessionCookie(response, request, session.token);
    return response;
  } catch (error) {
    return serverError("Signup error", error);
  }
}
