"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { FileText, Download, ArrowRight, ListChecks, History, ClipboardList, ShieldAlert, Flag, Gavel } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import PDFExportButton from "@/components/shared/PDFExportButton";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { formatIsoDate } from "@/lib/format/date";

type ReportKind = "pra_assessment" | "control_change" | "control_test" | "incident" | "readiness_assessment" | "reg_request";

interface ReportRecordDTO {
  id: string;
  kind: ReportKind;
  label: string;
  status: string;
  updatedAt: string;
  currentStep: number;
  totalSteps: number;
  exportable: boolean;
  href: string;
}

const KIND_ORDER: ReportKind[] = ["pra_assessment", "control_change", "control_test", "readiness_assessment", "incident", "reg_request"];

const KIND_META: Record<ReportKind, { label: string; icon: LucideIcon; description: string }> = {
  pra_assessment: { label: "Product Risk Assessments", icon: Gavel, description: "The committee pack for each product risk assessment." },
  control_change: { label: "Control Changes", icon: History, description: "The before/after change pack for each proposed or implemented control change." },
  control_test: { label: "Control Tests", icon: ClipboardList, description: "The test report for each control test cycle." },
  readiness_assessment: { label: "Market Readiness", icon: Flag, description: "The launch-readiness pack for each entity and market readiness review." },
  incident: { label: "Incidents", icon: ShieldAlert, description: "The incident report for each logged financial crime incident." },
  reg_request: { label: "Regulatory Response", icon: ListChecks, description: "The response pack for each regulator request." },
};

function fmtDate(iso: string): string {
  return formatIsoDate(iso, { fallback: "-", style: "long" });
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export default function ReportsPage() {
  const { workspaceId, ready, wsFetch, ensureWorkspace } = useWorkspace();
  const [records, setRecords] = useState<ReportRecordDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only fetch once a workspace already exists - never create one just for
  // visiting this page, mirroring app/govern/regulatory-response/page.tsx.
  useEffect(() => {
    if (!ready || !workspaceId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await wsFetch("/api/governance/reports");
        if (!res.ok) throw new Error("Failed to load reports");
        const data = (await res.json()) as { records: ReportRecordDTO[] };
        if (cancelled) return;
        setRecords(data.records);
      } catch {
        if (!cancelled) setError("Could not load the reports index. Try reloading the page.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, workspaceId, wsFetch]);

  const grouped = useMemo(() => {
    const map = new Map<ReportKind, ReportRecordDTO[]>();
    for (const r of records ?? []) {
      const bucket = map.get(r.kind);
      if (bucket) bucket.push(r);
      else map.set(r.kind, [r]);
    }
    return map;
  }, [records]);

  const noWorkspaceYet = ready && !workspaceId;
  const totalRecords = records?.length ?? 0;

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "Governance" }, { label: "Reports" }]}>
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <ToolPageHeader
            eyebrow="GOVERNANCE"
            title="Reports"
            subtitle="Every pack this workspace can produce, grouped by kind, with a direct export per record. Exporting a record opens its own journey at the step where its pack is assembled - the same export button and payload used throughout the app, never a second copy of that logic."
          />

          {/* Governance pack - the one export that lives entirely on this page,
              because its payload is built server-side from the portfolio
              endpoint (never a client-asserted one), so there is nothing to
              navigate to first. */}
          <section className="glass-card rounded-2xl p-5 sm:p-6 mb-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-9 w-9 rounded-lg bg-accent/12 text-accent grid place-items-center shrink-0">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-foreground">Governance Pack</h2>
                  <p className="text-xs text-text-muted mt-0.5 max-w-xl">
                    A dated snapshot of the whole Governance Dashboard - every section as its own table - built
                    server-side from your workspace, ready to table at a committee.
                  </p>
                </div>
              </div>
              {noWorkspaceYet ? (
                <button
                  type="button"
                  onClick={() => void ensureWorkspace()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border text-sm font-medium text-foreground hover:bg-surface-hover transition-colors shrink-0"
                >
                  <Download className="h-4 w-4" /> Start a workspace to export
                </button>
              ) : (
                <div className="shrink-0">
                  <PDFExportButton module="governance_pack" assessmentData={{}} />
                </div>
              )}
            </div>
          </section>

          {noWorkspaceYet ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <FileText className="h-8 w-8 text-text-muted mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-foreground mb-1">Nothing to report on yet</h2>
              <p className="text-sm text-text-muted max-w-md mx-auto">
                Once you save a product risk assessment, control change, control test, incident, readiness review or
                regulator request, its pack will show up here.
              </p>
            </div>
          ) : error ? (
            <div className="glass-card rounded-2xl p-8 text-center text-sm text-text-muted">{error}</div>
          ) : records === null ? (
            <div className="glass-card rounded-2xl p-10 text-center text-text-muted text-sm">Loading reports...</div>
          ) : totalRecords === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <FileText className="h-8 w-8 text-text-muted mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-foreground mb-1">No module records yet</h2>
              <p className="text-sm text-text-muted max-w-md mx-auto">
                Nothing has been saved in a module that produces a pack (product risk, control changes, control
                testing, incidents, market readiness, regulatory response).
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {KIND_ORDER.filter((kind) => (grouped.get(kind)?.length ?? 0) > 0).map((kind) => {
                const meta = KIND_META[kind];
                const items = grouped.get(kind) ?? [];
                return (
                  <section key={kind} className="glass-card rounded-2xl p-5 sm:p-6">
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="h-8 w-8 rounded-lg bg-accent/12 text-accent grid place-items-center shrink-0">
                        <meta.icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-foreground">{meta.label}</h2>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-text-muted ml-auto shrink-0">{items.length}</span>
                    </div>
                    <p className="text-xs text-text-muted mb-4 ml-[42px]">{meta.description}</p>
                    <div className="space-y-2">
                      {items.map((r) => (
                        <ReportRow key={r.id} record={r} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </ToolFrame>
  );
}

function ReportRow({ record }: { record: ReportRecordDTO }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-surface-border px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{record.label}</p>
        <p className="text-xs text-text-muted mt-0.5">
          {statusLabel(record.status)} &middot; Updated {fmtDate(record.updatedAt)}
          {!record.exportable && ` · Step ${record.currentStep} of ${record.totalSteps}`}
        </p>
      </div>
      {record.exportable ? (
        <Link
          href={record.href}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-surface-border text-xs font-medium text-foreground hover:bg-surface-hover transition-colors shrink-0"
        >
          <Download className="h-3.5 w-3.5" /> Open pack &amp; export
        </Link>
      ) : (
        <Link
          href={record.href}
          title={`Not exportable yet: reach the final step (${record.totalSteps}) first, currently at step ${record.currentStep}.`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-text-muted hover:text-foreground transition-colors shrink-0"
        >
          Not exportable yet - continue <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
