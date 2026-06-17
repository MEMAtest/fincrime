import type { Source } from "../typologies/types";

/**
 * KYC / CDD Requirements Matrix data model.
 *
 * A requirement set is keyed by (entityType x jurisdiction). Risk is handled
 * per-item: each CddItem lists the risk levels at which it applies, matching how
 * the source workbook encodes Low/Medium/High variations within a single sheet.
 *
 * ACCURACY RULE: every CddItem and every EddTrigger MUST carry a non-empty
 * `sources` (the stored regulatory reference for that specific requirement).
 * This is enforced at module load by data/kyc/validate.ts.
 */

export type EntityType =
  | "regulated_entity"
  | "listed_entity"
  | "corporate"
  | "individual"
  | "sole_trader"
  | "partnership"
  | "limited_partnership"
  | "trust"
  | "charity"
  | "fund"
  | "foundation"
  | "stak"
  | "swf"
  | "tcsp_client"
  | "tcsp_partner"
  | "government"
  | "spv"
  | "introductory_broker"
  | "program_manager";

export type Jurisdiction = "global" | "uk" | "us" | "eu" | "de" | "fr" | "sg" | "hk";

export type RiskLevel = "low" | "medium" | "high";

export type CddSectionKey =
  | "identity"
  | "legal_entity"
  | "nature_purpose"
  | "authority_signatory"
  | "directors_controllers"
  | "beneficial_ownership"
  | "authorised_contacts"
  | "screening"
  | "edd";

export interface CddItem {
  /** The requirement, e.g. "Registered office address". */
  text: string;
  /** Risk levels at which this item is required. */
  appliesAtRisk: RiskLevel[];
  /** Optional condition, e.g. "if different from registered office". */
  conditional?: string;
  /** Optional quantitative qualifier, e.g. "25% ownership", "up to 5 directors". */
  threshold?: string;
  /** MANDATORY, non-empty: the precise provision behind this requirement. */
  sources: Source[];
}

export interface CddSection {
  key: CddSectionKey;
  title: string;
  items: CddItem[];
}

export interface EddTrigger {
  /** The condition that escalates to EDD, e.g. "Customer or BO is a PEP". */
  trigger: string;
  /** The required enhanced measure. */
  action: string;
  /** MANDATORY, non-empty: the provision requiring this. */
  sources: Source[];
}

export interface CddProfile {
  entityType: EntityType;
  jurisdiction: Jurisdiction;
  /** Whether the cited regime is currently in force or an incoming/optional change. */
  status: "in_force" | "incoming";
  /** The workbook's inherent risk score for the entity type, where it assigns one. */
  inherentRisk: RiskLevel | "varies";
  /** The overarching law(s) governing this entity type in this jurisdiction. */
  regulatoryBasis: Source[];
  /** Beneficial-ownership threshold, e.g. "25%". */
  boThreshold: string;
  /** When simplified due diligence / reduced measures are available. */
  sddEligibility: string;
  /** Where the entity is exempt from BO identification (e.g. US 1010.230(e)). */
  exemptionNote?: string;
  sections: CddSection[];
  eddTriggers: EddTrigger[];
  notes?: string;
}

/* ── Display labels ─────────────────────────────────── */

export const ENTITY_LABEL: Record<EntityType, string> = {
  regulated_entity: "Regulated Entity",
  listed_entity: "Listed Entity",
  corporate: "Corporate",
  individual: "Individual",
  sole_trader: "Sole Trader",
  partnership: "Partnership",
  limited_partnership: "Limited Partnership",
  trust: "Trust",
  charity: "Charity / NPO",
  fund: "Fund",
  foundation: "Foundation",
  stak: "STAK (Stichting)",
  swf: "Sovereign Wealth Fund",
  tcsp_client: "TCSP Client",
  tcsp_partner: "TCSP Partner",
  government: "Government / Public Body",
  spv: "SPV / Diamonds",
  introductory_broker: "Introductory Broker",
  program_manager: "Program Manager",
};

export const JURISDICTION_LABEL: Record<Jurisdiction, string> = {
  global: "FATF (Global)",
  uk: "United Kingdom",
  us: "United States",
  eu: "European Union",
  de: "Germany",
  fr: "France",
  sg: "Singapore",
  hk: "Hong Kong",
};

/** Short regulator/law tag shown under each jurisdiction. */
export const JURISDICTION_REGULATOR: Record<Jurisdiction, string> = {
  global: "FATF Recommendations",
  uk: "FCA · MLR 2017 · JMLSG",
  us: "FinCEN (BSA, 31 CFR)",
  eu: "AMLD5 / AMLR",
  de: "BaFin (GwG)",
  fr: "ACPR / AMF (CMF)",
  sg: "MAS (Notice 626)",
  hk: "HKMA / SFC (AMLO)",
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Lower Risk",
  medium: "Medium Risk",
  high: "Higher Risk",
};

export const SECTION_TITLE: Record<CddSectionKey, string> = {
  identity: "Identity",
  legal_entity: "Legal Entity",
  nature_purpose: "Nature & Purpose",
  authority_signatory: "Authority & Signatory",
  directors_controllers: "Directors / Controllers",
  beneficial_ownership: "Beneficial Ownership",
  authorised_contacts: "Authorised Contacts",
  screening: "Screening",
  edd: "Enhanced Due Diligence",
};

export const JURISDICTION_ORDER: Jurisdiction[] = ["global", "uk", "us", "eu", "de", "fr", "sg", "hk"];

export const ENTITY_ORDER: EntityType[] = [
  "individual",
  "sole_trader",
  "regulated_entity",
  "listed_entity",
  "corporate",
  "partnership",
  "limited_partnership",
  "trust",
  "charity",
  "fund",
  "foundation",
  "government",
  "swf",
  "spv",
  "stak",
  "tcsp_client",
  "tcsp_partner",
  "introductory_broker",
  "program_manager",
];
