"use client";

import { useMemo } from "react";
import { CheckCircle2, AlertTriangle, ShieldAlert, ArrowRight } from "lucide-react";
import RiskRatingBadge from "@/components/shared/RiskRatingBadge";
import { RatingSelect } from "@/components/controls/ControlBits";
import { getRiskRating } from "@/data/scoring/risk-matrix";
import type { AppetiteThresholds } from "@/data/scoring/residual-risk";
import type { ControlRating } from "@/data/controls/types";
import { computeAssessmentResidual, resolveControlLabel, type RiskResidual } from "./journeyCompute";
import type { AssessmentControlDTO, AssessmentRiskDTO, WorkspaceControlDTO } from "./types";
import type { UpdateRiskInput } from "./StepInherentRisks";

interface StepResidualRiskProps {
  risks: AssessmentRiskDTO[];
  controls: AssessmentControlDTO[];
  workspaceControls: WorkspaceControlDTO[];
  appetiteThresholds: AppetiteThresholds;
  onUpdateRisk: (id: string, input: UpdateRiskInput) => Promise<void>;
  onUpdateEffectiveness: (workspaceControlId: string, rating: ControlRating) => Promise<void>;
}

const BANNER: Record<"within" | "tolerated" | "outside", { bg: string; icon: typeof CheckCircle2; label: string }> = {
  within: { bg: "bg-accent/10 border-accent/20 text-accent", icon: CheckCircle2, label: "Within appetite" },
  tolerated: { bg: "bg-amber-50 border-amber-200 text-amber-700", icon: AlertTriangle, label: "Tolerated" },
  outside: { bg: "bg-red-50 border-red-200 text-red-700", icon: ShieldAlert, label: "Outside appetite" },
};

/** Step 6: per-risk residual risk (inherent, mitigated by attached-control coverage x effectiveness) and the assessment-level result against the workspace's appetite thresholds. */
export default function StepResidualRisk({
  risks,
  controls,
  workspaceControls,
  appetiteThresholds,
  onUpdateRisk,
  onUpdateEffectiveness,
}: StepResidualRiskProps) {
  const workspaceControlById = useMemo(
    () => new Map(workspaceControls.map((c) => [c.id, c])),
    [workspaceControls]
  );

  const { perRisk, summary } = useMemo(
    () => computeAssessmentResidual(risks, controls, workspaceControlById, appetiteThresholds),
    [risks, controls, workspaceControlById, appetiteThresholds]
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Residual risk vs appetite</h2>
        <p className="text-sm text-text-muted">
          Residual risk is computed from each risk&apos;s inherent score, mitigated by its attached controls&apos;
          coverage and effectiveness. Effectiveness is credited only for a control you have instantiated as a live
          workspace control and rated - an attachment that is reference-only, or a live control never tested,
          counts as &quot;Not assessed&quot; and earns no credit.
        </p>
      </div>

      {summary && (
        <SummaryBanner
          appetiteResult={summary.appetiteResult}
          overallResidualScore={summary.overallResidualScore}
          meanResidualScore={summary.meanResidualScore}
          overallResidualRating={summary.overallResidualRating}
          thresholds={appetiteThresholds}
        />
      )}

      {risks.length === 0 ? (
        <div className="glass-card rounded-xl p-6 text-center text-sm text-text-muted">
          No risks on the register yet. Go back to Inherent risks to add at least one.
        </div>
      ) : (
        <div className="space-y-4">
          {perRisk.map((entry) => (
            <RiskResidualCard
              key={entry.risk.id}
              entry={entry}
              workspaceControlById={workspaceControlById}
              onUpdateRisk={onUpdateRisk}
              onUpdateEffectiveness={onUpdateEffectiveness}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryBanner({
  appetiteResult,
  overallResidualScore,
  meanResidualScore,
  overallResidualRating,
  thresholds,
}: {
  appetiteResult: "within" | "tolerated" | "outside";
  overallResidualScore: number;
  meanResidualScore: number;
  overallResidualRating: string;
  thresholds: AppetiteThresholds;
}) {
  const config = BANNER[appetiteResult];
  const Icon = config.icon;
  return (
    <div className={`rounded-2xl border p-5 ${config.bg}`}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{config.label}</p>
          <p className="text-xs mt-1 opacity-90">
            Worst-risk residual score {overallResidualScore} ({overallResidualRating}), mean {meanResidualScore}{" "}
            across the register. Appetite thresholds: tolerated from {thresholds.toleratedFrom}, outside from{" "}
            {thresholds.outsideFrom}.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 shrink-0">
          <div className="text-center">
            <div className="text-xl font-bold tabular-nums leading-none">{overallResidualScore}</div>
            <p className="text-[10px] uppercase tracking-wider opacity-80 mt-1">Worst residual</p>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold tabular-nums leading-none">{meanResidualScore}</div>
            <p className="text-[10px] uppercase tracking-wider opacity-80 mt-1">Mean residual</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskResidualCard({
  entry,
  workspaceControlById,
  onUpdateRisk,
  onUpdateEffectiveness,
}: {
  entry: RiskResidual;
  workspaceControlById: Map<string, WorkspaceControlDTO>;
  onUpdateRisk: (id: string, input: UpdateRiskInput) => Promise<void>;
  onUpdateEffectiveness: (workspaceControlId: string, rating: ControlRating) => Promise<void>;
}) {
  const { risk, attachedControls, result } = entry;
  const inherentRating = getRiskRating(result.inherentScore).rating;

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{risk.title}</p>
          {risk.typology_slug && <p className="text-xs text-text-muted mt-0.5">Typology: {risk.typology_slug}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <RiskRatingBadge level={inherentRating} score={result.inherentScore} />
          <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
          <RiskRatingBadge level={result.residualRating} score={result.residualScore} />
        </div>
      </div>

      <p className="text-xs text-text-muted mb-3">
        {result.mitigationApplied > 0
          ? `${result.mitigationApplied}% of inherent risk mitigated by attached controls.`
          : "No mitigation credit yet - attach and test a control to reduce this risk's residual score."}
      </p>

      {attachedControls.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {attachedControls.map((a) => (
            <div
              key={a.control.id}
              className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/10"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs text-foreground truncate">{resolveControlLabel(a.control, workspaceControlById)}</p>
                <p className="text-[11px] text-text-muted">
                  Coverage: {a.control.coverage}
                  {!a.instantiated && " · reference only, not instantiated - no credit possible"}
                  {a.instantiated && a.effectiveness === "not_assessed" && " · not yet tested - no credit yet"}
                </p>
              </div>
              {a.instantiated && a.control.workspace_control_id ? (
                <RatingSelect
                  value={a.effectiveness}
                  onChange={(rating) => void onUpdateEffectiveness(a.control.workspace_control_id as string, rating)}
                />
              ) : (
                <span className="text-[11px] text-text-muted px-2 py-1 rounded-full border border-white/10">
                  Not assessed
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <textarea
        defaultValue={risk.residual_rationale ?? ""}
        onBlur={(e) => {
          if (e.target.value !== (risk.residual_rationale ?? "")) {
            void onUpdateRisk(risk.id, { residualScore: result.residualScore, residualRationale: e.target.value || null });
          }
        }}
        rows={2}
        placeholder="Residual rationale (optional): why this score, given the controls in place?"
        className="w-full px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
      />
    </div>
  );
}
