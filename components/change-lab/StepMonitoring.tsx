"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import Button from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import type { ControlChangeDTO, PersonDTO } from "./types";

interface MonitoringRow {
  key: string;
  metric: string;
  target: string;
  ownerPersonId: string;
  reviewDate: string;
  /** Id of the actions row created from this monitoring row, if any - see "Create review actions" below. */
  actionId: string | null;
  actionCreatedAt: string | null;
}

let tempIdCounter = 0;
function makeKey(): string {
  tempIdCounter += 1;
  return `row-${tempIdCounter}-${Date.now()}`;
}

function rowsFromMonitoring(monitoring: Record<string, unknown>): MonitoringRow[] {
  const raw = Array.isArray(monitoring.rows) ? monitoring.rows : [];
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      key: makeKey(),
      metric: typeof r.metric === "string" ? r.metric : "",
      target: typeof r.target === "string" ? r.target : "",
      ownerPersonId: typeof r.ownerPersonId === "string" ? r.ownerPersonId : "",
      reviewDate: typeof r.reviewDate === "string" ? r.reviewDate : "",
      actionId: typeof r.actionId === "string" ? r.actionId : null,
      actionCreatedAt: typeof r.actionCreatedAt === "string" ? r.actionCreatedAt : null,
    }));
}

const SUGGESTED_OFFSETS = [
  { label: "30-day review", days: 30 },
  { label: "60-day review", days: 60 },
  { label: "90-day review", days: 90 },
];

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Rough "N day" label for an action title, computed from today to the review date - not tied to the 30/60/90 suggestions, so it also makes sense for a manually added row. */
function daysFromToday(reviewDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${reviewDate}T00:00:00`);
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
}

interface StepMonitoringProps {
  change: ControlChangeDTO;
  people: PersonDTO[];
  onSave: (data: Record<string, unknown>) => Promise<void>;
}

function serialiseRows(rows: MonitoringRow[]) {
  return rows
    .filter((r) => r.metric.trim())
    .map((r) => ({
      metric: r.metric.trim(),
      target: r.target.trim(),
      ownerPersonId: r.ownerPersonId || null,
      reviewDate: r.reviewDate || null,
      actionId: r.actionId,
      actionCreatedAt: r.actionCreatedAt,
    }));
}

/**
 * Step 6: the 30/60/90-day monitoring plan. Persisted as control_changes.monitoring
 * JSONB (an array of {metric, target, ownerPersonId, reviewDate, actionId,
 * actionCreatedAt} rows) - the JSONB stays the plan of record. Rows with a
 * review date can also spawn a real, trackable actions-table row via
 * POST /api/workspace/actions (subjectType "control_change"); actionId is
 * stamped back onto the row so re-clicking "Create review actions" never
 * duplicates one already created.
 */
export default function StepMonitoring({ change, people, onSave }: StepMonitoringProps) {
  const { wsFetch } = useWorkspace();
  const [rows, setRows] = useState<MonitoringRow[]>(() => rowsFromMonitoring(change.monitoring));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [creatingActions, setCreatingActions] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const addRow = (label = "", reviewDate = "") =>
    setRows((prev) => [
      ...prev,
      { key: makeKey(), metric: label, target: "", ownerPersonId: "", reviewDate, actionId: null, actionCreatedAt: null },
    ]);

  const addSuggested = () => {
    SUGGESTED_OFFSETS.forEach((s) => addRow(s.label, isoDaysFromNow(s.days)));
  };

  const save = async () => {
    setSaving(true);
    setSavedAt(null);
    try {
      await onSave({ rows: serialiseRows(rows) });
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  };

  const eligibleForAction = rows.filter((r) => r.metric.trim() && r.reviewDate && !r.actionId);

  const createReviewActions = async () => {
    if (eligibleForAction.length === 0) return;
    setCreatingActions(true);
    setActionFeedback(null);

    // Persist the plan first, so a review action always points at a change
    // whose monitoring rows are up to date.
    await save();

    let created = 0;
    let failed = 0;
    const updates = new Map<string, { actionId: string; actionCreatedAt: string }>();

    for (const row of eligibleForAction) {
      try {
        const days = daysFromToday(row.reviewDate);
        const res = await wsFetch("/api/workspace/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subjectType: "control_change",
            subjectId: change.id,
            title: `Review: ${row.metric.trim()} (${days} day)`,
            ownerPersonId: row.ownerPersonId || null,
            dueDate: row.reviewDate,
            priority: "medium",
          }),
        });
        if (!res.ok) {
          failed += 1;
          continue;
        }
        const data = await res.json();
        updates.set(row.key, { actionId: data.action.id, actionCreatedAt: new Date().toISOString() });
        created += 1;
      } catch {
        failed += 1;
      }
    }

    if (updates.size > 0) {
      const nextRows = rows.map((r) => {
        const update = updates.get(r.key);
        return update ? { ...r, actionId: update.actionId, actionCreatedAt: update.actionCreatedAt } : r;
      });
      setRows(nextRows);
      // Persist the actionId/actionCreatedAt stamps immediately, so a page
      // refresh (or leaving this step) still shows these rows as done and a
      // second click of "Create review actions" can never duplicate them.
      await onSave({ rows: serialiseRows(nextRows) });
    }

    setCreatingActions(false);

    if (created > 0 && failed === 0) {
      setActionFeedback({ ok: true, message: `Created ${created} review action${created === 1 ? "" : "s"}.` });
    } else if (created > 0 && failed > 0) {
      setActionFeedback({ ok: false, message: `Created ${created}, but ${failed} failed. Try again for the remaining rows.` });
    } else {
      setActionFeedback({ ok: false, message: "Could not create review actions. Try again." });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Monitoring plan</h2>
        <p className="text-sm text-text-muted">
          Track this change after it goes live: which metrics to watch, the target or threshold that means it&apos;s
          working, who owns each review, and when it&apos;s due.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={addSuggested}
          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline cursor-pointer"
        >
          <Plus className="h-3 w-3" /> Add 30/60/90-day reviews
        </button>
        <button
          type="button"
          onClick={() => addRow()}
          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline cursor-pointer"
        >
          <Plus className="h-3 w-3" /> Add row
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/10">
            <input
              value={r.metric}
              onChange={(e) => setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, metric: e.target.value } : x)))}
              placeholder="Metric (e.g. Alert volume, FP rate)"
              className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
            <input
              value={r.target}
              onChange={(e) => setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, target: e.target.value } : x)))}
              placeholder="Target / threshold"
              className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
            <select
              value={r.ownerPersonId}
              onChange={(e) => setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, ownerPersonId: e.target.value } : x)))}
              className="px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            >
              <option value="">Owner...</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={r.reviewDate}
              onChange={(e) => setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, reviewDate: e.target.value } : x)))}
              className="px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
            {r.actionId ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent whitespace-nowrap">
                <CheckCircle2 className="h-3 w-3" /> Action created
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
              aria-label="Remove row"
              className="text-text-muted hover:text-red-500 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-text-muted">No monitoring rows yet.</p>}
      </div>

      {rows.some((r) => r.ownerPersonId) && (
        <p className="text-xs text-text-muted">
          Owners:{" "}
          {rows
            .filter((r) => r.ownerPersonId)
            .map((r) => personById.get(r.ownerPersonId)?.name ?? "Unknown")
            .join(", ")}
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save monitoring plan"}
        </Button>
        {savedAt && !creatingActions && <span className="text-xs text-text-muted">Saved.</span>}
      </div>

      <div className="pt-2 border-t border-white/10 space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="secondary"
            onClick={async () => {
              await createReviewActions();
            }}
            disabled={creatingActions || eligibleForAction.length === 0}
          >
            {creatingActions
              ? "Creating..."
              : eligibleForAction.length === 0
                ? "All reviews have actions"
                : `Create review actions (${eligibleForAction.length})`}
          </Button>
          <p className="text-xs text-text-muted max-w-sm">
            Creates a trackable action for each row above with a review date, so it shows up on the workspace home
            until it&apos;s closed out. Rows that already have an action are skipped.
          </p>
        </div>
        {actionFeedback && (
          <div className={`flex items-center gap-2 text-sm ${actionFeedback.ok ? "text-accent" : "text-red-500"}`}>
            {actionFeedback.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <span>{actionFeedback.message}</span>
            {actionFeedback.ok && (
              <Link href="/workspace" className="inline-flex items-center gap-1 text-xs font-medium hover:underline">
                View in workspace <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
