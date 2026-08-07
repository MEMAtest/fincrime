"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { RATING_ORDER } from "@/components/controls/ControlBits";
import { DEFAULT_HOURLY_COST_GBP, scoreOperationalLoad, type OperationalLoadResult } from "@/data/scoring/operational-load";
import type { ControlRating } from "@/data/controls/types";
import type { ControlChangeDTO } from "./types";

interface StepImpactProps {
  change: ControlChangeDTO;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Step 4: operational, risk and customer impact. Before/after analyst hours,
 * FTE and cost are computed with data/scoring/operational-load.ts's
 * scoreOperationalLoad - the alert volumes captured in Step 3
 * (baselineAlertVolume/expectedVolume) are already alert counts, not raw
 * transaction volume, so they are passed through as monthlyVolume with
 * alertRatePct fixed at 100 rather than reimplementing the volume->alert
 * arithmetic that module already owns.
 */
export default function StepImpact({ change, onSave }: StepImpactProps) {
  const supportingData = change.supporting_data;
  const baselineAlertVolume = numberOrNull(supportingData.baselineAlertVolume);
  const expectedVolume = numberOrNull(supportingData.expectedVolume);

  const impact = change.impact;
  const [handlingMinutes, setHandlingMinutes] = useState<number | "">(
    typeof impact.handlingMinutes === "number" ? impact.handlingMinutes : ""
  );
  const [hourlyCostGbp, setHourlyCostGbp] = useState<number | "">(
    typeof impact.hourlyCostGbp === "number" ? impact.hourlyCostGbp : ""
  );
  const [customerFrictionNotes, setCustomerFrictionNotes] = useState(
    typeof impact.customerFrictionNotes === "string" ? impact.customerFrictionNotes : ""
  );
  const [riskImpactNotes, setRiskImpactNotes] = useState(
    typeof impact.riskImpactNotes === "string" ? impact.riskImpactNotes : ""
  );
  const [saving, setSaving] = useState(false);

  const before: OperationalLoadResult | null = useMemo(() => {
    if (baselineAlertVolume === null || handlingMinutes === "") return null;
    return scoreOperationalLoad({
      monthlyVolume: baselineAlertVolume,
      alertRatePct: 100,
      handlingMinutes,
      hourlyCostGbp: hourlyCostGbp === "" ? DEFAULT_HOURLY_COST_GBP : hourlyCostGbp,
    });
  }, [baselineAlertVolume, handlingMinutes, hourlyCostGbp]);

  const after: OperationalLoadResult | null = useMemo(() => {
    if (expectedVolume === null || handlingMinutes === "") return null;
    return scoreOperationalLoad({
      monthlyVolume: expectedVolume,
      alertRatePct: 100,
      handlingMinutes,
      hourlyCostGbp: hourlyCostGbp === "" ? DEFAULT_HOURLY_COST_GBP : hourlyCostGbp,
    });
  }, [expectedVolume, handlingMinutes, hourlyCostGbp]);

  const baselineRating = (change.baseline.effectivenessRating as ControlRating | null | undefined) ?? "not_assessed";
  const proposedRating = (change.proposed.effectivenessRating as ControlRating | null | undefined) ?? baselineRating;
  const effectivenessLowered = RATING_ORDER.indexOf(proposedRating) < RATING_ORDER.indexOf(baselineRating);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        handlingMinutes: handlingMinutes === "" ? null : handlingMinutes,
        hourlyCostGbp: hourlyCostGbp === "" ? null : hourlyCostGbp,
        customerFrictionNotes: customerFrictionNotes.trim() || null,
        riskImpactNotes: riskImpactNotes.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Impact</h2>
        <p className="text-sm text-text-muted">
          Operational load before and after, plus customer and risk impact. This uses the alert volumes you recorded
          in Supporting data.
        </p>
      </div>

      {effectivenessLowered && (
        <div className="glass-card rounded-xl p-4 flex items-start gap-2.5 bg-amber-50/60 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            This change proposes lowering the control&apos;s effectiveness rating from {baselineRating.replace("_", " ")} to{" "}
            {proposedRating.replace("_", " ")}. Make sure the risk impact below covers why that&apos;s acceptable.
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Input
          type="number"
          label="Analyst minutes per alert"
          value={handlingMinutes}
          onChange={(e) => setHandlingMinutes(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="e.g. 15"
        />
        <Input
          type="number"
          label={`Hourly analyst cost, £ (default £${DEFAULT_HOURLY_COST_GBP})`}
          value={hourlyCostGbp}
          onChange={(e) => setHourlyCostGbp(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder={String(DEFAULT_HOURLY_COST_GBP)}
        />
      </div>

      {(baselineAlertVolume === null || expectedVolume === null) && (
        <p className="text-xs text-text-muted">
          Record baseline and expected alert volumes on the Supporting data step to see operational load figures here.
        </p>
      )}

      {before && after && (
        <div className="grid sm:grid-cols-3 gap-3">
          <ImpactKpi label="Analyst hours / month" before={before.analystHoursPerMonth} after={after.analystHoursPerMonth} />
          <ImpactKpi label="FTE required" before={before.fte} after={after.fte} decimals />
          <ImpactKpi label="Monthly cost" before={before.monthlyCostGbp} after={after.monthlyCostGbp} prefix="£" />
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink-soft">Customer friction notes</label>
          <textarea
            value={customerFrictionNotes}
            onChange={(e) => setCustomerFrictionNotes(e.target.value)}
            rows={3}
            placeholder="Will this change add friction, delay or false declines for customers?"
            className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink-soft">Risk impact notes</label>
          <textarea
            value={riskImpactNotes}
            onChange={(e) => setRiskImpactNotes(e.target.value)}
            rows={3}
            placeholder="What is the financial crime risk impact of this change, and why is it acceptable?"
            className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
          />
        </div>
      </div>

      <Button onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save impact"}
      </Button>
    </div>
  );
}

function ImpactKpi({
  label,
  before,
  after,
  prefix = "",
  decimals = false,
}: {
  label: string;
  before: number;
  after: number;
  prefix?: string;
  decimals?: boolean;
}) {
  const delta = after - before;
  const up = delta > 0;
  const fmt = (v: number) => `${prefix}${v.toLocaleString("en-GB", { maximumFractionDigits: decimals ? 2 : 2 })}`;
  return (
    <div className="glass-card rounded-xl p-4">
      <p className="text-xs text-text-muted mb-2">{label}</p>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-text-muted">{fmt(before)}</span>
        <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
        <span className="text-foreground font-semibold">{fmt(after)}</span>
      </div>
      {delta !== 0 && (
        <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${up ? "text-red-500" : "text-accent"}`}>
          {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {up ? "+" : ""}
          {fmt(delta)}
        </div>
      )}
    </div>
  );
}
