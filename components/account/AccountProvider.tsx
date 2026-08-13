"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchMe, signOutRequest, clearActiveWorkspaceId, type AccountUser, type AccountWorkspace } from "@/lib/auth-client";

export type AccountStatus = "loading" | "signed-out" | "signed-in";

interface AccountContextValue {
  status: AccountStatus;
  user: AccountUser | null;
  workspaces: AccountWorkspace[];
  /** Re-fetches /api/auth/me - call after signup, login, or claiming a workspace so the UI reflects it immediately. */
  refresh: () => Promise<void>;
  /** Revokes the session server-side, clears local session-workspace state, and refreshes to signed-out. */
  signOut: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | undefined>(undefined);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AccountStatus>("loading");
  const [user, setUser] = useState<AccountUser | null>(null);
  const [workspaces, setWorkspaces] = useState<AccountWorkspace[]>([]);

  const refresh = useCallback(async () => {
    const me = await fetchMe();
    setUser(me.user);
    setWorkspaces(me.workspaces);
    setStatus(me.user ? "signed-in" : "signed-out");
  }, []);

  // A cancelled-flag async IIFE rather than calling refresh() directly, so
  // setState only ever happens after the await (never synchronously in the
  // effect body) - matches the mount-fetch pattern already used by e.g.
  // app/govern/settings/page.tsx, and avoids a stale-closure update after
  // unmount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await fetchMe();
      if (cancelled) return;
      setUser(me.user);
      setWorkspaces(me.workspaces);
      setStatus(me.user ? "signed-in" : "signed-out");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    await signOutRequest();
    clearActiveWorkspaceId();
    setUser(null);
    setWorkspaces([]);
    setStatus("signed-out");
  }, []);

  return (
    <AccountContext.Provider value={{ status, user, workspaces, refresh, signOut }}>
      {children}
    </AccountContext.Provider>
  );
}

const DEFAULT_CONTEXT: AccountContextValue = {
  status: "loading",
  user: null,
  workspaces: [],
  refresh: async () => {},
  signOut: async () => {},
};

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  return ctx ?? DEFAULT_CONTEXT;
}
