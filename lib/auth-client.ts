/**
 * Client-side helpers for the account/session layer - the httpOnly session
 * cookie itself is never touched from JS (that is the point of httpOnly);
 * what lives here is (a) fetch wrappers for the app/api/auth/** endpoints
 * and (b) the ONE piece of session-related state that does live in
 * localStorage: which of the signed-in account's workspaces is currently
 * active in this browser tab. That is a UI preference, not a credential -
 * unlike lib/workspace-client.ts's {id, token} pair, losing or tampering
 * with it grants no access (access is still checked server-side against
 * workspace_members on every request).
 */

export const ACTIVE_WORKSPACE_STORAGE_KEY = "fincrime-active-workspace-id";

export interface AccountUser {
  id: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AccountWorkspace {
  id: string;
  name: string | null;
  ownerEmail: string | null;
  createdAt: string;
  role: "owner" | "member";
}

export interface MeResponse {
  user: AccountUser | null;
  workspaces: AccountWorkspace[];
}

export function readActiveWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeActiveWorkspaceId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, id);
  } catch {
    // localStorage unavailable
  }
}

export function clearActiveWorkspaceId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
}

export async function fetchMe(): Promise<MeResponse> {
  const response = await fetch("/api/auth/me", { cache: "no-store" });
  if (!response.ok) return { user: null, workspaces: [] };
  const data: unknown = await response.json();
  if (!data || typeof data !== "object") return { user: null, workspaces: [] };
  return data as MeResponse;
}

export interface AuthFailure {
  error: string;
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function signUp(email: string, password: string): Promise<{ ok: true } | AuthFailure> {
  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const body = await parseJson(response);
    const error = body && typeof body === "object" && typeof (body as Record<string, unknown>).error === "string"
      ? (body as Record<string, unknown>).error as string
      : "Sign up failed";
    return { error };
  }
  return { ok: true };
}

export async function signIn(email: string, password: string): Promise<{ ok: true } | AuthFailure> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const body = await parseJson(response);
    const error = body && typeof body === "object" && typeof (body as Record<string, unknown>).error === "string"
      ? (body as Record<string, unknown>).error as string
      : "Sign in failed";
    return { error };
  }
  return { ok: true };
}

export async function signOutRequest(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

export type ClaimWorkspaceOutcome = { ok: true } | { pending: true; message: string } | AuthFailure;

/**
 * A 202 here means the claim was DEFERRED behind an emailed confirmation
 * link (see app/api/auth/claim-workspace/route.ts and
 * lib/auth/claim-flow.ts) - `response.ok` is true for 202 same as 201, so
 * the caller must inspect the body to tell "claimed immediately" apart from
 * "check the workspace owner's inbox", rather than treating any 2xx as an
 * immediate grant of access.
 */
export async function claimWorkspaceRequest(workspaceId: string, workspaceToken: string): Promise<ClaimWorkspaceOutcome> {
  const response = await fetch("/api/auth/claim-workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId, workspaceToken }),
  });
  const body = await parseJson(response);
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  if (!response.ok) {
    const error = typeof b.error === "string" ? b.error : "Could not save this workspace to your account";
    return { error };
  }
  if (response.status === 202 && b.pending) {
    const message = typeof b.message === "string" ? b.message : "Check the workspace owner's inbox to confirm access.";
    return { pending: true, message };
  }
  return { ok: true };
}
