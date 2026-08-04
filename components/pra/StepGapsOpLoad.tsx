"use client";

import { useMemo, useRef } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { scoreOperationalLoad, summariseOperationalLoad, DEFAULT_HOURLY_COST_GBP } from "@/data/scoring/operational-load";
import { computeGaps, opLoadInputFromControl, resolveControlLabel } from "./journeyCompute";
import type { AssessmentControlDTO, AssessmentRiskDTO, WorkspaceControlDTO } from "./types";
import type { UpdateControlInput } from "./StepControlMapping";

interface StepGapsOpLoadProps {
  risks: AssessmentRiskDTO[];
  controls: AssessmentControlDTO[];
  workspaceControls: WorkspaceControlDTO[];
  onUpdateControl: (id: string, input: UpdateControlInput) => Promise<void>;
}

function parseOptionalNumber(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Step 5: the gap register auto-derived from the control map, plus a per-control operational-load calculator with a live aggregate panel. */
export default function StepGapsOpLoad({ risks, controls, workspaceControls, onUpdateControl }: StepGapsOpLoadProps) {
  const workspaceControlById = useMemo(
    () => new Map(workspaceControls.map((c) => [c.id, c])),
    [workspaceControls]
  );

  const gaps = useMemo(
    () => computeGaps(risks, controls, workspaceControlById),
    [risks, controls, workspaceControlById]
  );

  const opLoadSummary = useMemo(
    () => summariseOperationalLoad(controls.map(opLoadInputFromControl)),
    [controls]
  );

  const saveOpLoad = (controlId: string, opLoad: Record<string, unknown>) => {
    void onUpdateControl(controlId, { opLoad });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Gaps &amp; operational impact</h2>
        <p className="text-sm text-text-muted">
          The gap register is derived automatically from the control map: risks with nothing attached, and any
          individual attachment marked &quot;gap&quot; coverage. For every attached control, estimate the monthly
          volume, alert rate and handling time to see the analyst hours, headcount and cost it implies.
        </p>
      </div>

      {/* Gap register */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Gap register ({gaps.length})</h3>
        {gaps.length === 0 ? (
          <div className="glass-card rounded-xl p-5 flex items-center gap-3 text-sm text-text-muted">
            <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
            No coverage gaps found. Every risk has at least one attached control with better than &quot;gap&quot;
            coverage.
          </div>
        ) : (
          <div className="space-y-2">
            {gaps.map((gap) => (
              <div
                key={gap.key}
                className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm"
              >
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-red-700">{gap.riskTitle}</p>
                  <p className="text-red-600/80 text-xs mt-0.5">
                    {gap.kind === "no_controls"
                      ? "No controls attached to this risk."
                      : `"${gap.controlLabel}" is attached with gap coverage.`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Aggregate operational load */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Operational load (all attached controls)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <OpLoadKpi label="Alerts / month" value={opLoadSummary.totals.alertsPerMonth} />
          <OpLoadKpi label="Analyst hours / month" value={opLoadSummary.totals.analystHoursPerMonth} />
          <OpLoadKpi label="FTE required" value={opLoadSummary.totals.fte} />
          <OpLoadKpi label="Monthly cost" value={opLoadSummary.totals.monthlyCostGbp} prefix="£" />
        </div>
      </div>

      {/* Per-control inputs, grouped by risk */}
      <div className="space-y-4">
        {risks.map((risk) => {
          const attached = controls.filter((c) => c.risk_id === risk.id);
          if (attached.length === 0) return null;
          return (
            <div key={risk.id} className="glass-card rounded-xl p-5">
              <p className="text-sm font-medium text-foreground mb-3">{risk.title}</p>
              <div className="space-y-3">
                {/* Keyed on id only: keying on updated_at remounts the row after every
                    blur-save and discards whatever the user is typing in the next field. */}
                {attached.map((control) => (
                  <ControlOpLoadRow
                    key={control.id}
                    control={control}
                    label={resolveControlLabel(control, workspaceControlById)}
                    onSave={saveOpLoad}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {controls.length === 0 && (
          <div className="glass-card rounded-xl p-6 text-center text-sm text-text-muted">
            No controls attached yet. Go back to Control mapping to attach controls before estimating operational
            load.
          </div>
        )}
      </div>
    </div>
  );
}

function OpLoadKpi({ label, value, prefix = "" }: { label: string; value: number; prefix?: string }) {
  return (
    <div className="glass-card rounded-xl p-3.5">
      <p className="text-xs text-text-muted mb-1.5">{label}</p>
      <div className="text-2xl font-bold text-foreground tabular-nums leading-none">
        {prefix}
        {value.toLocaleString("en-GB", { maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}

function ControlOpLoadRow({
  control,
  label,
  onSave,
}: {
  control: AssessmentControlDTO;
  label: string;
  onSave: (controlId: string, opLoad: Record<string, unknown>) => void;
}) {
  const opLoad = (control.op_load ?? {}) as Record<string, unknown>;
  // Local draft of the whole op_load object: each blur PATCHes op_load
  // wholesale, so building from a ref (not the possibly stale control prop)
  // stops a fast tab-through from dropping the previous field's value while
  // its response is still in flight.
  const draft = useRef<Record<string, unknown>>({ ...opLoad });
  const saveField = (field: string, raw: string) => {
    const value = parseOptionalNumber(raw);
    if (value === undefined) delete draft.current[field];
    else draft.current[field] = value;
    onSave(control.id, { ...draft.current });
  };
  const result = scoreOperationalLoad(opLoadInputFromControl(control));
  const inputCls =
    "w-full px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors";

  return (
    <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/10">
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <p className="text-sm text-foreground truncate">{label}</p>
        <span className="text-xs text-text-muted shrink-0">
          {result.alertsPerMonth.toLocaleString("en-GB")} alerts/mo &middot; {result.analystHoursPerMonth.toLocaleString("en-GB")}h &middot; £
          {result.monthlyCostGbp.toLocaleString("en-GB")}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Field
          label="Monthly volume"
          defaultValue={typeof opLoad.monthlyVolume === "number" ? String(opLoad.monthlyVolume) : ""}
          onBlur={(v) => saveField("monthlyVolume", v)}
          className={inputCls}
        />
        <Field
          label="Alert rate (%)"
          defaultValue={typeof opLoad.alertRatePct === "number" ? String(opLoad.alertRatePct) : ""}
          onBlur={(v) => saveField("alertRatePct", v)}
          className={inputCls}
        />
        <Field
          label="Handling (mins)"
          defaultValue={typeof opLoad.handlingMinutes === "number" ? String(opLoad.handlingMinutes) : ""}
          onBlur={(v) => saveField("handlingMinutes", v)}
          className={inputCls}
        />
        <Field
          label={`Hourly cost (£, default ${DEFAULT_HOURLY_COST_GBP})`}
          defaultValue={typeof opLoad.hourlyCostGbp === "number" ? String(opLoad.hourlyCostGbp) : ""}
          onBlur={(v) => saveField("hourlyCostGbp", v)}
          className={inputCls}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  defaultValue,
  onBlur,
  className,
}: {
  label: string;
  defaultValue: string;
  onBlur: (value: string) => void;
  className: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
      <input
        type="number"
        min={0}
        defaultValue={defaultValue}
        onBlur={(e) => onBlur(e.target.value)}
        className={className}
      />
    </label>
  );
}
