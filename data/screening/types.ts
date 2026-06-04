import type {
  FirmType,
  RiskTheme,
  DetectionRule,
  Metric,
  GovernanceItem,
  Source,
} from "../typologies/types";

export type ScreeningCategory =
  | "sanctions"
  | "pep"
  | "adverse_media"
  | "name_screening"
  | "transaction_screening";

export type ScreeningTrigger = "onboarding" | "ongoing" | "real_time" | "periodic";

export interface MatchingConfig {
  aspect: string; // e.g. "Fuzzy match threshold"
  guidance: string; // recommended configuration
  source?: string; // optional citation label
}

export interface EscalationStep {
  step: number;
  title: string;
  description: string;
  sla?: string;
  owner: string;
}

export interface ScreeningControl {
  id: number;
  slug: string;
  title: string;
  category: ScreeningCategory;
  description: string;
  applicableFirmTypes: FirmType[];
  applicableTriggers: ScreeningTrigger[];
  riskThemes: RiskTheme[]; // for Evidence-tab linkage
  controlObjective: string;
  dataInputs: string[];
  matchingConfig: MatchingConfig[];
  detectionLogic: DetectionRule[];
  escalationWorkflow: EscalationStep[];
  metrics: Metric[];
  governanceChecklist: GovernanceItem[];
  sources: Source[];
}

export const SCREENING_CATEGORY_LABEL: Record<ScreeningCategory, string> = {
  sanctions: "Sanctions screening",
  pep: "PEP screening",
  adverse_media: "Adverse media screening",
  name_screening: "Customer name screening",
  transaction_screening: "Transaction / payment screening",
};

export const SCREENING_TRIGGER_LABEL: Record<ScreeningTrigger, string> = {
  onboarding: "At onboarding",
  ongoing: "Ongoing (rescreening)",
  real_time: "Real-time (per payment)",
  periodic: "Periodic batch",
};
