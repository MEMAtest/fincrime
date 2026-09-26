import { NextRequest, NextResponse } from "next/server";
import {
  checkAccessKey,
  cleanLabel,
  issueDrafterToken,
  DRAFTER_COOKIE_NAME,
  DRAFTER_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/drafter/access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/drafter-unlock - body {key, name}. Exchanges the PRA Drafter
 * access key for a signed httpOnly cookie. Lives outside app/api/drafter/**
 * on purpose: it is the one drafter endpoint reachable without the cookie.
 * A wrong key gets the same 404 as every other drafter route.
 *
 * DELETE /api/drafter-unlock - clears the cookie (lock this browser).
 */

const UNLOCK_LIMIT = 10;
const UNLOCK_WINDOW_MS = 15 * 60 * 1000;

function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(request: NextRequest) {
  const { allowed } = checkRateLimit(`drafter-unlock:${getClientIp(request)}`, UNLOCK_LIMIT, UNLOCK_WINDOW_MS);
  if (!allowed) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });

  let body: { key?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return notFound();
  }
  if (!checkAccessKey(body.key)) return notFound();

  const token = issueDrafterToken(cleanLabel(body.name));
  if (!token) return notFound();

  const response = NextResponse.json({ ok: true });
  response.cookies.set(DRAFTER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: DRAFTER_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DRAFTER_COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
