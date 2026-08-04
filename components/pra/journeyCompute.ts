/**
 * Shared, client-safe compute helpers for PRA journey steps 5-8: derived
 * gaps, per-risk / assessment-level residual risk, operational-load input
 * mapping, and control label resolution. One place so Step 5, Step 6,
 * Step 8 and AssessmentJourneyClient's background persistence all agree on
 * the same numbers.
 *
 * Safe to import from client components: this file and everything it pulls
 * from data/scoring/** and data/controls/** is plain, pure TypeScript with
 * no lib/db.ts / server-only imports (the same pattern StepInherentRisks.tsx
 * already uses for data/scoring/typology-scoring).
 */

import { getControlBySlug } from "@/data/controls";
import {
  scoreResidualRisk,
  summariseResidualRisk,
  type AppetiteThresholds,
  type ControlEffectiveness,
  type ResidualAssessmentSummary,
  type ResidualRiskResult,
} from "@/data/scoring/residual-risk";
import type { OperationalLoadInput } from "@/data/scoring/operational-load";
import type { AssessmentControlDTO, AssessmentRiskDTO, WorkspaceControlDTO } from "./types";

/**
 * A control not yet promoted to a live workspace_controls row cannot have
 * been tested, so it earns no mitigation credit regardless of its coverage -
 * only an instantiated control's effectiveness_rating counts. This is the
 * one place that rule is applied, so Step 5/6/8 can't drift from each other.
 */
export interface ResolvedControlEffectiveness {
  control: AssessmentControlDTO;
  effectiveness: ControlEffectiveness;
  instantiated: boolean;
}

export function resolveControlEffectiveness(
  control: AssessmentControlDTO,
  workspaceControlById: Map<string, WorkspaceControlDTO>
): ResolvedControlEffectiveness {
  const workspaceControl = control.workspace_control_id
    ? workspaceControlById.get(control.workspace_control_id)
    : undefined;
  return {
    control,
    effectiveness: workspaceControl?.effectiveness_rating ?? "not_assessed",
    instantiated: Boolean(workspaceControl),
  };
}

/** Best-effort display name for a control attachment: the live workspace control's name, else the library entry's name, else the raw slug. */
export function resolveControlLabel(
  control: AssessmentControlDTO,
  workspaceControlById: Map<string, WorkspaceControlDTO>
): string {
  const workspaceControl = control.workspace_control_id
    ? workspaceControlById.get(control.workspace_control_id)
    : undefined;
  if (workspaceControl?.name) return workspaceControl.name;
  if (control.control_slug) {
    const libraryControl = getControlBySlug(control.control_slug);
    if (libraryControl) return libraryControl.name;
  }
  return control.control_slug ?? "Custom control";
}

export interface RiskResidual {
  risk: AssessmentRiskDTO;
  attachedControls: ResolvedControlEffectiveness[];
  result: ResidualRiskResult;
}

export function computeRiskResidual(
  risk: AssessmentRiskDTO,
  riskControls: AssessmentControlDTO[],
  workspaceControlById: Map<string, WorkspaceControlDTO>
): RiskResidual {
  const attachedControls = riskControls.map((c) => resolveControlEffectiveness(c, workspaceControlById));
  const result = scoreResidualRisk({
    inherentScore: risk.inherent_score ?? 0,
    controls: attachedControls.map((a) => ({ coverage: a.control.coverage, effectiveness: a.effectiveness })),
  });
  return { risk, attachedControls, result };
}

export interface AssessmentResidual {
  perRisk: RiskResidual[];
  summary: ResidualAssessmentSummary | null;
}

export function computeAssessmentResidual(
  risks: AssessmentRiskDTO[],
  controls: AssessmentControlDTO[],
  workspaceControlById: Map<string, WorkspaceControlDTO>,
  thresholds: AppetiteThresholds
): AssessmentResidual {
  const perRisk = risks.map((risk) =>
    computeRiskResidual(
      risk,
      controls.filter((c) => c.risk_id === risk.id),
      workspaceControlById
    )
  );
  const summary = summariseResidualRisk(
    perRisk.map((r) => r.result),
    thresholds
  );
  return { perRisk, summary };
}

/**
 * A gap is either a risk with nothing attached at all, or an individual
 * attachment whose coverage is explicitly "gap" - a hole even if the same
 * risk has other, better-covering controls attached alongside it.
 */
export interface GapItem {
  key: string;
  riskId: string;
  riskTitle: string;
  kind: "no_controls" | "gap_coverage";
  controlLabel?: string;
}

export function computeGaps(
  risks: AssessmentRiskDTO[],
  controls: AssessmentControlDTO[],
  workspaceControlById: Map<string, WorkspaceControlDTO>
): GapItem[] {
  const gaps: GapItem[] = [];
  for (const risk of risks) {
    const attached = controls.filter((c) => c.risk_id === risk.id);
    if (attached.length === 0) {
      gaps.push({ key: `${risk.id}:none`, riskId: risk.id, riskTitle: risk.title, kind: "no_controls" });
      continue;
    }
    for (const control of attached) {
      if (control.coverage === "gap") {
        gaps.push({
          key: control.id,
          riskId: risk.id,
          riskTitle: risk.title,
          kind: "gap_coverage",
          controlLabel: resolveControlLabel(control, workspaceControlById),
        });
      }
    }
  }
  return gaps;
}

/**
 * Reads an assessment_control's op_load JSONB defensively: any missing or
 * non-numeric field clamps to 0 (or undefined for the optional hourly cost,
 * so scoreOperationalLoad falls back to its own default rate).
 */
export function opLoadInputFromControl(control: AssessmentControlDTO): OperationalLoadInput {
  const raw = (control.op_load ?? {}) as Record<string, unknown>;
  const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const numOrUndefined = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;
  return {
    monthlyVolume: num(raw.monthlyVolume),
    alertRatePct: num(raw.alertRatePct),
    handlingMinutes: num(raw.handlingMinutes),
    hourlyCostGbp: numOrUndefined(raw.hourlyCostGbp),
  };
}
