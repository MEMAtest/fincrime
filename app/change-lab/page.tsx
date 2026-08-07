"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Blocks, Plus } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import {
  CONTROL_CHANGE_STATUS_LABEL,
  CONTROL_CHANGE_TYPE_LABEL,
  LAST_UNLOCKED_STEP,
  type ControlChangeListItem,
  type ControlChangeStatus,
} from "@/components/change-lab/types";

const STATUS_VARIANT: Record<ControlChangeStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  draft: "default",
  in_review: "info",
  approved: "warning",
  rejected: "danger",
  implemented: "success",
  rolled_back: "default",
};

export default function ControlChangeLabListPage() {
  const { wsFetch, ready, workspaceId } = useWorkspace();
  const [changes, setChanges] = useState<ControlChangeListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only fetch once a workspace already exists; never create one just for
  // visiting this page (wsFetch calls ensureWorkspace(), which POSTs
  // bootstrap - an anonymous visitor who merely lands here must not get a DB
  // row for it). Mirrors app/workspace/page.tsx's gate.
  useEffect(() => {
    if (!ready || !workspaceId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await wsFetch("/api/control-changes");
        if (!res.ok) throw new Error("Failed to load control changes");
        const data: unknown = await res.json();
        const list =
          data && typeof data === "object" && Array.isArray((data as { changes?: unknown }).changes)
            ? ((data as { changes: ControlChangeListItem[] }).changes)
            : [];
        if (!cancelled) setChanges(list);
      } catch {
        if (!cancelled) setError("Could not load your control changes. Try reloading the page.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, workspaceId, wsFetch]);

  // No workspace yet (nothing has been saved by this browser): show the same
  // "No control changes yet" empty state as a workspace with zero saved
  // changes, without ever fetching (which would create one via wsFetch).
  const noWorkspaceYet = ready && !workspaceId;

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "Control Changes" }]}>
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Control Change Lab</h1>
              <p className="text-sm text-text-muted mt-1 max-w-xl">
                Propose, test, approve and evidence a change to a live control: current vs proposed, supporting
                data, operational impact, an approver&apos;s decision, a monitoring plan and a rollback path.
              </p>
            </div>
            <Link href="/change-lab/new">
              <Button>
                <Plus className="h-4 w-4" /> New change
              </Button>
            </Link>
          </div>

          {error && <div className="glass-card rounded-xl p-4 text-sm text-red-500 mb-6">{error}</div>}

          {changes === null && !error && !noWorkspaceYet && (
            <div className="glass-card rounded-2xl p-10 text-center text-text-muted text-sm">
              Loading control changes...
            </div>
          )}

          {(noWorkspaceYet || (changes !== null && changes.length === 0)) && !error && (
            <div className="glass-card rounded-2xl p-10 text-center">
              <Blocks className="h-8 w-8 text-text-muted mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-foreground mb-1">No control changes yet</h2>
              <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
                A control change proposes and tracks a change to a control you already have live in your
                workspace. Instantiate a control from the{" "}
                <Link href="/controls" className="text-accent hover:underline">
                  Controls Library
                </Link>{" "}
                or the{" "}
                <Link href="/control-builder" className="text-accent hover:underline">
                  Control Builder
                </Link>{" "}
                first, then propose a change against it.
              </p>
              <Link href="/change-lab/new">
                <Button>
                  <Plus className="h-4 w-4" /> Start a change
                </Button>
              </Link>
            </div>
          )}

          {changes !== null && changes.length > 0 && (
            <div className="grid gap-3">
              {changes.map((c) => (
                <Link
                  key={c.id}
                  href={`/change-lab/${c.id}`}
                  className="glass-card rounded-xl p-5 flex items-center justify-between gap-4 hover:border-accent/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{c.title}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {c.controlName} · Step {c.currentStep} of {LAST_UNLOCKED_STEP} · Updated{" "}
                      {new Date(c.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {c.changeType && <Badge>{CONTROL_CHANGE_TYPE_LABEL[c.changeType]}</Badge>}
                    <Badge variant={STATUS_VARIANT[c.status] ?? "default"}>
                      {CONTROL_CHANGE_STATUS_LABEL[c.status] ?? c.status}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-text-muted" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </ToolFrame>
  );
}
