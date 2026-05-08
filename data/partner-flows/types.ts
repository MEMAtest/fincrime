export type ModelType = "embedded" | "correspondent" | "marketplace";
export type FlowType = "cross_border_payout" | "api_payout" | "swift_payout" | "multi_currency_account" | "platform_payout";

export type Actor = "your_firm" | "partner" | "correspondent_bank" | "beneficiary_bank" | "end_customer" | "platform_operator" | "fx_provider";

export type ControlOwnership = "your_firm" | "partner" | "shared" | "gap";

export interface ControlItem {
  id: string;
  control: string;
  category: string;
  defaultOwner: ControlOwnership;
  description: string;
}

export interface DataField {
  id: string;
  field: string;
  source: string;
  required: boolean;
  description: string;
}

export interface RACIEntry {
  activity: string;
  responsible: Actor;
  accountable: Actor;
  consulted: Actor[];
  informed: Actor[];
}

export interface PreLaunchCondition {
  id: string;
  condition: string;
  category: string;
  evidence: string;
}

export interface GovernancePackItem {
  id: string;
  document: string;
  frequency: string;
  owner: string;
}

export type SourceOrg = "Wolfsberg" | "FATF" | "FCA" | "JMLSG";

export interface Source {
  org: SourceOrg;
  reference: string;
  title: string;
}

export interface PartnerFlow {
  id: number;
  slug: string;
  title: string;
  description: string;
  modelType: ModelType;
  flowType: FlowType;
  defaultActors: Actor[];
  controlOwnershipTemplate: ControlItem[];
  dataFieldsTemplate: DataField[];
  raciTemplate: RACIEntry[];
  preLaunchConditions: PreLaunchCondition[];
  governancePack: GovernancePackItem[];
  sources: Source[];
}
