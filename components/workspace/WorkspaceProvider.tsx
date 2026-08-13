"use client";

import { createContext, useCallback, useContext, useRef, useSyncExternalStore } from "react";
import {
  readStoredWorkspace,
  writeStoredWorkspace,
  workspaceAuthHeaders,
  WORKSPACE_STORAGE_KEY,
  WORKSPACE_ID_HEADER,
  type StoredWorkspace,
} from "@/lib/workspace-client";
import { useAccount } from "@/components/account/AccountProvider";
import { readActiveWorkspaceId, writeActiveWorkspaceId, ACTIVE_WORKSPACE_STORAGE_KEY } from "@/lib/auth-client";

export type WorkspaceMode = "anonymous" | "session";

interface WorkspaceContextValue {
  /** The current workspace id, or null until one exists (nothing is created on page load). */
  workspaceId: string | null;
  /** True once mounted on the client (the initial localStorage read has happened). */
  ready: boolean;
  /**
   * "session" when a signed-in account with at least one workspace is
   * driving the active workspace (via the session cookie, no header
   * token); "anonymous" when the browser's localStorage {id, token} pair
   * is driving it, exactly as before accounts existed. Anonymous stays the
   * default and the fallback: a signed-in account with zero workspaces
   * still resolves to "anonymous" so ensureWorkspace() keeps working for
   * "sign in, then save something for the first time".
   */
  mode: WorkspaceMode;
  /** Returns the workspace id, creating a new anonymous workspace (via bootstrap) on first use if in anonymous mode. In session mode, the selected workspace already exists, so this resolves immediately. */
  ensureWorkspace: () => Promise<string>;
  /** fetch() wrapper that calls ensureWorkspace() and adds the appropriate auth (workspace headers in anonymous mode; just x-workspace-id, relying on the session cookie, in session mode). */
  wsFetch: (input: string, init?: RequestInit) => Promise<Response>;
  /** Switches the active workspace among the signed-in account's memberships and persists the choice - no reload required. No-op if `id` is not one of the account's workspaces. */
  switchWorkspace: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

// A minimal external store over the "fincrime-workspace" localStorage key, so
// reading it on mount does not need an effect + setState (which triggers a
// synchronous cascading re-render). Mirrors the useSyncExternalStore pattern
// already used by components/theme/ThemeProvider.tsx. UNCHANGED from before
// accounts existed - this is exactly the anonymous-mode machinery.
type Listener = () => void;
const listeners = new Set<Listener>();

function notifyListeners(): void {
  for (const listener of listeners) listener();
}

function subscribe(callback: Listener): () => void {
  listeners.add(callback);
  if (typeof window === "undefined") {
    return () => listeners.delete(callback);
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === WORKSPACE_STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

// Cached so repeated getSnapshot() calls return a stable reference (required
// by useSyncExternalStore) until the underlying localStorage value changes.
let cachedRaw: string | null = null;
let cachedSnapshot: StoredWorkspace | null = null;

function getSnapshot(): StoredWorkspace | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSnapshot = readStoredWorkspace();
  }
  return cachedSnapshot;
}

function getServerSnapshot(): StoredWorkspace | null {
  return null;
}

const alwaysTrue = () => true;
const alwaysFalse = () => false;

// A second, equally minimal external store over the "which of my account's
// workspaces is active" localStorage key - same rationale as the anonymous
// store above (avoid an effect+setState cascade, and this doubles as the
// mechanism switchWorkspace() uses to notify without a reload: writing the
// key and calling notifyActiveListeners() re-renders every subscriber).
type ActiveListener = () => void;
const activeListeners = new Set<ActiveListener>();

function notifyActiveListeners(): void {
  for (const listener of activeListeners) listener();
}

function subscribeActive(callback: ActiveListener): () => void {
  activeListeners.add(callback);
  if (typeof window === "undefined") {
    return () => activeListeners.delete(callback);
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === ACTIVE_WORKSPACE_STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    activeListeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function getActiveSnapshot(): string | null {
  return readActiveWorkspaceId();
}

function getActiveServerSnapshot(): string | null {
  return null;
}

async function bootstrapWorkspace(): Promise<StoredWorkspace> {
  const response = await fetch("/api/workspace/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    throw new Error("Failed to create workspace");
  }
  const created: unknown = await response.json();
  if (
    !created ||
    typeof created !== "object" ||
    typeof (created as Record<string, unknown>).id !== "string" ||
    typeof (created as Record<string, unknown>).token !== "string"
  ) {
    throw new Error("Unexpected workspace bootstrap response");
  }
  return created as StoredWorkspace;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const anonymousWorkspace = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const anonymousReady = useSyncExternalStore(subscribe, alwaysTrue, alwaysFalse);
  const bootstrapPromise = useRef<Promise<string> | null>(null);

  const { status, workspaces: accountWorkspaces } = useAccount();

  // The account's selected workspace id, if any - same sync-external-store
  // pattern as the anonymous workspace above (null on the server, so no
  // hydration mismatch; updates on both storage events from other tabs and
  // switchWorkspace()'s own notifyActiveListeners() call, without a reload).
  const selectedWorkspaceId = useSyncExternalStore(subscribeActive, getActiveSnapshot, getActiveServerSnapshot);

  const sessionModeAvailable = status === "signed-in" && accountWorkspaces.length > 0;
  const effectiveSelectedId =
    selectedWorkspaceId && accountWorkspaces.some((w) => w.id === selectedWorkspaceId)
      ? selectedWorkspaceId
      : sessionModeAvailable
        ? accountWorkspaces[0].id
        : null;

  const mode: WorkspaceMode = sessionModeAvailable && effectiveSelectedId ? "session" : "anonymous";

  const switchWorkspace = useCallback(
    (id: string) => {
      if (!accountWorkspaces.some((w) => w.id === id)) return;
      writeActiveWorkspaceId(id);
      notifyActiveListeners();
    },
    [accountWorkspaces]
  );

  const ensureWorkspace = useCallback(async (): Promise<string> => {
    if (mode === "session" && effectiveSelectedId) return effectiveSelectedId;

    const current = getSnapshot();
    if (current) return current.id;

    if (bootstrapPromise.current) return bootstrapPromise.current;

    const promise = (async () => {
      const created = await bootstrapWorkspace();
      writeStoredWorkspace(created);
      cachedRaw = null; // force getSnapshot() to reparse on next read
      notifyListeners();
      return created.id;
    })();

    bootstrapPromise.current = promise;
    try {
      return await promise;
    } finally {
      bootstrapPromise.current = null;
    }
  }, [mode, effectiveSelectedId]);

  const wsFetch = useCallback(
    async (input: string, init: RequestInit = {}): Promise<Response> => {
      const id = await ensureWorkspace();
      const headers = new Headers(init.headers);
      if (mode === "session") {
        // No token header: the httpOnly session cookie authenticates the
        // request (sent automatically by the browser on a same-origin
        // fetch), and x-workspace-id names which of the account's
        // memberships to use - see withWorkspace's session path in
        // lib/workspace-auth.ts.
        headers.set(WORKSPACE_ID_HEADER, id);
      } else {
        for (const [key, value] of Object.entries(workspaceAuthHeaders(getSnapshot()))) {
          headers.set(key, value);
        }
      }
      return fetch(input, { ...init, headers });
    },
    [ensureWorkspace, mode]
  );

  const workspaceId = mode === "session" ? effectiveSelectedId : (anonymousWorkspace?.id ?? null);

  // Gated on BOTH the anonymous localStorage read having happened AND the
  // account status having resolved (GET /api/auth/me returned). Before this
  // fix, `ready` reflected only the anonymous mount flag, so a signed-in
  // user saw a flash of "not ready" (empty state) while /api/auth/me was
  // still in flight, and - if this browser also still held a stale
  // anonymous workspace credential - could briefly render THAT unrelated
  // workspace's data before `mode` flipped to "session", because
  // `anonymousReady` alone said "go ahead" before the account lookup that
  // determines `mode` had actually finished. Every consumer of `ready`
  // (list pages deciding whether to fetch yet) now waits for the mode
  // itself to be settled, which also removes the double-fetch a page
  // gated only on the anonymous flag would otherwise do: once for the
  // (possibly wrong) anonymous workspace, then again once session mode
  // resolved.
  const ready = anonymousReady && status !== "loading";

  return (
    <WorkspaceContext.Provider
      value={{
        workspaceId,
        ready,
        mode,
        ensureWorkspace,
        wsFetch,
        switchWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

const UNMOUNTED_ERROR = "WorkspaceProvider is not mounted";

const DEFAULT_CONTEXT: WorkspaceContextValue = {
  workspaceId: null,
  ready: false,
  mode: "anonymous",
  ensureWorkspace: async () => {
    throw new Error(UNMOUNTED_ERROR);
  },
  wsFetch: async () => {
    throw new Error(UNMOUNTED_ERROR);
  },
  switchWorkspace: () => {},
};

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  return ctx ?? DEFAULT_CONTEXT;
}
