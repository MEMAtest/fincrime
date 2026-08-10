"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Gavel, AlertTriangle, Flag, History, ClipboardList, ShieldAlert, Scale, ListChecks, LayoutDashboard, ArrowRight,
} from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import Badge from "@/components/ui/Badge";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { formatIsoDate } from "@/lib/format/date";
import type { PortfolioSnapshot, PortfolioItem, PortfolioUrgency } from "@/lib/governance/portfolio";

function fmtDate(iso: string | null): string {
  return formatIsoDate(iso, { fallback: "No date", style: "long" });
}

const URGENCY_VARIANT: Record<PortfolioUrgency, "default" | "success" | "warning" | "danger" | "info"> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "default",
  overdue: "danger",
  due_soon: "warning",
  info: "default",
};

const URGENCY_LABEL: Record<PortfolioUrgency, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  overdue: "Overdue",
  due_soon: "Due soon",
  info: "-",
};

const SUBJECT_TYPE_LABEL: Record<string, string> = {
  pra_assessment: "Product risk assessment",
  control_change: "Control change",
  control_test: "Control test",
  workspace_control: "Control",
  readiness_assessment: "Market readiness",
  readiness_obligation: "Readiness obligation",
  reg_request: "Regulatory response",
  reg_commitment: "Regulatory commitment",
  incident: "Incident",
  condition: "Condition",
  action: "Action",
};

export default function GovernanceDashboardPage() {
  const { workspaceId, ready, wsFetch } = useWorkspace();
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Gated on ready && workspaceId, mirroring the workspace home: an
  // anonymous visitor who merely lands on this page must never get a
  // workspace minted for them (wsFetch's ensureWorkspace() would do exactly
  // that if called before a workspace exists).
  useEffect(() => {
    if (!ready || !workspaceId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await wsFetch("/api/governance/portfolio");
        if (!res.ok) throw new Error(`Portfolio fetch failed: ${res.status}`);
        const data = (await res.json()) as { portfolio: PortfolioSnapshot };
        if (cancelled) return;
        setPortfolio(data.portfolio);
      } catch {
        if (!cancelled) setError("Could not load the governance dashboard right now. Refresh to try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, workspaceId, wsFetch]);

  const noWorkspaceYet = ready && !workspaceId;
  const isEmpty = portfolio !== null && isPortfolioEmpty(portfolio);

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "Governance" }, { label: "Dashboard" }]}>
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <ToolPageHeader
            eyebrow="GOVERNANCE"
            title="Governance"
            titleAccent="Dashboard"
            subtitle="Everything outstanding across every workstream in one committee-ready view: assessments, control changes, control tests, incidents, market readiness and regulatory response. The portfolio-level sibling of My Work - this shows the whole workspace, not just what's assigned to you."
          />

          {noWorkspaceYet ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <LayoutDashboard className="h-8 w-8 text-text-muted mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-foreground mb-1">Nothing to govern yet</h2>
              <p className="text-sm text-text-muted max-w-md mx-auto">
                Your workspace has no saved assessments, changes or requests yet. Once you save something, it shows
                up here.
              </p>
            </div>
          ) : error ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-sm text-text-muted">{error}</p>
            </div>
          ) : portfolio === null ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-sm text-text-muted">Loading the governance dashboard...</p>
            </div>
          ) : portfolio ? (
            isEmpty ? (
              <div className="glass-card rounded-2xl p-8 text-center">
                <LayoutDashboard className="h-8 w-8 text-text-muted mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-foreground mb-1">Nothing outstanding</h2>
                <p className="text-sm text-text-muted max-w-md mx-auto">
                  Every assessment, control change, control test, incident, readiness review and regulatory response
                  in this workspace is either not yet started or fully closed out. As of {fmtDate(portfolio.asOf)}.
                </p>
              </div>
            ) : (
              <>
                <KpiStrip portfolio={portfolio} />
                <div className="space-y-5">
                  <GovSection
                    icon={Gavel}
                    eyebrow="Awaiting sign-off"
                    title="Decisions required"
                    caption="Product risk assessments, control changes, readiness reviews and regulatory responses that have been submitted for review and are waiting on a decision."
                    items={portfolio.decisionsRequired.items}
                    emptyMessage="Nothing is currently awaiting a decision."
                  />

                  <TwoUpSection
                    icon={AlertTriangle}
                    eyebrow="Appetite"
                    title="Risk outside appetite"
                    left={{ label: "Outside appetite", caption: "PRA assessments whose residual risk was assessed as outside the firm's risk appetite.", items: portfolio.riskOutsideAppetite.outside.items, emptyMessage: "None outside appetite." }}
                    right={{ label: "Tolerated", caption: "PRA assessments whose residual risk is outside appetite but has been explicitly tolerated.", items: portfolio.riskOutsideAppetite.tolerated.items, emptyMessage: "None currently tolerated." }}
                  />

                  <GovSection
                    icon={Flag}
                    eyebrow="Sign-off conditions"
                    title="Open launch conditions and blockers"
                    caption="Conditions attached to a decision that are not yet met or breached, plus unresolved launch blockers on any open readiness review."
                    items={portfolio.openConditionsAndBlockers.items}
                    emptyMessage="No open conditions or unresolved launch blockers."
                  />

                  <TwoUpSection
                    icon={History}
                    eyebrow="Control changes"
                    title="Control changes in flight"
                    left={{ label: "Approved, not yet implemented", caption: "Control changes that have been approved but not yet applied to the live control.", items: portfolio.controlChangesInFlight.items, emptyMessage: "No approved changes waiting to be implemented." }}
                    right={{ label: "Implemented, not yet retested", caption: "Control changes applied to a live control that has not been tested since.", items: portfolio.controlChangesImplementedNotTested.items, emptyMessage: "Every implemented change has since been retested." }}
                  />

                  <TwoUpSection
                    icon={ClipboardList}
                    eyebrow="Assurance"
                    title="Control testing"
                    left={{ label: "Due or overdue for testing", caption: "Controls whose next scheduled test date has passed, or falls within the next 30 days.", items: portfolio.controlsDueForTesting.items, emptyMessage: "No control is due for testing in the next 30 days." }}
                    right={{ label: "Failed tests", caption: "Completed control tests whose recorded result was a fail.", items: portfolio.failedControlTests.items, emptyMessage: "No failed control tests." }}
                  />

                  <IncidentSection portfolio={portfolio} />

                  <TwoUpSection
                    icon={Scale}
                    eyebrow="Regulatory response"
                    title="Regulatory commitments"
                    left={{ label: "Overdue", caption: "Open or in-progress commitments made to a regulator whose due date has passed.", items: portfolio.regulatoryCommitments.overdue.items, emptyMessage: "No overdue commitments." }}
                    right={{ label: "Due within 30 days", caption: "Open or in-progress commitments due in the next 30 days.", items: portfolio.regulatoryCommitments.dueSoon.items, emptyMessage: "Nothing due in the next 30 days." }}
                  />

                  <GovSection
                    icon={ListChecks}
                    eyebrow="Follow-through"
                    title="Overdue actions"
                    caption="Every open or in-progress action across all workstreams whose due date has passed."
                    items={portfolio.overdueActions.items}
                    emptyMessage="No overdue actions."
                  />
                </div>
                <p className="text-xs text-text-muted mt-6 text-center">
                  Snapshot as of {fmtDate(portfolio.asOf)}. Sections can overlap - e.g. an overdue regulatory
                  commitment also appears under Overdue actions as its tracked action, and an incident past its
                  remediation target also appears there as its own overdue action - so totals should not be
                  added across sections.
                </p>
              </>
            )
          ) : null}
        </div>
      </main>
    </ToolFrame>
  );
}

