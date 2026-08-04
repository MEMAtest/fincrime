/**
 * localStorage read/write helpers for the anonymous workspace credential
 * ({id, token} pair). Plain functions (no React) so both the WorkspaceProvider
 * and any non-React code (e.g. a bridge from a free tool) can use them.
 */

export const WORKSPACE_STORAGE_KEY = "fincrime-workspace";
export const WORKSPACE_ID_HEADER = "x-workspace-id";
export const WORKSPACE_TOKEN_HEADER = "x-workspace-token";

export interface StoredWorkspace {
  id: string;
  token: string;
}

function isStoredWorkspace(value: unknown): value is StoredWorkspace {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.token === "string";
}

/** Reads the stored workspace credential, or null if absent, unparseable, or on the server. */
export function readStoredWorkspace(): StoredWorkspace | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredWorkspace(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStoredWorkspace(workspace: StoredWorkspace): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.)
  }
}

export function clearStoredWorkspace(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
}

/** Builds the two auth headers for a stored workspace, or an empty object if absent. */
export function workspaceAuthHeaders(workspace: StoredWorkspace | null): Record<string, string> {
  if (!workspace) return {};
  return {
    [WORKSPACE_ID_HEADER]: workspace.id,
    [WORKSPACE_TOKEN_HEADER]: workspace.token,
  };
}
