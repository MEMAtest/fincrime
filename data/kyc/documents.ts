import type { Source } from "../typologies/types";
import type { CddSectionKey, DocumentGuidance, Jurisdiction } from "./types";
import { SRC } from "./sources";

/**
 * Jurisdiction-aware acceptable-documents catalogue. Turns a generic collect item
 * (e.g. "verify identity") into the concrete documents a firm may accept in that
 * jurisdiction, each backed by a cited provision. Grounded in JMLSG / CIP / local norms.
 */

export type DocGroupKey = "accepted_id" | "accepted_address" | "accepted_registry";

const LABEL: Record<DocGroupKey, string> = {
  accepted_id: "Accepted identity documents",
  accepted_address: "Accepted proof of address",
  accepted_registry: "Accepted entity / registry evidence",
};

type Entry = { accepted: string[]; source: Source };

const ACCEPTABLE_DOCUMENTS: Record<DocGroupKey, Partial<Record<Jurisdiction, Entry>>> = {
  accepted_id: {
    global: { accepted: ["Valid passport", "Government-issued national identity card", "Government-issued photo ID"], source: SRC.fatf_in10 },
    uk: { accepted: ["Valid passport", "UK photocard driving licence", "National identity card (EEA / Swiss)", "Biometric residence permit", "HM Forces ID card"], source: SRC.jmlsg_indiv },
    us: { accepted: ["Unexpired US passport", "State-issued driver's licence or ID card", "For non-US persons: foreign passport (with a taxpayer ID / passport number + country of issuance)"], source: SRC.us_cip_banks },
    eu: { accepted: ["National identity card", "Valid passport", "Residence permit"], source: SRC.eu_amld_13 },
    de: { accepted: ["Personalausweis (national ID card)", "Reisepass (passport)", "Electronic identity verification (eID)"], source: SRC.de_gwg_12 },
    fr: { accepted: ["Carte nationale d'identité", "Passport", "Titre de séjour (residence permit)"], source: SRC.fr_r5651 },
    sg: { accepted: ["NRIC (Singapore)", "FIN / work pass", "Valid passport"], source: SRC.sg_n626_6 },
    hk: { accepted: ["Hong Kong Identity Card (HKID)", "Valid passport / travel document"], source: SRC.hk_hkma_gl },
  },
  accepted_address: {
    global: { accepted: ["Recent utility bill", "Bank or financial statement", "Government / tax correspondence"], source: SRC.fatf_in10 },
    uk: { accepted: ["Utility bill (within 3 months)", "Bank or building-society statement (within 3 months)", "Current council-tax bill", "HMRC / government correspondence"], source: SRC.jmlsg_indiv },
    us: { accepted: ["Residential or business street address (PO boxes not sufficient alone)", "Utility bill or bank statement", "Lease agreement"], source: SRC.us_cip_banks },
    eu: { accepted: ["Utility bill (within 3 months)", "Bank statement", "Official / government correspondence"], source: SRC.eu_amld_13 },
    de: { accepted: ["Meldebescheinigung / registration confirmation", "Utility bill or bank statement (within 3 months)"], source: SRC.de_gwg_11 },
    fr: { accepted: ["Justificatif de domicile (utility bill within 3 months)", "Bank statement", "Tax notice (avis d'imposition)"], source: SRC.fr_r5615 },
    sg: { accepted: ["Utility bill or bank statement (within 3 months)", "Government correspondence"], source: SRC.sg_n626_6 },
    hk: { accepted: ["Utility bill or bank statement (within 3 months)", "Government correspondence"], source: SRC.hk_hkma_gl },
  },
  accepted_registry: {
    global: { accepted: ["Company registry extract", "Certificate of incorporation / formation documents"], source: SRC.fatf_r24 },
    uk: { accepted: ["Companies House extract / online search", "Certificate of incorporation", "Articles of association"], source: SRC.jmlsg_corp },
    us: { accepted: ["Secretary of State filing / certificate of good standing", "Formation documents (articles of incorporation / organization)", "EIN confirmation"], source: SRC.us_cip_banks },
    eu: { accepted: ["National business-register extract", "Certificate of incorporation"], source: SRC.eu_amld_13 },
    de: { accepted: ["Handelsregisterauszug (commercial register extract)", "Gesellschaftsvertrag / founding documents"], source: SRC.de_gwg_12 },
    fr: { accepted: ["Extrait K-bis (within 3 months)", "Statuts (constitutional documents)"], source: SRC.fr_r5651 },
    sg: { accepted: ["ACRA business profile / Bizfile", "Constitution / Memorandum & Articles"], source: SRC.sg_n626_6 },
    hk: { accepted: ["Companies Registry extract / search", "Certificate of incorporation", "Articles of association"], source: SRC.hk_hkma_gl },
  },
};

/** Which acceptable-document groups apply to a given requirement (section). */
const SECTION_TO_DOCGROUPS: Partial<Record<CddSectionKey, DocGroupKey[]>> = {
  identity: ["accepted_id", "accepted_address"],
  legal_entity: ["accepted_registry"],
  beneficial_ownership: ["accepted_registry", "accepted_id"],
};

/** Resolve the jurisdiction-specific acceptable documents for a requirement, falling back to global. */
export function documentGuidanceFor(sectionKey: CddSectionKey, jurisdiction: Jurisdiction): DocumentGuidance[] {
  const groups = SECTION_TO_DOCGROUPS[sectionKey];
  if (!groups) return [];
  const out: DocumentGuidance[] = [];
  for (const g of groups) {
    const entry = ACCEPTABLE_DOCUMENTS[g][jurisdiction] ?? ACCEPTABLE_DOCUMENTS[g].global;
    if (entry) out.push({ label: LABEL[g], accepted: entry.accepted, source: entry.source });
  }
  return out;
}
