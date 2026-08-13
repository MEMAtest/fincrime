"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, LogOut, Save, ShieldCheck, User } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useAccount } from "@/components/account/AccountProvider";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { claimWorkspaceRequest } from "@/lib/auth-client";
import { readStoredWorkspace } from "@/lib/workspace-client";

export default function AccountPage() {
  const { status, user, workspaces, refresh, signOut } = useAccount();
  const { mode, workspaceId, switchWorkspace } = useWorkspace();
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const router = useRouter();

  if (status === "loading") {
    return (
      <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "Account" }]}>
        <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-12 text-sm text-text-muted">Loading...</div>
      </ToolFrame>
    );
  }

  if (status === "signed-out") {
    return (
      <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "Account" }]}>
        <div className="max-w-md mx-auto w-full px-4 sm:px-6 py-12 text-center space-y-4">
          <ToolPageHeader eyebrow="ACCOUNT" title="You are not" titleAccent="signed in" />
          <div className="flex items-center justify-center gap-3">
            <Link href="/account/sign-in"><Button>Sign in</Button></Link>
            <Link href="/account/sign-up"><Button variant="secondary">Create account</Button></Link>
          </div>
        </div>
      </ToolFrame>
    );
  }

  const showClaimOffer = mode === "anonymous" && !!workspaceId;

  const handleClaim = async () => {
    setClaiming(true);
    setClaimError(null);
    const stored = readStoredWorkspace();
    if (!stored) {
      setClaimError("No workspace found in this browser to save.");
      setClaiming(false);
      return;
    }
    const result = await claimWorkspaceRequest(stored.id, stored.token);
    setClaiming(false);
    if ("error" in result) {
      setClaimError(result.error);
      return;
    }
    await refresh();
    switchWorkspace(stored.id);
  };

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "Account" }]}>
      <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 py-12 space-y-6">
        <ToolPageHeader eyebrow="ACCOUNT" title="My" titleAccent="account" subtitle={user?.email ?? undefined} />

        {showClaimOffer && (
          <div className="glass-card rounded-2xl p-6 space-y-3 border border-accent/30">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-accent/10 text-accent grid place-items-center shrink-0">
                <Save className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Save this browser&apos;s workspace</h2>
                <p className="text-sm text-text-muted mt-0.5">
                  This browser has an existing workspace that is not yet linked to your account. Save it so it
                  survives losing this browser.
                </p>
              </div>
            </div>
            {claimError && <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{claimError}</p>}
            <Button onClick={handleClaim} disabled={claiming} size="sm">
              {claiming ? "Saving..." : "Save this workspace to your account"}
            </Button>
          </div>
        )}

        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-accent/10 text-accent grid place-items-center shrink-0">
              <Building2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Your workspaces</h2>
              <p className="text-sm text-text-muted mt-0.5">
                {workspaces.length === 0 ? "No workspaces yet." : "Switch the active workspace without reloading."}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {workspaces.map((w) => {
              const isActive = mode === "session" && w.id === workspaceId;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => switchWorkspace(w.id)}
                  className={`w-full flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                    isActive ? "border-accent bg-accent/5" : "border-surface-border hover:bg-surface-hover"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{w.name || w.id}</p>
                    <p className="text-xs text-text-muted">{w.ownerEmail || "No owner email set"}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={w.role === "owner" ? "success" : "default"}>{w.role}</Badge>
                    {isActive && <Badge variant="info">Active</Badge>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-accent/10 text-accent grid place-items-center shrink-0">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Security</h2>
              <p className="text-sm text-text-muted mt-0.5">Sign out of this browser, or every device at once.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await signOut();
                router.push("/");
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={signingOutAll}
              onClick={async () => {
                setSigningOutAll(true);
                await fetch("/api/auth/sessions/revoke-all", { method: "POST" });
                setSigningOutAll(false);
                await signOut();
                router.push("/");
              }}
            >
              <User className="h-4 w-4" />
              {signingOutAll ? "Signing out everywhere..." : "Sign out everywhere"}
            </Button>
          </div>
        </div>
      </div>
    </ToolFrame>
  );
}
