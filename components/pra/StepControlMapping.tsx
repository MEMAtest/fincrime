"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Search, Sparkles, Trash2 } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { allControls, controlsForTypology, getControlBySlug, type Control } from "@/data/controls";
import type { AssessmentControlDTO, AssessmentRiskDTO, ControlCoverage } from "./types";

const COVERAGE_LABEL: Record<ControlCoverage, string> = { full: "Full", partial: "Partial", gap: "Gap" };
const COVERAGE_VARIANT: Record<ControlCoverage, "success" | "warning" | "danger"> = {
  full: "success",
  partial: "warning",
  gap: "danger",
};
const COVERAGE_OPTIONS: ControlCoverage[] = ["full", "partial", "gap"];

export interface CreateControlInput {
  riskId: string;
  controlSlug?: string | null;
  workspaceControlId?: string | null;
  coverage: ControlCoverage;
  instantiate?: boolean;
}

export interface UpdateControlInput {
  coverage?: ControlCoverage;
  instantiate?: boolean;
  // Written by Step 5 (StepGapsOpLoad): the per-control operational-load
  // inputs (monthlyVolume/alertRatePct/handlingMinutes/hourlyCostGbp), stored
  // as-is in assessment_controls.op_load.
  opLoad?: Record<string, unknown>;
}

interface StepControlMappingProps {
  risks: AssessmentRiskDTO[];
  controls: AssessmentControlDTO[];
  onCreateControl: (input: CreateControlInput) => Promise<void>;
  onUpdateControl: (id: string, input: UpdateControlInput) => Promise<void>;
  onDeleteControl: (id: string) => Promise<void>;
}

/** Step 4: per-risk control picker over the library, with coverage and an "instantiate to live control" path. */
export default function StepControlMapping({
  risks,
  controls,
  onCreateControl,
  onUpdateControl,
  onDeleteControl,
}: StepControlMappingProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Control mapping</h2>
        <p className="text-sm text-text-muted">
          Attach controls to each risk from the 41-control library and mark how much of the risk each one covers.
          A risk with no attached controls is flagged as a gap.
        </p>
      </div>

      {risks.length === 0 && (
        <div className="glass-card rounded-xl p-6 text-center text-sm text-text-muted">
          No risks to map yet. Go back to Inherent risks and add at least one first.
        </div>
      )}

      <div className="space-y-4">
        {risks.map((risk) => (
          <RiskControlCard
            key={risk.id}
            risk={risk}
            attached={controls.filter((c) => c.risk_id === risk.id)}
            onCreateControl={onCreateControl}
            onUpdateControl={onUpdateControl}
            onDeleteControl={onDeleteControl}
          />
        ))}
      </div>
    </div>
  );
}

function RiskControlCard({
  risk,
  attached,
  onCreateControl,
  onUpdateControl,
  onDeleteControl,
}: {
  risk: AssessmentRiskDTO;
  attached: AssessmentControlDTO[];
  onCreateControl: (input: CreateControlInput) => Promise<void>;
  onUpdateControl: (id: string, input: UpdateControlInput) => Promise<void>;
  onDeleteControl: (id: string) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const attachedSlugs = useMemo(
    () => new Set(attached.map((c) => c.control_slug).filter((s): s is string => !!s)),
    [attached]
  );

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matchesTerm = (c: Control) =>
      !term || c.name.toLowerCase().includes(term) || c.plainSummary.toLowerCase().includes(term);
    const scoped = risk.typology_slug ? controlsForTypology(risk.typology_slug) : [];
    let list = scoped.filter(matchesTerm);
    if (list.length === 0) list = allControls.filter(matchesTerm);
    return list.filter((c) => !attachedSlugs.has(c.slug)).slice(0, 8);
  }, [search, risk.typology_slug, attachedSlugs]);

  const attach = async (slug: string) => {
    setPendingSlug(slug);
    try {
      await onCreateControl({ riskId: risk.id, controlSlug: slug, coverage: "partial" });
    } finally {
      setPendingSlug(null);
    }
  };

  const instantiate = async (id: string) => {
    setPendingId(id);
    try {
      await onUpdateControl(id, { instantiate: true });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-medium text-foreground">{risk.title}</p>
          {risk.typology_slug && <p className="text-xs text-text-muted mt-0.5">Typology: {risk.typology_slug}</p>}
        </div>
        {attached.length === 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-medium shrink-0">
            <AlertTriangle className="h-3.5 w-3.5" /> Gap: no controls attached
          </span>
        )}
      </div>

      {attached.length > 0 && (
        <div className="space-y-2 mb-4">
          {attached.map((c) => {
            const libraryControl = c.control_slug ? getControlBySlug(c.control_slug) : undefined;
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/10"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">
                    {libraryControl?.name ?? c.control_slug ?? "Custom control"}
                  </p>
                  <p className="text-xs text-text-muted">
                    {c.workspace_control_id ? "Live workspace control" : "Reference only"}
                  </p>
                </div>
                <select
                  value={c.coverage}
                  onChange={(e) => void onUpdateControl(c.id, { coverage: e.target.value as ControlCoverage })}
                  className="px-2 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                >
                  {COVERAGE_OPTIONS.map((cov) => (
                    <option key={cov} value={cov}>
                      {COVERAGE_LABEL[cov]}
                    </option>
                  ))}
                </select>
                <Badge variant={COVERAGE_VARIANT[c.coverage]}>{COVERAGE_LABEL[c.coverage]}</Badge>
                {!c.workspace_control_id && c.control_slug && (
                  <button
                    type="button"
                    onClick={() => void instantiate(c.id)}
                    disabled={pendingId === c.id}
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="h-3 w-3" /> Instantiate
                  </button>
                )}
                {c.workspace_control_id && (
                  <Link
                    href={`/change-lab/new?controlId=${c.workspace_control_id}`}
                    className="text-xs font-medium text-accent hover:underline shrink-0"
                  >
                    Propose a change
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => void onDeleteControl(c.id)}
                  aria-label="Remove control"
                  className="text-text-muted hover:text-red-500 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <div className="relative mb-2">
          <Search className="h-3.5 w-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the 41-control library..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>
        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {results.map((c) => (
            <div key={c.slug} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/[0.03]">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                <p className="text-[11px] text-text-muted truncate">{c.plainSummary}</p>
              </div>
              <button
                type="button"
                onClick={() => void attach(c.slug)}
                disabled={pendingSlug === c.slug}
                className="shrink-0 px-2.5 py-1 rounded-lg border border-line-2 text-xs text-foreground hover:border-accent/40 disabled:opacity-50 cursor-pointer"
              >
                Attach
              </button>
            </div>
          ))}
          {results.length === 0 && <p className="text-xs text-text-muted px-2 py-3">No matching controls.</p>}
        </div>
      </div>
    </div>
  );
}
