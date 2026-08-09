import { NextResponse } from "next/server";

/**
 * Shared response helpers for app/api/workspace/actions/** and
 * app/api/workspace/conditions/**, mirroring the style already used by
 * lib/pra/helpers.ts and lib/control-changes/helpers.ts.
 */

/**
 * No identity exists yet (anonymous workspace only), so every mutation here
 * is attributed to this fixed actor string, matching the convention used
 * across app/api/pra/** and app/api/control-changes/**.
 */
export const ACTOR = "workspace";

export function notFound(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(context: string, error: unknown): NextResponse {
  console.error(`${context}:`, error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
