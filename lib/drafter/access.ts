import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { readSessionCookie } from "@/lib/auth/session-cookie";
import { verifySession } from "@/lib/repo/sessions";
import { getUserById } from "@/lib/repo/users";

/**
 * PRA Drafter is a private module (see docs/pra-drafter/BUILD-DECISIONS.md
 * "Private"). Access requires a signed-in account session whose email is in
 * PRA_DRAFTER_ALLOWED_EMAILS (comma-separated, case-insensitive, trimmed).
 * The anonymous workspace token path (lib/workspace-auth.ts) is NEVER
 * consulted here - it must not be able to grant access to this module.
 *
 * Unauthorised requests get 404, not 401/403, so the module's existence is
 * not revealed to anyone who is not allowlisted.
 */

function allowedEmails(): Set<string> {
  const raw = process.env.PRA_DRAFTER_ALLOWED_EMAILS || "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export interface DrafterActor {
  userId: string;
  email: string;
}

/**
 * Resolves the request's session to a DrafterActor if (a) a valid session
 * cookie is present, (b) it resolves to a real user, and (c) that user's
 * email is in PRA_DRAFTER_ALLOWED_EMAILS. Returns null otherwise - callers
 * must treat null as "does not exist" (404), never leak WHY access failed.
 */
export async function resolveDrafterActor(token: string | null): Promise<DrafterActor | null> {
  if (!token) return null;
  const allowed = allowedEmails();
  if (allowed.size === 0) return null;

  const session = await verifySession(token);
  if (!session) return null;

  const user = await getUserById(session.user_id);
  if (!user) return null;

  if (!allowed.has(user.email.trim().toLowerCase())) return null;

  // Signup does not prove mailbox ownership, so an unverified account could
  // claim an allowlisted address before its owner registers. Only a verified
  // email counts.
  if (!user.email_verified_at) return null;

  return { userId: user.id, email: user.email };
}

/**
 * For API routes (app/api/drafter/**). Every route handler must call this
 * FIRST and return its 404 response verbatim when actor is null - see the
 * unit test in lib/drafter/__tests__/access.test.ts that greps every route
 * file for a call to this function.
 */
export async function requireDrafterActorApi(
  request: NextRequest
): Promise<{ actor: DrafterActor } | { response: NextResponse }> {
  const token = readSessionCookie(request);
  const actor = await resolveDrafterActor(token);
  if (!actor) {
    return { response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { actor };
}

/**
 * For server-component pages under app/drafter/**. Calls next/navigation's
 * notFound() (renders the app's normal 404 page) when the signed-in user is
 * not allowlisted, or throws via notFound() - callers should NOT catch this.
 */
export async function requireDrafterActorPage(): Promise<DrafterActor> {
  const store = await cookies();
  const token = store.get(readSessionCookieName())?.value ?? null;
  const actor = await resolveDrafterActor(token);
  if (!actor) {
    notFound();
  }
  return actor as DrafterActor;
}

function readSessionCookieName(): string {
  // Keep in sync with lib/auth/session-cookie.ts's SESSION_COOKIE_NAME
  // without importing a NextRequest-typed helper into a cookies()-based path.
  return "fincrime_session";
}

/**
 * For the AppShell nav entry and any lightweight "am I allowed" check from
 * the client (e.g. /api/drafter/me). Same allow rule as the guards above,
 * exposed as a boolean so the UI can hide the nav entry for everyone else.
 */
export async function isDrafterAllowedEmail(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  return allowedEmails().has(email.trim().toLowerCase());
}
