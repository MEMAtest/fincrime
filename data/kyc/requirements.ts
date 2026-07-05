import type { Source } from "../typologies/types";
import type { CddProfile, CddRequirement, CddCategoryKey, CddSectionKey, Jurisdiction } from "./types";
import { cite } from "./sources";
import { documentGuidanceFor } from "./documents";

/**
 * Derivation layer: turns a profile's authored, cited `sections` (+ eddTriggers)
 * into the rich `CddRequirement[]` the Matrix UI renders. The generic bits
 * (title, "what this means", evidence) come from a shared catalogue authored once
 * per requirement type; the specific bits (what-to-collect, legal basis) come from
 * the profile's real items and citations. Net-new Ongoing Monitoring requirements
 * are injected with this jurisdiction's citation.
 */

export const SECTION_TO_CATEGORY: Record<CddSectionKey, CddCategoryKey> = {
  identity: "identification_verification",
  legal_entity: "identification_verification",
  authority_signatory: "identification_verification",
  directors_controllers: "beneficial_ownership_control",
  beneficial_ownership: "beneficial_ownership_control",
  nature_purpose: "purpose_nature",
  authorised_contacts: "additional_other",
  screening: "additional_other",
  edd: "additional_other",
};

/** Per-jurisdiction company-registry name, for evidence examples. */
const REGISTRY: Record<Jurisdiction, string> = {
  global: "Company registry",
  uk: "Companies House",
  us: "Secretary of State / business registry",
  eu: "National business register",
  de: "Handelsregister",
  fr: "RCS / K-bis extract",
  sg: "ACRA business profile",
  hk: "Companies Registry",
};

interface CatalogueEntry {
  title: string;
  whatItMeans: string;
  evidence: (registry: string) => string[];
}

const REQUIREMENT_CATALOGUE: Record<CddSectionKey, CatalogueEntry> = {
  identity: {
    title: "Verify customer identity",
    whatItMeans:
      "Identify the natural person and verify their identity using reliable, independent source documents or data, so you know who the customer is.",
    evidence: () => ["Passport / national identity document", "Proof of address (utility bill or bank statement)", "Electronic identity verification result"],
  },
  legal_entity: {
    title: "Verify legal identity & existence",
    whatItMeans:
      "Identify and verify the legal existence of the entity and confirm its key registration details using reliable, independent sources.",
    evidence: (reg) => [`${reg} record`, "Certificate of incorporation / formation documents", "Constitutional documents (articles, partnership or trust deed)"],
  },
  authority_signatory: {
    title: "Verify authority to act",
    whatItMeans:
      "Confirm the individuals opening or operating the account are authorised to act, and verify their identity.",
    evidence: () => ["Board or partner resolution / account mandate", "Verified ID of the authorised signatory", "Power of attorney (where applicable)"],
  },
  directors_controllers: {
    title: "Identify directors & controllers",
    whatItMeans:
      "Identify the individuals who direct or control the entity, and verify them on a risk-sensitive basis.",
    evidence: (reg) => [`${reg} register of directors`, "Certified ID of directors", "Organisation / control-structure chart"],
  },
  beneficial_ownership: {
    title: "Identify & verify beneficial owners",
    whatItMeans:
      "Identify the natural persons who ultimately own or control the customer and verify their identity, so the ownership and control structure is transparent.",
    evidence: () => ["Beneficial-ownership register (e.g. PSC register)", "Ownership / control-structure chart", "Certified ID of each beneficial owner"],
  },
  nature_purpose: {
    title: "Understand purpose & nature of the relationship",
    whatItMeans:
      "Obtain and record the purpose and intended nature of the relationship and expected activity, to build the customer risk profile.",
    evidence: () => ["Completed account-purpose / onboarding form", "Business description and expected activity", "Source of funds / wealth documentation"],
  },
  authorised_contacts: {
    title: "Identify authorised contacts",
    whatItMeans:
      "Identify, and verify on a risk basis, the individuals authorised to give instructions on the relationship.",
    evidence: () => ["List of authorised contacts", "Verified ID of authorised contacts"],
  },
  screening: {
    title: "Sanctions, PEP & adverse-media screening",
    whatItMeans:
      "Screen the customer and connected parties against sanctions, PEP and adverse-media sources at onboarding and on an ongoing basis.",
    evidence: () => ["Sanctions / PEP / adverse-media screening record", "Disposition notes for any matches", "Rescreening schedule"],
  },
  edd: {
    title: "Enhanced due diligence measures",
    whatItMeans:
      "Apply enhanced measures where the relationship presents higher money-laundering or terrorist-financing risk.",
    evidence: () => ["EDD form / senior-management sign-off", "Source of wealth evidence", "External EDD / intelligence report"],
  },
};

/** One-line "what the rule requires" per requirement type. */
const RULE_SUMMARY: Record<CddSectionKey, string> = {
  identity: "The rules require you to identify the customer and verify their identity from reliable, independent sources before establishing the relationship.",
  legal_entity: "The rules require you to verify the entity's legal existence and key registration details from an independent source.",
  authority_signatory: "The rules require you to confirm and verify the authority of those acting for the customer.",
  directors_controllers: "The rules require you to identify those who direct or control the entity, verified on a risk-sensitive basis.",
  beneficial_ownership: "The rules require you to identify and verify the beneficial owners above the ownership/control threshold and understand the ownership structure.",
  nature_purpose: "The rules require you to obtain and record the purpose and intended nature of the business relationship.",
  authorised_contacts: "The rules require you to identify, and verify on a risk basis, those authorised to instruct on the relationship.",
  screening: "The rules require you to screen the customer and connected parties against sanctions, PEP and adverse-media sources.",
  edd: "The rules require enhanced measures where the relationship presents higher money-laundering or terrorist-financing risk.",
};

