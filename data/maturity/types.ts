import type { RiskTheme, Metric, GovernanceItem, Source } from "../typologies/types";

export type ControlArea =
  | "governance"
  | "cdd_kyc"
  | "transaction_monitoring"
  | "screening"
  | "reporting"
  | "training";

export type MaturityLevel = "initial" | "developing" | "defined" | "managed" | "optimised";

export const MATURITY_ORDER: Record<MaturityLevel, number> = {
  initial: 1,
  developing: 2,
  defined: 3,
  managed: 4,
  optimised: 5,
};

export const MATURITY_POINTS: Record<MaturityLevel, number> = {
  initial: 20,
  developing: 40,
  defined: 60,
  managed: 80,
  optimised: 100,
};

export const MATURITY_LABEL: Record<MaturityLevel, string> = {
  initial: "Initial",
  developing: "Developing",
  defined: "Defined",
  managed: "Managed",
  optimised: "Optimised",
};

export const CONTROL_AREA_LABEL: Record<ControlArea, string> = {
  governance: "Governance & Oversight",
  cdd_kyc: "CDD / KYC",
  transaction_monitoring: "Transaction Monitoring",
  screening: "Sanctions & Screening",
  reporting: "SAR / Regulatory Reporting",
  training: "Training & Culture",
};

export interface MaturityCriterion {
  level: MaturityLevel;
  descriptor: string;
}

export interface RemediationAction {
  fromLevel: MaturityLevel; // the level you are leaving
  action: string;
  owner: string;
}

export interface MaturityFramework {
  id: number;
  slug: string;
  title: string;
  area: ControlArea;
  description: string;
  riskThemes: RiskTheme[];
  levels: MaturityCriterion[]; // 5 descriptors
  remediation: RemediationAction[];
  metrics: Metric[];
  governanceChecklist: GovernanceItem[];
  sources: Source[];
}
