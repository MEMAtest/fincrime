"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Briefcase, Gavel, AlertTriangle, Hourglass, History, ArrowRight, Plus, ClipboardList, ClipboardCheck,
} from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import Badge from "@/components/ui/Badge";
import { PriorityBadge } from "@/components/controls/ControlBits";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";

type AssessmentStatus = "draft" | "in_review" | "approved" | "rejected" | "conditions_applied";

const STATUS_LABEL: Record<AssessmentStatus, string> = {
  draft: "Draft",
  in_review: "In Review",
  approved: "Approved",
  rejected: "Rejected",
  conditions_applied: "Conditions Applied",
};

const STATUS_VARIANT: Record<AssessmentStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  draft: "default",
  in_review: "info",
  approved: "success",
  rejected: "danger",
  conditions_applied: "warning",
};

interface OverviewAssessment {
  id: string;
  productName: string;
  status: AssessmentStatus;
  currentStep: number;
  updatedAt: string;
}

type ActionStatus = "open" | "in_progress" | "done" | "cancelled";
type ConditionStatus = "open" | "met" | "breached";

interface OverviewAction {
  id: string;
  subject_type: string;
  subject_id: string;
  title: string;
  ownerName: string | null;
  due_date: string | null;
  priority: "high" | "medium" | "low";
  status: ActionStatus;
  /** Only set for subject_type "reg_commitment": the reg_request the commitment belongs to (its subject_id is the commitment's own id, not a directly linkable page). */
  requestId?: string | null;
}

interface OverviewCondition {
  id: string;
  description: string;
  ownerName: string | null;
  due_date: string | null;
  status: ConditionStatus;
}

const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

interface OverviewControlDue {
  id: string;
  label: string;
  href: string | null;
  dueDate: string | null;
  urgency: "overdue" | "due_soon" | "info" | string;
}

interface OverviewActivity {
  id: string;
  actor: string;
  verb: string;
  subject_type: string | null;
  created_at: string;
}

interface OverviewResponse {
  assessments: OverviewAssessment[];
  decisionsRequired: OverviewAssessment[];
  overdueActions: OverviewAction[];
  overdueConditions: OverviewCondition[];
  controlsDueForTesting: OverviewControlDue[];
  recentActivity: OverviewActivity[];
}

type FetchState = "loading" | "loaded" | "error";

