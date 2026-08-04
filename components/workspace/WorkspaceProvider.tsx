"use client";

import { createContext, useCallback, useContext, useRef, useSyncExternalStore } from "react";
import {
  readStoredWorkspace,
  writeStoredWorkspace,
  workspaceAuthHeaders,
  WORKSPACE_STORAGE_KEY,
  type StoredWorkspace,
} from "@/lib/workspace-client";

interface WorkspaceContextValue {
  /** The current workspace id, or null until one exists (nothing is created on page load). */
  workspaceId: string | null;
  /** True once mounted on the client (the initial localStorage read has happened). */
  ready: boolean;
  /** Returns the workspace id, creating a new workspace (via bootstrap) on first use. */
  ensureWorkspace: () => Promise<string>;
  /** fetch() wrapper that calls ensureWorkspace() and adds the workspace auth headers. */
  wsFetch: (input: string, init?: RequestInit) => Promise<Response>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

// A minimal external store over the "fincrime-workspace" localStorage key, so
// reading it on mount does not need an effect + setState (which triggers a
// synchronous cascading re-render). Mirrors the useSyncExternalStore pattern
// already used by components/theme/ThemeProvider.tsx.
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
  const workspace = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(subscribe, alwaysTrue, alwaysFalse);
  const bootstrapPromise = useRef<Promise<string> | null>(null);

  const ensureWorkspace = useCallback(async (): Promise<string> => {
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
  }, []);

  const wsFetch = useCallback(
    async (input: string, init: RequestInit = {}): Promise<Response> => {
      await ensureWorkspace();
      const headers = new Headers(init.headers);
      for (const [key, value] of Object.entries(workspaceAuthHeaders(getSnapshot()))) {
        headers.set(key, value);
      }
      return fetch(input, { ...init, headers });
    },
    [ensureWorkspace]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        workspaceId: workspace?.id ?? null,
        ready,
        ensureWorkspace,
        wsFetch,
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
  ensureWorkspace: async () => {
    throw new Error(UNMOUNTED_ERROR);
  },
  wsFetch: async () => {
    throw new Error(UNMOUNTED_ERROR);
  },
};

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  return ctx ?? DEFAULT_CONTEXT;
}
