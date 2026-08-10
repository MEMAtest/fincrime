import type { ControlRating } from "../controls/types";
import { getRiskRating, type RiskRating } from "./risk-matrix";

/**
 * Residual risk = inherent risk after crediting the controls actually in
 * place. Deterministic and pure, mirroring typology-scoring.ts and
 * maturity-scoring.ts: no AI, no I/O, no randomness.
 */

/** How much of the risk a control actually covers. */
export type ControlCoverage = "full" | "partial" | "gap";

/** How well the control works in practice. Reuses the register's ControlRating union. */
export type ControlEffectiveness = ControlRating;

export interface ResidualControlInput {
  coverage: ControlCoverage;
  effectiveness: ControlEffectiveness;
}

export interface ResidualRiskInput {
  /** 0-100. From typology match weights (scoreTypologies) or a manual override. */
  inherentScore: number;
  controls: ResidualControlInput[];
}

export interface ResidualRiskResult {
  inherentScore: number;
  /** 0-100. Never exceeds inherentScore. */
  residualScore: number;
  residualRating: RiskRating;
  /** Percentage (0-100) of the inherent score removed by the combined control set. */
  mitigationApplied: number;
}

/**
 * Control mitigation factor table.
 *
 * Each control removes a fraction of the inherent risk, driven by how much of
 * the risk it covers (coverage) and how well it holds up in practice
 * (effectiveness). A control marked "gap" coverage contributes nothing (it
 * isn't there), and a control that has never been assessed ("not_assessed"
 * effectiveness) also contributes nothing - you cannot credit a control you
 * haven't tested, regardless of how much of the risk it claims to cover.
 *
 *              strong   adequate   weak   not_assessed
 *   full        0.70      0.50     0.25       0
 *   partial      0.45      0.30     0.15       0
 *   gap          0         0        0          0
 *
 * Rationale: full+strong is the single best a control can do (0.70), never
 * full elimination on its own; partial coverage is capped lower than full at
 * every effectiveness level because it leaves part of the risk untouched by
 * definition.
 */
/** Exported so app/methodology/page.tsx renders this table directly rather than retyping it. */
export const MITIGATION_FACTORS: Record<ControlCoverage, Record<ControlEffectiveness, number>> = {
  full: { strong: 0.7, adequate: 0.5, weak: 0.25, not_assessed: 0 },
  partial: { strong: 0.45, adequate: 0.3, weak: 0.15, not_assessed: 0 },
  gap: { strong: 0, adequate: 0, weak: 0, not_assessed: 0 },
};

/**
 * Residual can never be driven all the way to zero once any control earns
 * mitigation credit - some residual risk always remains. Only applied when
 * at least one control actually mitigates something; a risk with zero
 * controls, or only gap/not_assessed controls, keeps its raw (unfloored)
 * value so it can still equal the inherent score exactly.
 *
 * Exported so app/methodology/page.tsx renders this directly rather than
 * retyping it. The floor is also capped by inherentScore itself (see
 * `Math.min(residualScore, inherentScore)` below), so it never lifts a very
 * low inherent score above its own value.
 */
export const RESIDUAL_FLOOR = 5;

function clampScore(value: number): number {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Multiple controls combine with diminishing returns rather than simple
 * addition: each control removes its share of whatever risk is still
 * standing, not a share of the original inherent score. Three moderate
 * controls therefore compound (a "weak" control still helps even after a
 * "strong" one) but can never reach zero combined mitigation.
 */
export function scoreResidualRisk(input: ResidualRiskInput): ResidualRiskResult {
  const inherentScore = clampScore(input.inherentScore);
  const controls = input.controls ?? [];

  const retention = controls.reduce((acc, control) => {
    const factor = MITIGATION_FACTORS[control.coverage]?.[control.effectiveness] ?? 0;
    return acc * (1 - factor);
  }, 1);

  const mitigationFraction = 1 - retention;
  let residualScore = inherentScore * retention;

  if (mitigationFraction > 0) {
    residualScore = Math.max(residualScore, RESIDUAL_FLOOR);
  }
  // Mitigation only ever removes risk; residual can never exceed inherent
  // (this also protects the floor from lifting a near-zero inherent score).
  residualScore = Math.min(residualScore, inherentScore);
  residualScore = Math.round(clampScore(residualScore));

  return {
    inherentScore,
    residualScore,
    residualRating: getRiskRating(residualScore).rating,
    mitigationApplied: round1(mitigationFraction * 100),
  };
}

/** Appetite bands, workspace-overridable via JSONB settings (appetite_thresholds). */
export interface AppetiteThresholds {
  /** Score at and above which residual risk is "tolerated" rather than "within" appetite. */
  toleratedFrom: number;
  /** Score at and above which residual risk is "outside" appetite. */
  outsideFrom: number;
}

export const DEFAULT_APPETITE_THRESHOLDS: AppetiteThresholds = {
  toleratedFrom: 40,
  outsideFrom: 60,
};

export type AppetiteResult = "within" | "tolerated" | "outside";

export function compareToAppetite(
  residualScore: number,
  thresholds: AppetiteThresholds = DEFAULT_APPETITE_THRESHOLDS
): AppetiteResult {
  const score = clampScore(residualScore);
  if (score >= thresholds.outsideFrom) return "outside";
  if (score >= thresholds.toleratedFrom) return "tolerated";
  return "within";
}

/** Assessment-level roll-up across every scored risk. */
export interface ResidualAssessmentSummary {
  /** Max of the risk residuals - the worst single risk drives overall exposure. */
  overallResidualScore: number;
  /** Mean of the risk residuals, kept for context alongside the max. */
  meanResidualScore: number;
  overallResidualRating: RiskRating;
  appetiteResult: AppetiteResult;
}

export function summariseResidualRisk(
  risks: ResidualRiskResult[],
  thresholds: AppetiteThresholds = DEFAULT_APPETITE_THRESHOLDS
): ResidualAssessmentSummary | null {
  if (risks.length === 0) return null;

  const overallResidualScore = Math.max(...risks.map((r) => r.residualScore));
  const meanResidualScore = round1(risks.reduce((sum, r) => sum + r.residualScore, 0) / risks.length);

  return {
    overallResidualScore,
    meanResidualScore,
    overallResidualRating: getRiskRating(overallResidualScore).rating,
    appetiteResult: compareToAppetite(overallResidualScore, thresholds),
  };
}
