/**
 * Risk rating thresholds used across both modules
 */

export type RiskRating = "low" | "medium" | "high" | "critical";

export interface RiskThreshold {
  min: number;
  max: number;
  rating: RiskRating;
  label: string;
  color: string;
  description: string;
}

export const PARTNER_RISK_THRESHOLDS: RiskThreshold[] = [
  {
    min: 0,
    max: 24,
    rating: "low",
    label: "Low Risk",
    color: "#22c55e",
    description: "Control framework is well-defined with clear ownership and minimal gaps.",
  },
  {
    min: 25,
    max: 49,
    rating: "medium",
    label: "Medium Risk",
    color: "#f59e0b",
    description: "Some control gaps or data dependencies need attention before launch.",
  },
  {
    min: 50,
    max: 74,
    rating: "high",
    label: "High Risk",
    color: "#ef4444",
    description: "Significant gaps in control ownership or data. Remediation required.",
  },
  {
    min: 75,
    max: Infinity,
    rating: "critical",
    label: "Critical Risk",
    color: "#dc2626",
    description: "Material control failures. Do not proceed without comprehensive remediation.",
  },
];

export function getRiskRating(score: number): RiskThreshold {
  return (
    PARTNER_RISK_THRESHOLDS.find((t) => score >= t.min && score <= t.max) ||
    PARTNER_RISK_THRESHOLDS[PARTNER_RISK_THRESHOLDS.length - 1]
  );
}

export const TYPOLOGY_MATCH_THRESHOLDS = {
  strong: { min: 75, label: "Strong Match" },
  moderate: { min: 50, label: "Moderate Match" },
  partial: { min: 25, label: "Partial Match" },
  weak: { min: 0, label: "Weak Match" },
} as const;

export function getMatchStrength(score: number): string {
  if (score >= TYPOLOGY_MATCH_THRESHOLDS.strong.min) return TYPOLOGY_MATCH_THRESHOLDS.strong.label;
  if (score >= TYPOLOGY_MATCH_THRESHOLDS.moderate.min) return TYPOLOGY_MATCH_THRESHOLDS.moderate.label;
  if (score >= TYPOLOGY_MATCH_THRESHOLDS.partial.min) return TYPOLOGY_MATCH_THRESHOLDS.partial.label;
  return TYPOLOGY_MATCH_THRESHOLDS.weak.label;
}
