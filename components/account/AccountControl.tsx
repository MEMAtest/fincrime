"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, LogOut, Save } from "lucide-react";
import { useAccount } from "@/components/account/AccountProvider";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";

/**
 * The small account control in AppShell's header: "Sign in" when signed
 * out, or the user's email with a dropdown when signed in. Never blocks
 * anonymous use and never nags - it is a quiet corner of the header, not a
 * banner. Deliberately does not fetch anything itself: it reads
 * useAccount()'s already-in-flight/resolved state, so it renders nothing
 * (not even "Sign in") until that first resolves, avoiding a flash of the
 * wrong state on every page load.
 */
export default function AccountControl() {
  const { status, user, signOut } = useAccount();
  const { mode, workspaceId } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (status === "loading") {
    return <div className="h-9 w-9 sm:w-24 rounded-lg" aria-hidden />;
  }

  if (status === "signed-out") {
    return (
      <Link
        href="/account/sign-in"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-text-muted hover:bg-surface-hover hover:text-foreground transition-colors"
      >
        <User className="h-4 w-4" />
        <span className="hidden sm:inline">Sign in</span>
      </Link>
    );
  }

  // signed-in: an anonymous, unclaimed workspace still active in this
  // browser is offered as a one-click "save to account" - never forced.
  const showSaveOffer = mode === "anonymous" && !!workspaceId;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-text-muted hover:bg-surface-hover hover:text-foreground transition-colors max-w-[10rem]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="h-6 w-6 rounded-full bg-accent/15 text-accent grid place-items-center text-[11px] font-semibold shrink-0">
          {user?.email?.[0]?.toUpperCase() ?? "?"}
        </span>
        <span className="hidden sm:inline truncate">{user?.email}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-surface-border bg-surface shadow-lg py-1.5 z-40"
        >
          {showSaveOffer && (
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3.5 py-2 text-sm text-accent hover:bg-surface-hover transition-colors"
            >
              <Save className="h-4 w-4" />
              Save this workspace to your account
            </Link>
          )}
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3.5 py-2 text-sm text-foreground hover:bg-surface-hover transition-colors"
          >
            <User className="h-4 w-4" />
            My account
          </Link>
          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              await signOut();
              router.refresh();
            }}
            className="flex w-full items-center gap-2 px-3.5 py-2 text-sm text-text-muted hover:bg-surface-hover hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