// Audited against every field the dashboard actually renders below: the six
// GovSection/TwoUpSection blocks (decisionsRequired; riskOutsideAppetite.
// outside AND .tolerated; openConditionsAndBlockers; controlChangesInFlight
// AND .controlChangesImplementedNotTested; controlsDueForTesting AND
// failedControlTests; regulatoryCommitments.overdue AND .dueSoon),
// IncidentSection (incidents.open - pastTarget and bySeverity/byStatus are
// annotations ON that same set, never non-zero while open.count is 0), and
// the closing overdueActions section. regulatoryCommitments.open itself is
// not separately rendered (only its overdue/dueSoon subsets are), so it is
// checked here for the same reason .outside/.tolerated both are: a count can
// be non-zero (e.g. an open commitment further than 30 days out) while every
// rendered subset is empty, which must still not report "Nothing
// outstanding". riskOutsideAppetite.tolerated was the field previously
// missing here - a workspace whose only outstanding item was a tolerated
// assessment rendered this page's full "Nothing outstanding" empty state
// while the pack (built from the identical snapshot) still printed a "Risk
// tolerated outside appetite (1)" table, the exact drift this shared loader
// exists to prevent.
function isPortfolioEmpty(p: PortfolioSnapshot): boolean {
  return (
    p.decisionsRequired.count === 0 &&
    p.riskOutsideAppetite.outside.count === 0 &&
    p.riskOutsideAppetite.tolerated.count === 0 &&
    p.openConditionsAndBlockers.count === 0 &&
    p.controlChangesInFlight.count === 0 &&
    p.controlChangesImplementedNotTested.count === 0 &&
    p.controlsDueForTesting.count === 0 &&
    p.failedControlTests.count === 0 &&
    p.incidents.open.count === 0 &&
    p.regulatoryCommitments.open.count === 0 &&
    p.overdueActions.count === 0
  );
}

