"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import type { ControlChangeDTO, PersonDTO } from "./types";

interface MonitoringRow {
  key: string;
  metric: string;
  target: string;
  ownerPersonId: string;
  reviewDate: string;
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

interface StepMonitoringProps {
  change: ControlChangeDTO;
  people: PersonDTO[];
  onSave: (data: Record<string, unknown>) => Promise<void>;
}

/**
 * Step 6: the 30/60/90-day monitoring plan. Persisted entirely as
 * control_changes.monitoring JSONB (an array of {metric, target,
 * ownerPersonId, reviewDate} rows) - there is no dedicated monitoring/review
 * API in this round, and no generic "create an action against an arbitrary
 * date" endpoint either, so review dates stay data on the change rather than
 * spawning follow-up action rows the way Step 5's decision conditions/actions
 * do. If a future round wants monitoring reviews to show up in a task list,
 * that needs a new endpoint (out of scope here - not invented against the
 * plan's instruction not to add new API routes).
 */
export default function StepMonitoring({ change, people, onSave }: StepMonitoringProps) {
  const [rows, setRows] = useState<MonitoringRow[]>(() => rowsFromMonitoring(change.monitoring));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const addRow = (label = "", reviewDate = "") =>
    setRows((prev) => [...prev, { key: makeKey(), metric: label, target: "", ownerPersonId: "", reviewDate }]);

  const addSuggested = () => {
    SUGGESTED_OFFSETS.forEach((s) => addRow(s.label, isoDaysFromNow(s.days)));
  };

  const save = async () => {
    setSaving(true);
    setSavedAt(null);
    try {
      const cleaned = rows
        .filter((r) => r.metric.trim())
        .map((r) => ({
          metric: r.metric.trim(),
          target: r.target.trim(),
          ownerPersonId: r.ownerPersonId || null,
          reviewDate: r.reviewDate || null,
        }));
      await onSave({ rows: cleaned });
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
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

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save monitoring plan"}
        </Button>
        {savedAt && <span className="text-xs text-text-muted">Saved.</span>}
      </div>
    </div>
  );
}
