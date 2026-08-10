"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Plus, ShieldAlert } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import {
  INCIDENT_SEVERITY_LABEL,
  INCIDENT_STATUS_LABEL,
  type IncidentListItem,
  type IncidentSeverity,
  type IncidentStatus,
} from "@/components/incidents/types";

const SEVERITY_VARIANT: Record<IncidentSeverity, "default" | "success" | "warning" | "danger" | "info"> = {
  low: "default",
  medium: "info",
  high: "warning",
  critical: "danger",
};

const STATUS_VARIANT: Record<IncidentStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  open: "danger",
  contained: "warning",
  investigating: "info",
  remediating: "warning",
  closed: "success",
  cancelled: "default",
};

const SEVERITIES: IncidentSeverity[] = ["low", "medium", "high", "critical"];
const STATUSES: IncidentStatus[] = ["open", "contained", "investigating", "remediating", "closed", "cancelled"];

function fmtDate(iso: string | null): string {
  if (!iso) return "Not detected yet";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function IncidentsListPage() {
  const { wsFetch, ready, workspaceId } = useWorkspace();
  const [incidents, setIncidents] = useState<IncidentListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | null>(null);
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | null>(null);

  // Only fetch once a workspace already exists - never create one just for
  // visiting this page (wsFetch calls ensureWorkspace(), which POSTs
  // bootstrap - an anonymous visitor who merely lands here must not get a DB
  // row for it). Mirrors app/assure/control-testing/page.tsx's gate.
  useEffect(() => {
    if (!ready || !workspaceId) return;
    let cancelled = false;

    (async () => {
      try {
        const params = new URLSearchParams();
        if (statusFilter) params.set("status", statusFilter);
        if (severityFilter) params.set("severity", severityFilter);
        const qs = params.toString();
        const res = await wsFetch(`/api/incidents${qs ? `?${qs}` : ""}`);
        if (!res.ok) throw new Error("Failed to load incidents");
        const data: unknown = await res.json();
        const list =
          data && typeof data === "object" && Array.isArray((data as { incidents?: unknown }).incidents)
            ? (data as { incidents: IncidentListItem[] }).incidents
            : [];
        if (!cancelled) setIncidents(list);
      } catch {
        if (!cancelled) setError("Could not load your incidents. Try reloading the page.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, workspaceId, wsFetch, severityFilter, statusFilter]);

  // No workspace yet (nothing has been saved by this browser): show the same
  // "No incidents yet" empty state as a workspace with zero saved incidents,
  // without ever fetching (which would create one via wsFetch).
  const noWorkspaceYet = ready && !workspaceId;

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "Incidents" }]}>
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Incidents</h1>
              <p className="text-sm text-text-muted mt-1 max-w-xl">
                Log an incident, contain it, trace it back to the control that let it through, remediate, and close
                once the loop is proven closed.
              </p>
            </div>
            <Link href="/assure/incidents/new">
              <Button>
                <Plus className="h-4 w-4" /> Log an incident
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-text-muted mr-1">Severity:</span>
              <FilterChip label="All" active={severityFilter === null} onClick={() => setSeverityFilter(null)} />
              {SEVERITIES.map((s) => (
                <FilterChip key={s} label={INCIDENT_SEVERITY_LABEL[s]} active={severityFilter === s} onClick={() => setSeverityFilter(s)} />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-text-muted mr-1">Status:</span>
              <FilterChip label="All" active={statusFilter === null} onClick={() => setStatusFilter(null)} />
              {STATUSES.map((s) => (
                <FilterChip key={s} label={INCIDENT_STATUS_LABEL[s]} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
              ))}
            </div>
          </div>

          {error && <div className="glass-card rounded-xl p-4 text-sm text-red-500 mb-6">{error}</div>}

          {incidents === null && !error && !noWorkspaceYet && (
            <div className="glass-card rounded-2xl p-10 text-center text-text-muted text-sm">Loading incidents...</div>
          )}

          {(noWorkspaceYet || (incidents !== null && incidents.length === 0)) && !error && (
            <div className="glass-card rounded-2xl p-10 text-center">
              <ShieldAlert className="h-8 w-8 text-text-muted mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-foreground mb-1">
                {severityFilter || statusFilter ? "No incidents match these filters" : "No incidents yet"}
              </h2>
              <p className="text-sm text-text-muted max-w-md mx-auto mb-6">
                {severityFilter || statusFilter
                  ? "Try clearing the filters above."
                  : "When something goes wrong, log it here: contain it, trace it back to the control that let it through, remediate, and close once the loop is proven closed."}
              </p>
              {!severityFilter && !statusFilter && (
                <Link href="/assure/incidents/new">
                  <Button>
                    <Plus className="h-4 w-4" /> Log an incident
                  </Button>
                </Link>
              )}
            </div>
          )}

          {incidents !== null && incidents.length > 0 && (
            <div className="grid gap-3">
              {incidents.map((i) => (
                <Link
                  key={i.id}
                  href={`/assure/incidents/${i.id}`}
                  className={`glass-card rounded-xl p-5 flex items-center justify-between gap-4 hover:border-accent/40 transition-colors ${
                    i.openActions > 0 ? "border-amber-400/30" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {i.reference && <span className="text-xs text-text-muted font-mono">{i.reference}</span>}
                      <p className="font-medium text-foreground truncate">{i.title}</p>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      {i.ownerName ?? "Unassigned"} &middot; Detected {fmtDate(i.detectedAt)} &middot; Updated{" "}
                      {new Date(i.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {i.openActions > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600" title="Open remediation actions">
                        <AlertTriangle className="h-3.5 w-3.5" /> {i.openActions} open
                      </span>
                    )}
                    <Badge variant={SEVERITY_VARIANT[i.severity]}>{INCIDENT_SEVERITY_LABEL[i.severity]}</Badge>
                    <Badge variant={STATUS_VARIANT[i.status]}>{INCIDENT_STATUS_LABEL[i.status]}</Badge>
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
