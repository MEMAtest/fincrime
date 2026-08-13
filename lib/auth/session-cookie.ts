import type { NextRequest, NextResponse } from "next/server";

/**
 * The session cookie: httpOnly, Secure, SameSite=Lax - never localStorage.
 * Contrasts deliberately with the anonymous workspace credential (lib/
 * workspace-client.ts), which IS in localStorage because it must be
 * readable by client JS to build the x-workspace-* headers; a session
 * cookie is sent automatically by the browser and never needs JS to read
 * it, so it gets the stronger storage.
 */
export const SESSION_COOKIE_NAME = "fincrime_session";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days, matches lib/repo/sessions.ts's SESSION_TTL_MS

/**
 * Secure requires HTTPS; a browser silently refuses to store or send a
 * Secure cookie over plain http, which would break local dev/smoke testing
 * (http://localhost) if this were forced on unconditionally. `x-forwarded-proto`
 * is a CLIENT-SUPPLIED header in general (only Vercel's edge is trusted to
 * overwrite it in production) - trusting it on its own would let a request
 * sending `x-forwarded-proto: http` strip Secure from the cookie it gets
 * back, exactly the failure mode lib/rate-limit.ts's getClientIp() already
 * reasons about for x-forwarded-for. NODE_ENV === "production" is checked
 * FIRST and is authoritative when true (Vercel prod is always https, and
 * this value is not attacker-controlled); the header is only consulted as a
 * fallback so local dev over a self-signed https tunnel still gets Secure.
 */
function isHttps(request: NextRequest): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) return forwardedProto.split(",")[0]?.trim().toLowerCase() === "https";
  return request.nextUrl.protocol === "https:";
}

export function setSessionCookie(response: NextResponse, request: NextRequest, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps(request),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse, request: NextRequest): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isHttps(request),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function readSessionCookie(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
}