function KpiStrip({ portfolio }: { portfolio: PortfolioSnapshot }) {
  const items: { label: string; value: number }[] = [
    { label: "Decisions Required", value: portfolio.decisionsRequired.count },
    { label: "Outside Appetite", value: portfolio.riskOutsideAppetite.outside.count },
    { label: "Open Conditions/Blockers", value: portfolio.openConditionsAndBlockers.count },
    { label: "Controls Due/Overdue", value: portfolio.controlsDueForTesting.count },
    { label: "Open Incidents", value: portfolio.incidents.open.count },
    { label: "Overdue Actions", value: portfolio.overdueActions.count },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {items.map((kpi) => (
        <div key={kpi.label} className="glass-card rounded-xl p-3.5">
          <p className="text-xs text-text-muted mb-1.5">{kpi.label}</p>
          <div className="text-2xl font-bold text-foreground tabular-nums leading-none">{kpi.value}</div>
        </div>
      ))}
    </div>
  );
}

function GovSection({
  icon: Icon, eyebrow, title, caption, items, emptyMessage,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  caption: string;
  items: PortfolioItem[];
  emptyMessage: string;
}) {
  return (
    <section className="glass-card rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="h-8 w-8 rounded-lg bg-accent/12 text-accent grid place-items-center shrink-0">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted/60">{eyebrow}</p>
            <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
          </div>
        </div>
        <span className="text-xs font-mono tabular-nums text-text-muted shrink-0">{items.length}</span>
      </div>
      <p className="text-xs text-text-muted mb-4 ml-[42px]">{caption}</p>
      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-text-muted">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <GovItemRow key={`${item.subjectType}:${item.id}`} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

interface SubList {
  label: string;
  caption: string;
  items: PortfolioItem[];
  emptyMessage: string;
}

function TwoUpSection({
  icon: Icon, eyebrow, title, left, right,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  left: SubList;
  right: SubList;
}) {
  return (
    <section className="glass-card rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="h-8 w-8 rounded-lg bg-accent/12 text-accent grid place-items-center shrink-0">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted/60">{eyebrow}</p>
          <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <SubListPanel data={left} />
        <SubListPanel data={right} />
      </div>
    </section>
  );
}

function SubListPanel({ data }: { data: SubList }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="text-xs font-semibold text-foreground">{data.label}</h3>
        <span className="text-xs font-mono tabular-nums text-text-muted">{data.items.length}</span>
      </div>
      <p className="text-xs text-text-muted mb-3">{data.caption}</p>
      {data.items.length === 0 ? (
        <p className="py-3 text-center text-xs text-text-muted border border-dashed border-surface-border rounded-lg">{data.emptyMessage}</p>
      ) : (
        <div className="space-y-2">
          {data.items.map((item) => (
            <GovItemRow key={`${item.subjectType}:${item.id}`} item={item} compact />
          ))}
        </div>
      )}
    </div>
  );
}

function IncidentSection({ portfolio }: { portfolio: PortfolioSnapshot }) {
  const { bySeverity, open, pastTarget } = portfolio.incidents;
  return (
    <section className="glass-card rounded-2xl p-5 sm:p-6">
      <div className="flex items-center gap-2.5 mb-1.5">
        <span className="h-8 w-8 rounded-lg bg-accent/12 text-accent grid place-items-center shrink-0">
          <ShieldAlert className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted/60">Assurance</p>
          <h2 className="text-sm font-semibold text-foreground truncate">Open incidents</h2>
        </div>
        <span className="text-xs font-mono tabular-nums text-text-muted ml-auto shrink-0">{open.count}</span>
      </div>
      <p className="text-xs text-text-muted mb-3 ml-[42px]">
        Incidents not yet closed or cancelled, by severity: {(["critical", "high", "medium", "low"] as const).map((s) => `${bySeverity[s]} ${s}`).join(", ")}.
      </p>
      {pastTarget.count > 0 && (
        <p className="text-xs text-red-500 mb-3 ml-[42px]">
          {pastTarget.count} open incident{pastTarget.count === 1 ? "" : "s"} with an overdue remediation action.
        </p>
      )}
      {open.count === 0 ? (
        <p className="py-4 text-center text-sm text-text-muted">No open incidents.</p>
      ) : (
        <div className="space-y-2">
          {open.items.map((item) => (
            <GovItemRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function GovItemRow({ item, compact }: { item: PortfolioItem; compact?: boolean }) {
  const inner = (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <div className="min-w-0">
        <p className={`font-medium text-foreground truncate ${compact ? "text-xs" : "text-sm"}`}>{item.label}</p>
        <p className="text-xs text-text-muted mt-0.5">
          {SUBJECT_TYPE_LABEL[item.subjectType] ?? item.subjectType}
          {item.dueDate ? ` · ${item.dueDateLabel ?? "Due"} ${fmtDate(item.dueDate)}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={URGENCY_VARIANT[item.urgency]}>{URGENCY_LABEL[item.urgency]}</Badge>
        {item.href && <ArrowRight className="h-3.5 w-3.5 text-text-muted" />}
      </div>
    </div>
  );
  const cls = `block rounded-lg border border-surface-border px-3 ${compact ? "py-2" : "py-2.5"} ${item.href ? "hover:bg-surface-hover hover:border-accent/40 transition-colors" : ""}`;

  return item.href ? (
    <Link href={item.href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
