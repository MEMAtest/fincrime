import { NextRequest, NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session-cookie";
import { verifySession } from "@/lib/repo/sessions";
import { getMembership, getUserById } from "@/lib/repo/users";
import { isUuid } from "@/lib/auth/validation";
import { getOrCreatePreferences, updatePreferences } from "@/lib/repo/notifications";
import { validateFrequency, validateCategoriesPatch } from "@/lib/notifications/validation";
import type { NotificationCategories, NotificationFrequency } from "@/lib/notifications/digest";

interface AuthedContext {
  userId: string;
  actor: string;
}

/**
 * Resolves the request to a signed-in user via the session cookie only (no
 * anonymous header path here - notification preferences are inherently
 * account-scoped, unlike most of app/api which also serves the anonymous
 * workspace-token path). Also requires the caller to be a member of the
 * workspace named by the `workspaceId` query param / body field, exactly
 * like resolveWorkspaceAuth's session branch in lib/workspace-auth.ts.
 */
async function requireMember(request: NextRequest, workspaceId: string): Promise<AuthedContext | null> {
  if (!isUuid(workspaceId)) return null;
  const token = readSessionCookie(request);
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  const membership = await getMembership(workspaceId, session.user_id);
  if (!membership) return null;
  const user = await getUserById(session.user_id);
  if (!user) return null;
  return { userId: user.id, actor: user.email };
}

/** GET /api/notifications/preferences?workspaceId=... - session-authenticated. */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId") || "";
  const auth = await requireMember(request, workspaceId);
  if (!auth) {
    return NextResponse.json({ error: "Sign in and select a workspace you are a member of" }, { status: 401 });
  }

  const preference = await getOrCreatePreferences(auth.userId, workspaceId);
  return NextResponse.json({
    frequency: preference.frequency,
    categories: preference.categories,
  });
}

/** PATCH /api/notifications/preferences - body {workspaceId, frequency?, categories?}. Session-authenticated. */
export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const workspaceId = typeof b.workspaceId === "string" ? b.workspaceId : "";

  const auth = await requireMember(request, workspaceId);
  if (!auth) {
    return NextResponse.json({ error: "Sign in and select a workspace you are a member of" }, { status: 401 });
  }

  const patch: { frequency?: NotificationFrequency; categories?: NotificationCategories } = {};

  if ("frequency" in b) {
    const result = validateFrequency(b.frequency);
    if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
    patch.frequency = result.value;
  }

  if ("categories" in b) {
    const result = validateCategoriesPatch(b.categories);
    if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
    const current = await getOrCreatePreferences(auth.userId, workspaceId);
    patch.categories = { ...current.categories, ...result.value };
  }

  const updated = await updatePreferences(auth.userId, workspaceId, patch, auth.actor);
  return NextResponse.json({
    frequency: updated.frequency,
    categories: updated.categories,
  });
}