function fmtDate(iso: string | null): string {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Plain-English rendering of an audit_log verb (e.g. "assessment.created" -> "Assessment created"). */
function describeVerb(verb: string): string {
  const spaced = verb.replace(/[._]/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export default function WorkspacePage() {
  const { workspaceId, ready, wsFetch } = useWorkspace();
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  // Starts as "loading", not "idle": an idle first paint after workspaceId
  // resolves would flash every section's zero-count empty state before the
  // fetch effect runs.
  const [state, setState] = useState<FetchState>("loading");
  // Per-row id -> error message, surfaced next to the failing row rather than
  // resetting the whole page to an error state (one bad PATCH shouldn't hide
  // everything else that loaded fine).
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);

  const loadOverview = useCallback(
    (opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setState("loading");
      return wsFetch("/api/workspace/overview")
        .then(async (res) => {
          if (!res.ok) throw new Error(`Overview fetch failed: ${res.status}`);
          return (await res.json()) as OverviewResponse;
        })
        .then((data) => {
          setOverview(data);
          setState("loaded");
          return true;
        })
        .catch(() => {
          if (!opts.silent) setState("error");
          return false;
        });
    },
    [wsFetch]
  );

  // Only fetch once a workspace already exists; never create one just for
  // visiting this page (a brand-new visitor with no workspace sees the empty
  // state below, not a freshly minted anonymous workspace).
  useEffect(() => {
    if (!ready || !workspaceId) return;
    let cancelled = false;
    setState("loading");
    loadOverview({ silent: true }).then((ok) => {
      if (cancelled) return;
      if (!ok) setState("error");
    });
    return () => {
      cancelled = true;
    };
    // loadOverview intentionally omitted: it is stable across the ready/workspaceId identity that gates this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, workspaceId]);

  const updateActionStatus = async (id: string, status: ActionStatus) => {
    setPendingRowId(id);
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const res = await wsFetch(`/api/workspace/actions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Update failed: ${res.status}`);
      }
      await loadOverview({ silent: true });
    } catch (error) {
      setRowErrors((prev) => ({ ...prev, [id]: error instanceof Error ? error.message : "Update failed" }));
    } finally {
      setPendingRowId(null);
    }
  };

  const updateConditionStatus = async (id: string, status: ConditionStatus) => {
    setPendingRowId(id);
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const res = await wsFetch(`/api/workspace/conditions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Update failed: ${res.status}`);
      }
      await loadOverview({ silent: true });
    } catch (error) {
      setRowErrors((prev) => ({ ...prev, [id]: error instanceof Error ? error.message : "Update failed" }));
    } finally {
      setPendingRowId(null);
    }
  };

  return (
    <ToolFrame>
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <ToolPageHeader
            eyebrow="WORKSPACE"
            title="My"
            titleAccent="Work"
            subtitle="Everything open in your workspace: assessments in progress, decisions waiting on you, and what's overdue. Nothing here is shared until you save it - this workspace is yours alone, kept by an anonymous token in this browser."
            actions={
              <Link
                href="/assess/product-risk/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors"
              >
                <Plus className="h-4 w-4" /> New assessment
              </Link>
            }
          />

          {!ready ? null : !workspaceId ? (
            <EmptyWorkspace />
          ) : state === "error" ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-sm text-text-muted">Could not load your workspace right now. Refresh to try again.</p>
            </div>
          ) : (
            <>
              {/* KPI strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                <Kpi label="Open Assessments" value={overview?.assessments.length} loading={state === "loading"} />
                <Kpi label="Decisions Required" value={overview?.decisionsRequired.length} loading={state === "loading"} />
                <Kpi label="Overdue Actions" value={overview?.overdueActions.length} loading={state === "loading"} />
                <Kpi label="Overdue Conditions" value={overview?.overdueConditions.length} loading={state === "loading"} />
                <Kpi label="Controls Due for Testing" value={overview?.controlsDueForTesting.length} loading={state === "loading"} />
              </div>

              <div className="grid lg:grid-cols-2 gap-5">
                <SectionCard
                  eyebrow="Open work"
                  title="My Work"
                  icon={Briefcase}
                  count={overview?.assessments.length ?? 0}
                  loading={state === "loading"}
                  emptyMessage="No open product risk assessments. Start one to see it here."
                >
                  {overview?.assessments.map((a) => (
                    <AssessmentRow key={a.id} assessment={a} />
                  ))}
                </SectionCard>

                <SectionCard
                  eyebrow="Awaiting sign-off"
                  title="Decisions Required"
                  icon={Gavel}
                  count={overview?.decisionsRequired.length ?? 0}
                  loading={state === "loading"}
                  emptyMessage="No assessments are waiting on a decision."
                >
                  {overview?.decisionsRequired.map((a) => (
                    <AssessmentRow key={a.id} assessment={a} cta="Review & decide" />
                  ))}
                </SectionCard>

                <SectionCard
                  eyebrow="Past due"
                  title="Overdue Actions"
                  icon={AlertTriangle}
                  count={(overview?.overdueActions.length ?? 0) + (overview?.overdueConditions.length ?? 0)}
                  loading={state === "loading"}
                  emptyMessage="Nothing overdue. Actions and conditions with a due date in the past will show up here."
                >
                  {overview?.overdueActions.map((a) => (
                    <ActionRow
                      key={a.id}
                      action={a}
                      pending={pendingRowId === a.id}
                      error={rowErrors[a.id] ?? null}
                      onStatusChange={(status) => updateActionStatus(a.id, status)}
                    />
                  ))}
                  {overview?.overdueConditions.map((c) => (
                    <ConditionRow
                      key={c.id}
                      condition={c}
                      pending={pendingRowId === c.id}
                      error={rowErrors[c.id] ?? null}
                      onStatusChange={(status) => updateConditionStatus(c.id, status)}
                    />
                  ))}
                </SectionCard>

                <SectionCard
                  eyebrow="In progress"
                  title="Assessments in Review"
                  icon={Hourglass}
                  count={overview?.decisionsRequired.length ?? 0}
                  loading={state === "loading"}
                  emptyMessage="No assessments are currently in review."
                >
                  {overview?.decisionsRequired.map((a) => (
                    <AssessmentRow key={a.id} assessment={a} showStep />
                  ))}
                </SectionCard>

                <SectionCard
                  eyebrow="Assurance"
                  title="Controls Due for Testing"
                  icon={ClipboardCheck}
                  count={overview?.controlsDueForTesting.length ?? 0}
                  loading={state === "loading"}
                  emptyMessage="No control is overdue or due for testing in the next 30 days."
                >
                  {overview?.controlsDueForTesting.map((c) => (
                    <ControlDueRow key={c.id} control={c} />
                  ))}
                </SectionCard>
              </div>

              <div className="mt-5">
                <SectionCard
                  eyebrow="Audit trail"
                  title="Recent Activity"
                  icon={History}
                  count={overview?.recentActivity.length ?? 0}
                  loading={state === "loading"}
                  emptyMessage="No activity yet. Every change you make in your workspace is logged here."
                >
                  {overview?.recentActivity.map((entry) => (
                    <ActivityRow key={entry.id} entry={entry} />
                  ))}
                </SectionCard>
              </div>
            </>
          )}
        </div>
      </main>
    </ToolFrame>
  );
}

function EmptyWorkspace() {
  return (
    <div className="glass-card rounded-2xl p-8 text-center max-w-xl mx-auto">
      <span className="h-11 w-11 rounded-xl bg-accent/12 text-accent grid place-items-center mx-auto mb-4">
        <ClipboardList className="h-5 w-5" />
      </span>
      <h2 className="text-xl font-semibold text-foreground mb-2">Nothing in your workspace yet</h2>
      <p className="text-sm text-text-muted mb-6 max-w-md mx-auto leading-relaxed">
        Your workspace tracks product risk assessments, decisions, actions and controls you choose to save. It is
        created automatically the first time you save something, no account required. Start a product risk
        assessment to begin.
      </p>
      <Link
        href="/assess/product-risk/new"
        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors"
      >
        Start a product risk assessment <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function Kpi({ label, value, loading }: { label: string; value: number | undefined; loading: boolean }) {
  return (
    <div className="glass-card rounded-xl p-3.5">
      <p className="text-xs text-text-muted mb-1.5">{label}</p>
      <div className="text-2xl font-bold text-foreground tabular-nums leading-none">
        {loading && value === undefined ? "-" : (value ?? 0)}
      </div>
    </div>
  );
}

function SectionCard({
  eyebrow, title, icon: Icon, count, loading, emptyMessage, children,
}: {
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  count: number;
  loading: boolean;
  emptyMessage: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="glass-card rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="h-8 w-8 rounded-lg bg-accent/12 text-accent grid place-items-center shrink-0">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted/60">{eyebrow}</p>
            <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
          </div>
        </div>
        <span className="text-xs font-mono tabular-nums text-text-muted shrink-0">{loading ? "-" : count}</span>
      </div>
      {loading ? (
        <div className="py-6 text-center text-sm text-text-muted">Loading...</div>
      ) : count === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}

function AssessmentRow({
  assessment, cta, showStep,
}: {
  assessment: OverviewAssessment;
  cta?: string;
  showStep?: boolean;
}) {
  return (
    <Link
      href={`/assess/product-risk/${assessment.id}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-surface-border px-3 py-2.5 hover:bg-surface-hover transition-colors"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{assessment.productName}</p>
        <p className="text-xs text-text-muted mt-0.5">
          {showStep ? `Step ${assessment.currentStep} of 8 · ` : ""}Updated {fmtDate(assessment.updatedAt)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={STATUS_VARIANT[assessment.status]}>{STATUS_LABEL[assessment.status]}</Badge>
        {cta && <span className="hidden sm:inline text-xs font-medium text-accent">{cta}</span>}
      </div>
    </Link>
  );
}

const ACTION_STATUS_OPTIONS: ActionStatus[] = ["open", "in_progress", "done", "cancelled"];

function ActionRow({
  action, pending, error, onStatusChange,
}: {
  action: OverviewAction;
  pending: boolean;
  error: string | null;
  onStatusChange: (status: ActionStatus) => void;
}) {
  const subjectHref =
    action.subject_type === "pra_assessment"
      ? `/assess/product-risk/${action.subject_id}`
      : action.subject_type === "incident"
      ? `/assure/incidents/${action.subject_id}`
      : action.subject_type === "reg_commitment" && action.requestId
      ? `/govern/regulatory-response/${action.requestId}`
      : null;

  const title = subjectHref ? (
    <Link href={subjectHref} className="text-sm font-medium text-foreground truncate hover:underline">
      {action.title}
    </Link>
  ) : (
    <p className="text-sm font-medium text-foreground truncate">{action.title}</p>
  );

  return (
    <div className="rounded-lg border border-surface-border px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {title}
          <p className="text-xs text-red-500 mt-0.5">
            Due {fmtDate(action.due_date)} · {action.ownerName ?? "Unassigned"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PriorityBadge priority={action.priority} />
          <select
            value={action.status}
            disabled={pending}
            onChange={(e) => onStatusChange(e.target.value as ActionStatus)}
            className="px-2 py-1 rounded-md border border-surface-border bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-50"
          >
            {ACTION_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {ACTION_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}

function ConditionRow({
  condition, pending, error, onStatusChange,
}: {
  condition: OverviewCondition;
  pending: boolean;
  error: string | null;
  onStatusChange: (status: ConditionStatus) => void;
}) {
  return (
    <div className="rounded-lg border border-surface-border px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{condition.description}</p>
          <p className="text-xs text-red-500 mt-0.5">
            Due {fmtDate(condition.due_date)} · {condition.ownerName ?? "Unassigned"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="danger">Condition</Badge>
          <button
            type="button"
            disabled={pending}
            onClick={() => onStatusChange("met")}
            className="px-2 py-1 rounded-md border border-surface-border text-xs font-medium text-foreground hover:bg-surface-hover transition-colors disabled:opacity-50 cursor-pointer"
          >
            Met
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onStatusChange("breached")}
            className="px-2 py-1 rounded-md border border-surface-border text-xs font-medium text-red-500 hover:bg-surface-hover transition-colors disabled:opacity-50 cursor-pointer"
          >
            Breached
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}

function ControlDueRow({ control }: { control: OverviewControlDue }) {
  const overdue = control.urgency === "overdue";
  const row = (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-surface-border px-3 py-2.5 hover:bg-surface-hover transition-colors">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{control.label}</p>
        <p className={`text-xs mt-0.5 ${overdue ? "text-red-500" : "text-text-muted"}`}>
          Next test due {fmtDate(control.dueDate)}
        </p>
      </div>
      <Badge variant={overdue ? "danger" : "warning"}>{overdue ? "Overdue" : "Due soon"}</Badge>
    </div>
  );
  return control.href ? (
    <Link href={control.href}>{row}</Link>
  ) : (
    row
  );
}

function ActivityRow({ entry }: { entry: OverviewActivity }) {
  // Rendering `entry.actor` here is the actual fix for "the victim's only
  // signal is a workspace.claimed audit row, and this page did not even
  // render the actor column" - before this, a workspace.claimed event was
  // indistinguishable in this list from any other routine "workspace" -
  // attributed mutation, so a claim by an attacker who obtained a leaked
  // token was invisible even to someone who scrolled straight past this
  // section. A claim event is called out with a distinct badge; every
  // other row still shows who (or "workspace" for the anonymous
  // header-token path) did it, not just what happened.
  const isClaimEvent = entry.verb === "workspace.claimed";
  return (
    <div className={`flex items-center justify-between gap-3 py-2 border-b border-surface-border/60 last:border-0 ${isClaimEvent ? "bg-amber-500/5 -mx-2 px-2 rounded" : ""}`}>
      <div className="min-w-0">
        <p className="text-sm text-foreground truncate">
          {describeVerb(entry.verb)}
          {isClaimEvent && <span className="ml-2 text-xs font-medium text-amber-600">Workspace claimed</span>}
        </p>
        <p className="text-xs text-text-muted mt-0.5 truncate">
          {entry.subject_type ?? "workspace"} &middot; <span className="text-foreground/80">{entry.actor}</span>
        </p>
      </div>
      <span className="text-xs text-text-muted shrink-0">{fmtDateTime(entry.created_at)}</span>
    </div>
  );
}
