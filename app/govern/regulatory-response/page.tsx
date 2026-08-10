"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Plus, Scale } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { formatIsoDate } from "@/lib/format/date";
import {
  REG_REQUEST_STATUS_LABEL,
  type RegRequestListItemDTO,
  type RegRequestStatus,
  type RegResponseSummaryDTO,
} from "@/components/reg-response/types";

const STATUS_VARIANT: Record<RegRequestStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  draft: "default",
  in_progress: "info",
  in_review: "info",
  approved: "warning",
  submitted: "success",
  closed: "success",
  cancelled: "danger",
};

// 'in_progress' and 'in_review' are excluded: no code path ever sets a
// reg_request to either status (createRegRequest always starts 'draft', and
// PATCH unconditionally rejects status changes - only approve/submit/close/
// reject move status, none of which produce these two) - a filter chip for
// them would always return zero rows. They remain valid in RegRequestStatus
// / the DB CHECK for forward compatibility if that transition is wired up
// later; see the module review notes.
const STATUSES: RegRequestStatus[] = ["draft", "approved", "submitted", "closed", "cancelled"];

function fmtDate(iso: string | null): string {
  return formatIsoDate(iso, { fallback: "No deadline", style: "long" });
}

export default function RegulatoryResponseListPage() {
  const { wsFetch, ready, workspaceId } = useWorkspace();
  const [items, setItems] = useState<RegRequestListItemDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RegRequestStatus | null>(null);

  // Only fetch once a workspace already exists - never create one just for
  // visiting this page (wsFetch calls ensureWorkspace(), which POSTs
  // bootstrap - an anonymous visitor who merely lands here must not get a DB
  // row for it). Mirrors app/assure/market-readiness/page.tsx's gate.
  useEffect(() => {
    if (!ready || !workspaceId) return;
    let cancelled = false;

    (async () => {
      try {
        const params = new URLSearchParams();
        if (statusFilter) params.set("status", statusFilter);
        const qs = params.toString();
        const res = await wsFetch(`/api/reg-requests${qs ? `?${qs}` : ""}`);
        if (!res.ok) throw new Error("Failed to load reg requests");
        const data: unknown = await res.json();
        const list =
          data && typeof data === "object" && Array.isArray((data as { requests?: unknown }).requests)
            ? (data as { requests: RegRequestListItemDTO[] }).requests
            : [];
        if (cancelled) return;
        setItems(list);
      } catch {
        if (!cancelled) setError("Could not load your regulator requests. Try reloading the page.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, workspaceId, wsFetch, statusFilter]);

  // No workspace yet (nothing has been saved by this browser): show the same
  // empty state as a workspace with zero saved requests, without ever
  // fetching (which would create one via wsFetch).
  const noWorkspaceYet = ready && !workspaceId;

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "Regulatory Response" }]}>
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Regulatory Response Workspace</h1>
              <p className="text-sm text-text-muted mt-1 max-w-xl">
                Turn a regulator request into tracked work: answer every question, substantiate each answer with a
                real control, test, change or incident, and track every commitment made to a due date.
              </p>
            </div>
            <Link href="/govern/regulatory-response/new">
              <Button>
                <Plus className="h-4 w-4" /> Log a request
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mb-6">
            <span className="text-xs text-text-muted mr-1">Status:</span>
            <FilterChip label="All" active={statusFilter === null} onClick={() => setStatusFilter(null)} />
            {STATUSES.map((s) => (
              <FilterChip key={s} label={REG_REQUEST_STATUS_LABEL[s]} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
            ))}
          </div>

          {error && <div className="glass-card rounded-xl p-4 text-sm text-red-500 mb-6">{error}</div>}

          {items === null && !error && !noWorkspaceYet && (
            <div className="glass-card rounded-2xl p-10 text-center text-text-muted text-sm">Loading regulator requests...</div>
          )}

          {(noWorkspaceYet || (items !== null && items.length === 0)) && !error && (
            <div className="glass-card rounded-2xl p-10 text-center">
              <Scale className="h-8 w-8 text-text-muted mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-foreground mb-1">
                {statusFilter ? "No requests match this filter" : "No regulator requests logged yet"}
              </h2>
              <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
                {statusFilter
                  ? "Try clearing the filter above."
                  : "Log a regulator request to break it into questions, answer and substantiate each one, track commitments, and drive it to sign-off."}
              </p>
              {!statusFilter && (
                <Link href="/govern/regulatory-response/new">
                  <Button>
                    <Plus className="h-4 w-4" /> Log a request
                  </Button>
                </Link>
              )}
            </div>
          )}

          {items !== null && items.length > 0 && (
            <div className="grid gap-3">
              {items.map((r) => {
                const summary: RegResponseSummaryDTO | undefined = r.progress;
                const daysUntil = summary?.daysUntilDeadline ?? null;
                const overdue = r.deadline !== null && daysUntil !== null && daysUntil < 0 && r.status !== "closed" && r.status !== "cancelled";
                const openCommitments = summary ? summary.totalCommitments - summary.commitmentsByStatus.met - summary.commitmentsByStatus.missed - summary.commitmentsByStatus.withdrawn : 0;

                return (
                  <Link
                    key={r.id}
                    href={`/govern/regulatory-response/${r.id}`}
                    className={`glass-card rounded-xl p-5 flex items-center justify-between gap-4 hover:border-accent/40 transition-colors ${
                      overdue ? "border-red-400/30" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {r.reference ? `${r.reference} - ` : ""}
                        {r.title}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {r.regulator} &middot; Deadline: {fmtDate(r.deadline)}
                        {daysUntil !== null && (
                          <span className={overdue ? "text-red-500 font-medium" : ""}>
                            {" "}
                            ({overdue ? `${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? "" : "s"} overdue` : `${daysUntil} day${daysUntil === 1 ? "" : "s"} left`})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {summary && (
                        <span className="text-xs text-text-muted">
                          {summary.answeredCount} of {summary.totalQuestions} answered
                        </span>
                      )}
                      {summary && openCommitments > 0 && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium ${
                            summary.overdueCommitmentCount > 0 ? "text-red-500" : "text-text-muted"
                          }`}
                          title="Open commitments"
                        >
                          {summary.overdueCommitmentCount > 0 && <AlertTriangle className="h-3.5 w-3.5" />}
                          {openCommitments} open commitment{openCommitments === 1 ? "" : "s"}
                        </span>
                      )}
                      <Badge variant={STATUS_VARIANT[r.status]}>{REG_REQUEST_STATUS_LABEL[r.status]}</Badge>
                      <ArrowRight className="h-4 w-4 text-text-muted" />
                    </div>
                  </Link>
                );
              })}
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