const EDD_RULE_SUMMARY = "The rules require enhanced due diligence when this higher-risk factor is present.";

/** Each jurisdiction's ongoing-monitoring legal basis. */
const ONGOING_BASIS: Record<Jurisdiction, Source[]> = {
  global: cite("fatf_r10"),
  uk: cite("uk_mlr_ongoing", "jmlsg_corp"),
  us: cite("us_cdd_ongoing"),
  eu: cite("eu_amld_ongoing"),
  de: cite("de_gwg_ongoing"),
  fr: cite("fr_l5616"),
  sg: cite("sg_n626_ongoing"),
  hk: cite("hk_amlo_s5"),
};

interface OngoingTemplate {
  id: string;
  title: string;
  whatItMeans: string;
  ruleSummary: string;
  whatToCollect: string[];
  evidence: string[];
}

const ONGOING_MONITORING: OngoingTemplate[] = [
  {
    id: "ongoing-tm",
    title: "Ongoing transaction monitoring",
    whatItMeans: "Scrutinise transactions throughout the relationship to ensure they remain consistent with your knowledge of the customer and their risk profile.",
    ruleSummary: "The rules require ongoing scrutiny of transactions for consistency with the customer's profile.",
    whatToCollect: ["Transaction-monitoring rules and scenarios", "Alerts raised and their disposition", "Expected vs actual activity comparison"],
    evidence: ["Transaction-monitoring system output", "Investigated alert records"],
  },
  {
    id: "ongoing-review",
    title: "Periodic review & data refresh",
    whatItMeans: "Review the customer at a frequency set by risk and keep CDD information and documents current.",
    ruleSummary: "The rules require you to keep CDD information current through risk-based periodic review.",
    whatToCollect: ["Refreshed CDD information", "Updated identity / ownership documents", "Re-assessed customer risk rating"],
    evidence: ["Completed periodic-review record", "Updated KYC file"],
  },
  {
    id: "ongoing-trigger",
    title: "Trigger-event review",
    whatItMeans: "Re-perform CDD when a material change or trigger event occurs (e.g. change of ownership, adverse news, or unusual activity).",
    ruleSummary: "The rules require CDD to be refreshed on material changes or trigger events.",
    whatToCollect: ["Trigger-event details", "Updated CDD for the changed elements"],
    evidence: ["Trigger-event review note"],
  },
  {
    id: "ongoing-screening",
    title: "Ongoing screening refresh",
    whatItMeans: "Re-screen the customer and connected parties when sanctions or PEP lists change.",
    ruleSummary: "The rules require re-screening when sanctions or PEP lists change.",
    whatToCollect: ["Rescreening results", "List-change driven reviews"],
    evidence: ["Rescreening run record"],
  },
];

function uniqueSources(sources: Source[]): Source[] {
  const seen = new Map<string, Source>();
  for (const s of sources) seen.set(`${s.org}|${s.reference}`, s);
  return [...seen.values()];
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);

/** Build the categorised, rich requirement list for a profile. */
export function buildRequirements(profile: CddProfile): CddRequirement[] {
  const reg = REGISTRY[profile.jurisdiction];
  const out: CddRequirement[] = [];

  for (const section of profile.sections) {
    if (section.items.length === 0) continue;
    const c = REQUIREMENT_CATALOGUE[section.key];
    const whatToCollect = section.items.map(
      (i) => i.text + (i.threshold ? ` (${i.threshold})` : "") + (i.conditional ? ` (${i.conditional})` : "")
    );
    const legalBasis = uniqueSources(section.items.flatMap((i) => i.sources));
    const appliesAtRisk = Array.from(new Set(section.items.flatMap((i) => i.appliesAtRisk)));
    const allConditional = section.items.every((i) => !!i.conditional);
    const dg = documentGuidanceFor(section.key, profile.jurisdiction);
    out.push({
      id: `${profile.entityType}-${profile.jurisdiction}-${section.key}`,
      category: SECTION_TO_CATEGORY[section.key],
      title: c.title,
      whatItMeans: c.whatItMeans,
      ruleSummary: RULE_SUMMARY[section.key],
      whatToCollect,
      documentGuidance: dg.length ? dg : undefined,
      evidence: c.evidence(reg),
      legalBasis,
      appliesAtRisk: appliesAtRisk.length ? appliesAtRisk : ["low", "medium", "high"],
      conditional: allConditional ? "Applies in specific circumstances" : undefined,
      eddTrigger: section.key === "edd",
    });
  }

  // EDD triggers → requirements flagged as EDD triggers
  for (const t of profile.eddTriggers) {
    out.push({
      id: `${profile.entityType}-${profile.jurisdiction}-eddt-${slug(t.trigger)}`,
      category: "additional_other",
      title: t.trigger,
      whatItMeans: t.action,
      ruleSummary: EDD_RULE_SUMMARY,
      whatToCollect: [t.action],
      evidence: ["EDD form / senior-management sign-off", "Source of wealth evidence", "External EDD / intelligence report"],
      legalBasis: t.sources,
      appliesAtRisk: ["low", "medium", "high"],
      eddTrigger: true,
    });
  }

  // Ongoing monitoring (net-new, per-jurisdiction citation)
  for (const o of ONGOING_MONITORING) {
    out.push({
      id: `${profile.entityType}-${profile.jurisdiction}-${o.id}`,
      category: "ongoing_monitoring",
      title: o.title,
      whatItMeans: o.whatItMeans,
      ruleSummary: o.ruleSummary,
      whatToCollect: o.whatToCollect,
      evidence: o.evidence,
      legalBasis: ONGOING_BASIS[profile.jurisdiction],
      appliesAtRisk: ["low", "medium", "high"],
      eddTrigger: false,
    });
  }

  return out;
}
