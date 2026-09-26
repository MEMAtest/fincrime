import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";

/**
 * PRA Drafter is a private module (see docs/pra-drafter/BUILD-DECISIONS.md
 * "Private"). There are no accounts: access is granted by a shared access key
 * held in the PRA_DRAFTER_ACCESS_KEY env var. Entering it on /drafter/unlock
 * sets a signed, httpOnly cookie. Unset or short key = nobody has access.
 *
 * The cookie is HMAC-signed with a key derived from the access key, so
 * rotating PRA_DRAFTER_ACCESS_KEY revokes every issued cookie at once.
 * Neither the anonymous workspace token nor an account session is consulted.
 *
 * Unauthorised requests get 404, not 401/403, so the module's existence is
 * not revealed.
 */

export const DRAFTER_COOKIE_NAME = "fincrime_drafter";
export const DRAFTER_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const MIN_KEY_LENGTH = 24;
const MAX_LABEL_LENGTH = 60;

export interface DrafterActor {
  userId: string;
  /** Who is acting, for the audit trail: the name entered at unlock. */
  email: string;
}

function accessKey(): string | null {
  const key = (process.env.PRA_DRAFTER_ACCESS_KEY || "").trim();
  return key.length >= MIN_KEY_LENGTH ? key : null;
}

function signingKey(key: string): Buffer {
  return createHash("sha256").update(`pra-drafter-cookie:${key}`).digest();
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", signingKey(key)).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Strips anything but plain name characters so the label is safe to store and display. */
export function cleanLabel(raw: unknown): string {
  const text = typeof raw === "string" ? raw : "";
  const cleaned = text.replace(/[^\p{L}\p{N} .'@_-]/gu, "").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, MAX_LABEL_LENGTH) || "Drafter user";
}

/** True when the submitted key matches PRA_DRAFTER_ACCESS_KEY (constant time). */
export function checkAccessKey(submitted: unknown): boolean {
  const key = accessKey();
  if (!key || typeof submitted !== "string" || !submitted) return false;
  return safeEqual(submitted.trim(), key);
}

/** Builds the cookie value: base64url(label).expiresAt.signature */
export function issueDrafterToken(label: string, nowMs: number = Date.now()): string | null {
  const key = accessKey();
  if (!key) return null;
  const expiresAt = Math.floor(nowMs / 1000) + DRAFTER_COOKIE_MAX_AGE_SECONDS;
  const payload = `${Buffer.from(cleanLabel(label)).toString("base64url")}.${expiresAt}`;
  return `${payload}.${sign(payload, key)}`;
}

/**
 * Resolves a drafter cookie value to an actor, or null when it is missing,
 * malformed, expired, or signed with a different (e.g. rotated) key.
 */
export function resolveDrafterActor(token: string | null | undefined, nowMs: number = Date.now()): DrafterActor | null {
  const key = accessKey();
  if (!key || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [labelPart, expiresPart, signature] = parts;
  const payload = `${labelPart}.${expiresPart}`;
  if (!safeEqual(signature, sign(payload, key))) return null;
  const expiresAt = Number(expiresPart);
  if (!Number.isInteger(expiresAt) || expiresAt * 1000 <= nowMs) return null;
  let label: string;
  try {
    label = cleanLabel(Buffer.from(labelPart, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  return { userId: "access-key", email: label };
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
  const actor = resolveDrafterActor(request.cookies.get(DRAFTER_COOKIE_NAME)?.value);
  if (!actor) {
    return { response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { actor };
}

/**
 * For server-component pages under app/drafter/**. Calls notFound() when
 * the request carries no valid drafter cookie - callers should NOT catch it.
 */
export async function requireDrafterActorPage(): Promise<DrafterActor> {
  const store = await cookies();
  const actor = resolveDrafterActor(store.get(DRAFTER_COOKIE_NAME)?.value);
  if (!actor) {
    notFound();
  }
  return actor as DrafterActor;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Route id params that are not UUIDs are treated as not found. Without this
 * a malformed id reaches Postgres and surfaces as a 500 instead of a 404.
 */
export function invalidDrafterIds(...ids: string[]): NextResponse | null {
  return ids.every((id) => UUID_RE.test(id)) ? null : NextResponse.json({ error: "Not found" }, { status: 404 });
}
