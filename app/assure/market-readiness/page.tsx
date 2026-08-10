"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Plus, ShieldCheck } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { ENTITY_LABEL, JURISDICTION_LABEL } from "@/data/kyc/types";
import { formatIsoDate } from "@/lib/format/date";
import { READINESS_STATUS_LABEL, type ReadinessListItem, type ReadinessStatus } from "@/components/readiness/types";

const STATUS_VARIANT: Record<ReadinessStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  draft: "default",
  in_review: "info",
  approved_local: "warning",
  approved_global: "success",
  rejected: "danger",
  cancelled: "default",
};

const STATUSES: ReadinessStatus[] = ["draft", "in_review", "approved_local", "approved_global", "rejected", "cancelled"];

function fmtDate(iso: string | null): string {
  return formatIsoDate(iso, { fallback: "No target date", style: "long" });
}

export default function MarketReadinessListPage() {
  const { wsFetch, ready, workspaceId } = useWorkspace();
  const [items, setItems] = useState<ReadinessListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReadinessStatus | null>(null);

  // Only fetch once a workspace already exists - never create one just for
  // visiting this page (wsFetch calls ensureWorkspace(), which POSTs
  // bootstrap - an anonymous visitor who merely lands here must not get a DB
  // row for it). Mirrors app/assure/incidents/page.tsx's gate.
  useEffect(() => {
    if (!ready || !workspaceId) return;
    let cancelled = false;

    (async () => {
      try {
        const params = new URLSearchParams();
        if (statusFilter) params.set("status", statusFilter);
        const qs = params.toString();
        const res = await wsFetch(`/api/readiness${qs ? `?${qs}` : ""}`);
        if (!res.ok) throw new Error("Failed to load readiness assessments");
        const data: unknown = await res.json();
        const list =
          data && typeof data === "object" && Array.isArray((data as { assessments?: unknown }).assessments)
            ? (data as { assessments: ReadinessListItem[] }).assessments
            : [];
        if (!cancelled) setItems(list);
      } catch {
        if (!cancelled) setError("Could not load your readiness assessments. Try reloading the page.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, workspaceId, wsFetch, statusFilter]);

  // No workspace yet (nothing has been saved by this browser): show the same
  // empty state as a workspace with zero saved assessments, without ever
  // fetching (which would create one via wsFetch).
  const noWorkspaceYet = ready && !workspaceId;

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "Market Readiness" }]}>
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Entity &amp; Market Readiness</h1>
              <p className="text-sm text-text-muted mt-1 max-w-xl">
                Turn the obligation register for an entity type and jurisdiction into a go/no-go: map each obligation
                to a control, flag launch blockers, and get to a local then global approval.
              </p>
            </div>
            <Link href="/assure/market-readiness/new">
              <Button>
                <Plus className="h-4 w-4" /> New readiness assessment
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mb-6">
            <span className="text-xs text-text-muted mr-1">Status:</span>
            <FilterChip label="All" active={statusFilter === null} onClick={() => setStatusFilter(null)} />
            {STATUSES.map((s) => (
              <FilterChip key={s} label={READINESS_STATUS_LABEL[s]} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
            ))}
          </div>

          {error && <div className="glass-card rounded-xl p-4 text-sm text-red-500 mb-6">{error}</div>}

          {items === null && !error && !noWorkspaceYet && (
            <div className="glass-card rounded-2xl p-10 text-center text-text-muted text-sm">Loading readiness assessments...</div>
          )}

          {(noWorkspaceYet || (items !== null && items.length === 0)) && !error && (
            <div className="glass-card rounded-2xl p-10 text-center">
              <ShieldCheck className="h-8 w-8 text-text-muted mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-foreground mb-1">
                {statusFilter ? "No readiness assessments match this filter" : "No readiness assessments yet"}
              </h2>
              <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
                {statusFilter
                  ? "Try clearing the filter above."
                  : "Start one to build the obligation register for an entity type and jurisdiction, map controls, flag blockers, and drive it to a launch decision."}
              </p>
              {!statusFilter && (
                <Link href="/assure/market-readiness/new">
                  <Button>
                    <Plus className="h-4 w-4" /> New readiness assessment
                  </Button>
                </Link>
              )}
            </div>
          )}

          {items !== null && items.length > 0 && (
            <div className="grid gap-3">
              {items.map((a) => (
                <Link
                  key={a.id}
                  href={`/assure/market-readiness/${a.id}`}
                  className={`glass-card rounded-xl p-5 flex items-center justify-between gap-4 hover:border-accent/40 transition-colors ${
                    a.unresolvedBlockers > 0 ? "border-amber-400/30" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{a.title}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {ENTITY_LABEL[a.entityType] ?? a.entityType} &middot; {JURISDICTION_LABEL[a.jurisdiction] ?? a.jurisdiction} &middot;{" "}
                      {fmtDate(a.targetLaunchDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-text-muted">{a.coveragePct}% covered</span>
                    {a.unresolvedBlockers > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium" title="Unresolved launch blockers">
                        <AlertTriangle className="h-3.5 w-3.5" /> {a.unresolvedBlockers} blocker{a.unresolvedBlockers === 1 ? "" : "s"}
                      </span>
                    ) : a.blockerCount > 0 ? (
                      <span className="text-xs text-text-muted">{a.blockerCount} blocker{a.blockerCount === 1 ? "" : "s"} resolved</span>
                    ) : null}
                    <Badge variant={STATUS_VARIANT[a.status]}>{READINESS_STATUS_LABEL[a.status]}</Badge>
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

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
        active ? "bg-accent/10 text-accent border-accent/30" : "bg-surface text-text-muted border-line-2 hover:border-accent/40"
      }`}
    >
      {label}
    </button>
  );
}
