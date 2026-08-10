"use client";

import { useMemo, useState } from "react";
import { CATEGORY_ORDER, CATEGORY_TITLE, type CddCategoryKey } from "@/data/kyc/types";
import { summarizeObligations } from "@/lib/readiness/summary";
import {
  READINESS_GAP_LABEL,
  READINESS_GAP_MEANING,
  type ReadinessGap,
  type ReadinessObligationDTO,
  type WorkspaceControlDTO,
} from "./types";

const GAPS: ReadinessGap[] = ["not_assessed", "none", "partial", "full"];

function isKnownCategory(c: string): c is CddCategoryKey {
  return (CATEGORY_ORDER as string[]).includes(c);
}

export interface ObligationControlPatch {
  workspaceControlId?: string | null;
  controlNote?: string | null;
  gap?: ReadinessGap;
}

interface StepControlsProps {
  obligations: ReadinessObligationDTO[];
  controls: WorkspaceControlDTO[];
  readOnly: boolean;
  onSave: (obligationId: string, patch: ObligationControlPatch) => Promise<{ ok: true } | { ok: false; message: string }>;
}

/**
 * Step 3: maps each obligation to a workspace control, an optional control
 * note, and a gap classification (not_assessed/none/partial/full - the same
 * enum the approval guard checks). Running coverage is the count of
 * obligations at gap = 'full' over the total, matching
 * lib/readiness/summary.ts's coveragePct exactly so this step's number never
 * drifts from what the header strip and the approval step show.
 */
export default function StepControls({ obligations, controls, readOnly, onSave }: StepControlsProps) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  const grouped = useMemo(() => {
    const byCategory = new Map<string, ReadinessObligationDTO[]>();
    for (const o of obligations) {
      const bucket = byCategory.get(o.category);
      if (bucket) bucket.push(o);
      else byCategory.set(o.category, [o]);
    }
    const knownOrder = CATEGORY_ORDER.filter((c) => byCategory.has(c));
    const unknownOrder = [...byCategory.keys()].filter((c) => !isKnownCategory(c));
    return [...knownOrder, ...unknownOrder].map((c) => ({
      key: c,
      title: isKnownCategory(c) ? CATEGORY_TITLE[c] : c,
      items: (byCategory.get(c) ?? []).sort((a, b) => a.title.localeCompare(b.title)),
    }));
  }, [obligations]);

  const coverageSummary = useMemo(() => summarizeObligations(obligations), [obligations]);
  const fullCount = coverageSummary.byGap.full;
  const coveragePct = coverageSummary.coveragePct;

  async function commit(obligationId: string, patch: ObligationControlPatch) {
    setSavingId(obligationId);
    setErrorById((prev) => ({ ...prev, [obligationId]: "" }));
    try {
      const result = await onSave(obligationId, patch);
      if (!result.ok) setErrorById((prev) => ({ ...prev, [obligationId]: result.message }));
    } finally {
      setSavingId((id) => (id === obligationId ? null : id));
    }
  }

  if (obligations.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-1">Controls</h2>
          <p className="text-sm text-text-muted">Generate the obligation register in the previous step first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-1">Controls</h2>
          <p className="text-sm text-text-muted">
            Map each obligation to the control that satisfies it, and classify how well it currently does so.
          </p>
        </div>
        <div className="glass-card rounded-xl px-4 py-2.5 text-right shrink-0">
          <p className="text-2xl font-bold text-foreground">{coveragePct}%</p>
          <p className="text-xs text-text-muted">coverage ({fullCount} of {obligations.length} full)</p>
        </div>
      </div>

      <div className="space-y-6">
        {grouped.map((group) => (
          <div key={group.key}>
            <h3 className="text-sm font-semibold text-foreground mb-2">{group.title}</h3>
            <div className="space-y-3">
              {group.items.map((o) => (
                <div key={o.id} className="glass-card rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">{o.title}</p>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-ink-soft">Mapped control</label>
                      <select
                        key={`${o.id}-control`}
                        defaultValue={o.workspace_control_id ?? ""}
                        disabled={readOnly}
                        onChange={(e) => void commit(o.id, { workspaceControlId: e.target.value || null })}
                        className="px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-60"
                      >
                        <option value="">Not mapped</option>
                        {controls.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-ink-soft">Gap classification</label>
                      <select
                        key={`${o.id}-gap`}
                        defaultValue={o.gap}
                        disabled={readOnly}
                        onChange={(e) => void commit(o.id, { gap: e.target.value as ReadinessGap })}
                        className="px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-60"
                      >
                        {GAPS.map((g) => (
                          <option key={g} value={g}>
                            {READINESS_GAP_LABEL[g]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="text-xs text-text-muted">{READINESS_GAP_MEANING[o.gap]}</p>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-ink-soft">Control note (optional)</label>
                    <textarea
                      key={`${o.id}-note`}
                      defaultValue={o.control_note ?? ""}
                      disabled={readOnly}
                      rows={2}
                      placeholder="How does the mapped control satisfy this obligation, and where does it fall short?"
                      onBlur={(e) => {
                        const v = e.target.value.trim() || null;
                        if (v !== o.control_note) void commit(o.id, { controlNote: v });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors disabled:opacity-60"
                    />
                  </div>

                  {savingId === o.id && <p className="text-xs text-text-muted">Saving...</p>}
                  {errorById[o.id] && <p className="text-xs text-red-500">{errorById[o.id]}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
