import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/repo/users";
import { createAuthToken } from "@/lib/repo/auth-tokens";
import { sendSimpleEmail } from "@/lib/email";
import { isValidEmail } from "@/lib/auth/validation";
import { badRequest, serverError, tooManyRequests } from "@/lib/auth/helpers";
import { checkRateLimit, getClientIp, UNKNOWN_IP } from "@/lib/rate-limit";

const APP_BASE_URL = (process.env.APP_BASE_URL || "https://fincrime.memaconsultants.com").replace(/\/$/, "");

const RESET_REQUEST_LIMIT = 6;
const RESET_REQUEST_WINDOW_MS = 60 * 60 * 1000;

/**
 * POST /api/auth/password-reset/request - body {email}. ALWAYS returns the
 * same 200 response regardless of whether the email has an account -
 * unlike signup's deliberate exception (see app/api/auth/signup/route.ts's
 * doc comment), a password-reset request is not the caller asserting an
 * email is theirs the way a signup submission is, and this endpoint is a
 * classic user-enumeration target (attacker submits candidate emails,
 * watches for a differing response to build a list of known accounts) -
 * there is no equivalent UX cost to genericity here the way there would be
 * for signup, so this one holds the line. If the email resolves to an
 * account, a single-use reset link is emailed; if not, nothing happens,
 * silently.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (ip !== UNKNOWN_IP) {
      const { allowed } = checkRateLimit(`auth-password-reset:${ip}`, RESET_REQUEST_LIMIT, RESET_REQUEST_WINDOW_MS);
      if (!allowed) return tooManyRequests("Too many reset requests from this address. Try again later.");
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

    const user = await getUserByEmail(b.email);
    if (user) {
      const { token } = await createAuthToken("password_reset", user.id);
      const resetUrl = `${APP_BASE_URL}/account/reset-password?token=${encodeURIComponent(token)}`;
      try {
        await sendSimpleEmail({
          to: user.email,
          subject: "Reset your password - FinCrime Control Lab",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
              <p style="color:#1e293b;">Someone requested a password reset for this account. If this was you:</p>
              <p><a href="${resetUrl}" style="display:inline-block;background:#14b8a6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Reset password</a></p>
              <p style="color:#64748b;font-size:13px;">This link expires in 30 minutes and can only be used once. If you did not request this, you can safely ignore this email - your password has not been changed.</p>
            </div>`,
        });
      } catch (error) {
        console.error("Password reset email error:", error);
      }
    }

    return NextResponse.json({ ok: true, message: "If an account exists for that email, a reset link has been sent." });
  } catch (error) {
    return serverError("Password reset request error", error);
  }
}
