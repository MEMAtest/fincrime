export type FirmType =
  | "emi"
  | "pi"
  | "bank"
  | "msb"
  | "crypto"
  | "neobank"
  | "wealth_manager"
  | "insurance";

export type ProductType =
  | "cross_border_payments"
  | "domestic_payments"
  | "e_money_accounts"
  | "crypto_exchange"
  | "remittance"
  | "trade_finance"
  | "lending"
  | "fx_transfers"
  | "card_issuing"
  | "marketplace_payouts";

export type CustomerType =
  | "individuals"
  | "smes"
  | "corporates"
  | "high_net_worth"
  | "politically_exposed"
  | "non_profit"
  | "agents_intermediaries";

export type RiskTheme =
  | "terrorist_financing"
  | "money_laundering"
  | "sanctions_evasion"
  | "fraud"
  | "tax_evasion"
  | "bribery_corruption"
  | "proliferation_financing";

export type SourceOrg =
  | "FATF"
  | "Wolfsberg"
  | "FCA"
  | "JMLSG"
  | "OFSI"
  | "MLR"
  | "FinCEN"
  | "EU"
  | "BaFin"
  | "ACPR"
  | "AMF"
  | "MAS"
  | "HKMA"
  | "SFC";

export interface Source {
  org: SourceOrg;
  reference: string;
  title: string;
  url: string;
}

export interface DetectionRule {
  id: string;
  name: string;
  logic: string;
  threshold?: string;
  priority: "low" | "medium" | "high" | "critical";
}

export interface WorkflowStep {
  step: number;
  title: string;
  description: string;
  sla?: string;
  responsible: string;
}

export interface GovernanceItem {
  id: string;
  item: string;
  frequency: string;
  owner: string;
}

export interface Metric {
  name: string;
  target: string;
  description: string;
}

export interface Typology {
  id: number;
  slug: string;
  title: string;
  riskTheme: RiskTheme;
  description: string;
  applicableFirmTypes: FirmType[];
  applicableProducts: ProductType[];
  applicableCustomerTypes: CustomerType[];
  controlObjective: string;
  dataRequired: string[];
  detectionLogic: DetectionRule[];
  workflowSteps: WorkflowStep[];
  metrics: Metric[];
  governanceChecklist: GovernanceItem[];
  sources: Source[];
}
