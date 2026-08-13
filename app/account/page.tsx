"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, LogOut, Mail, Save, ShieldCheck, Trash2, User, Users } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useAccount } from "@/components/account/AccountProvider";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { claimWorkspaceRequest } from "@/lib/auth-client";
import { readStoredWorkspace } from "@/lib/workspace-client";

interface WorkspaceMember {
  userId: string;
  email: string;
  role: "owner" | "member";
  createdAt: string;
  isSelf: boolean;
}

/** GET/DELETE the member list for the active session workspace - see app/api/workspace/members/**, the fix for "a claimed workspace can never be un-claimed" (a leaked token that got claimed can now be removed by the workspace's owner). */
function MembersPanel({ workspaceId, isOwner }: { workspaceId: string; isOwner: boolean }) {
  const [members, setMembers] = useState<WorkspaceMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  // Cancelled-flag async fetch (matches components/account/AccountProvider.tsx's
  // mount-fetch pattern) - setState only ever happens after the await, never
  // synchronously in the effect body. The parent renders this component with
  // `key={workspaceId}` (see below), so switching the active workspace
  // remounts it fresh (members starts at null again via useState's initial
  // value) rather than this effect needing to reset it itself.
  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/workspace/members?workspaceId=${encodeURIComponent(workspaceId)}`);
    if (!res.ok) {
      setError("Could not load members.");
      return;
    }
    const body = (await res.json()) as { members?: WorkspaceMember[] };
    setMembers(Array.isArray(body.members) ? body.members : []);
  }, [workspaceId]);

  // load() is an async fetch (see its own doc comment above); every setState
  // inside it happens after an await, never synchronously in this effect
  // body - the linter cannot see through the named function reference to
  // confirm that on its own.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const handleRemove = async (userId: string) => {
    setRemovingUserId(userId);
    setError(null);
    const res = await fetch(`/api/workspace/members/${userId}?workspaceId=${encodeURIComponent(workspaceId)}`, { method: "DELETE" });
    setRemovingUserId(null);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error || "Could not remove that member.");
      return;
    }
    await load();
  };

  return (
    <div className="glass-card rounded-2xl p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-accent/10 text-accent grid place-items-center shrink-0">
          <Users className="h-4.5 w-4.5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Members</h2>
          <p className="text-sm text-text-muted mt-0.5">
            {isOwner ? "Everyone with session access to this workspace. You can remove anyone but yourself." : "Everyone with session access to this workspace."}
          </p>
        </div>
      </div>
      {error && <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
      {members === null ? (
        <p className="text-sm text-text-muted">Loading...</p>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between gap-3 rounded-lg border border-surface-border px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{m.email}</p>
                <p className="text-xs text-text-muted">Joined {new Date(m.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={m.role === "owner" ? "success" : "default"}>{m.role}</Badge>
                {isOwner && !m.isSelf && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={removingUserId === m.userId}
                    onClick={() => handleRemove(m.userId)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {removingUserId === m.userId ? "Removing..." : "Remove"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AccountPage() {
  const { status, user, workspaces, refresh, signOut } = useAccount();
  const { mode, workspaceId, switchWorkspace } = useWorkspace();
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimPendingMessage, setClaimPendingMessage] = useState<string | null>(null);
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
    setClaimPendingMessage(null);
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
    if ("pending" in result) {
      // This workspace already has a registered owner_email - the claim is
      // NOT granted yet, only requested. See lib/auth/claim-flow.ts: a bare
      // token is not enough on its own to permanently claim a workspace
      // someone already gave an owner_email for, precisely because a token
      // can leak without its owner knowing. Access completes only once the
      // confirmation link mailed to that address is clicked.
      setClaimPendingMessage(result.message);
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
            {claimPendingMessage && (
              <p className="text-sm text-amber-600 bg-amber-500/10 rounded-lg px-3 py-2 flex items-start gap-2">
                <Mail className="h-4 w-4 shrink-0 mt-0.5" />
                {claimPendingMessage}
              </p>
            )}
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

        {mode === "session" && workspaceId && (
          <MembersPanel
            key={workspaceId}
            workspaceId={workspaceId}
            isOwner={workspaces.find((w) => w.id === workspaceId)?.role === "owner"}
          />
        )}

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
