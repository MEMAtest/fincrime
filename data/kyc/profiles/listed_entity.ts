import type { CddProfile } from "../types";
import { cite } from "../sources";
import { it, sec, edd } from "./_helpers";

/**
 * Listed entity (company admitted to trading on a recognised exchange).
 * Lower inherent risk: exchange disclosure supports SDD / BO exemption.
 */

export const listedEntity: CddProfile[] = [
  {
    entityType: "listed_entity",
    jurisdiction: "global",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("fatf_r10", "fatf_r24"),
    boThreshold: "Reduced where subject to adequate disclosure",
    sddEligibility: "SDD where the company is listed and subject to disclosure requirements ensuring transparency of beneficial ownership.",
    sections: [
      sec("legal_entity", [
        it("Name, legal form, registration number and registered office", cite("fatf_r10")),
        it("Evidence of listing on a recognised exchange", cite("fatf_r24")),
      ]),
      sec("nature_purpose", [
        it("Nature of business and purpose of the relationship", cite("fatf_r10")),
      ]),
      sec("screening", [
        it("Screen the entity and signatories", cite("fatf_r12")),
      ]),
    ],
    eddTriggers: [
      edd("Listing on an exchange with weak disclosure / higher-risk nexus", "Treat as standard or enhanced CDD", cite("fatf_r10")),
    ],
  },
  {
    entityType: "listed_entity",
    jurisdiction: "uk",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("mlr_r37", "jmlsg_listed"),
    boThreshold: "Reduced (SDD) where listed on a recognised exchange",
    sddEligibility: "SDD (MLR reg. 37) where listed on a recognised exchange subject to disclosure obligations.",
    sections: [
      sec("legal_entity", [
        it("Legal name and trading names; registration number; country of incorporation", cite("mlr_r28", "jmlsg_listed")),
        it("Registered office and principal place of business", cite("mlr_r28")),
        it("Proof of listing from the exchange website (exchange on the recognised-exchanges list)", cite("jmlsg_listed")),
        it("Proof of registration from the registrar of companies", cite("jmlsg_listed")),
      ]),
      sec("nature_purpose", [
        it("Nature of business; nature/purpose of the relationship; expected activity", cite("jmlsg_listed")),
        it("Audited annual accounts / financials; how the client was sourced", cite("jmlsg_listed")),
      ]),
      sec("beneficial_ownership", [
        it("Evidence of relationship to the listed parent and screening of intermediary layers up to the listed entity", cite("jmlsg_listed"), { conditional: "for branches / subsidiaries" }),
      ]),
      sec("screening", [
        it("PEP, sanctions and adverse-media screening of the entity (incl. previous/trading names), signatories and authorised contacts", cite("mlr_r35", "fca_fcg")),
      ]),
    ],
    eddTriggers: [
      edd("Higher-risk jurisdiction or PEP exposure", "Apply EDD measures under MLR reg. 33", cite("mlr_r33")),
    ],
  },
  {
    entityType: "listed_entity",
    jurisdiction: "us",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("us_cip_banks", "us_cdd"),
    boThreshold: "Exempt from BO identification",
    sddEligibility: "No SDD tier, but publicly-traded issuers are excluded legal-entity customers.",
    exemptionNote: "Companies registered under §12 of the Securities Exchange Act (and 51%+ subsidiaries) are excluded under 31 CFR 1010.230(e)(2)(vi), so no beneficial-ownership collection is required.",
    sections: [
      sec("legal_entity", [
        it("Legal name, physical location and TIN/EIN (CIP)", cite("us_cip_banks")),
        it("Confirm the entity is registered under Exchange Act §12 (or a qualifying subsidiary)", cite("us_cdd_e")),
      ]),
      sec("screening", [
        it("OFAC sanctions screening", cite("us_ffiec_pep")),
      ]),
    ],
    eddTriggers: [
      edd("Higher-risk activity inconsistent with the issuer's profile", "Risk-based enhanced due diligence (FFIEC)", cite("us_ffiec_pep")),
    ],
  },
  {
    entityType: "listed_entity",
    jurisdiction: "eu",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("eu_amld_13", "eu_amld_sdd"),
    boThreshold: "Reduced (SDD)",
    sddEligibility: "SDD for companies listed on a regulated market subject to adequate BO-transparency requirements (Annex II).",
    sections: [
      sec("legal_entity", [
        it("Name, legal form, registration number and registered office", cite("eu_amld_13")),
        it("Evidence of listing on a regulated market", cite("eu_amld_sdd")),
      ]),
      sec("screening", [
        it("PEP determination and sanctions screening", cite("eu_amld_pep")),
      ]),
    ],
    eddTriggers: [
      edd("High-risk third country or complex activity (Annex III)", "Enhanced measures per Arts. 18-18a", cite("eu_amld_edd")),
    ],
  },
  {
    entityType: "listed_entity",
    jurisdiction: "de",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("de_gwg_3", "de_gwg_14"),
    boThreshold: "Exempt from full BO identification (organised market)",
    sddEligibility: "Simplified DD (GwG §14, Anlage 1).",
    exemptionNote: "Companies on an organised market (WpHG §2(11)) subject to EU-equivalent transparency are exempt from full BO identification under GwG §3(2).",
    sections: [
      sec("legal_entity", [
        it("Company name, legal form, register number and registered office", cite("de_gwg_11")),
        it("Evidence of admission to an organised/regulated market", cite("de_gwg_3")),
      ]),
      sec("screening", [
        it("PEP and sanctions screening", cite("de_gwg_15")),
      ]),
    ],
    eddTriggers: [
      edd("High-risk third country or complex/unusual transactions", "Enhanced measures per §15(3)", cite("de_gwg_15")),
    ],
  },
  {
    entityType: "listed_entity",
    jurisdiction: "fr",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("fr_l5615", "fr_r56115"),
    boThreshold: "Reduced (vigilance allégée) on BO identification",
    sddEligibility: "Simplified vigilance for companies listed on an EU/EEA regulated market (CMF R.561-15(2)).",
    sections: [
      sec("legal_entity", [
        it("Name, legal form, registration number (SIREN) and registered office", cite("fr_r5615")),
        it("Evidence of listing on a qualifying regulated market", cite("fr_r56115")),
      ]),
      sec("screening", [
        it("PEP and sanctions screening", cite("fr_l56110")),
      ]),
    ],
    eddTriggers: [
      edd("Any ML/TF suspicion or high-risk country nexus", "SDD unavailable; apply enhanced vigilance per L.561-10", cite("fr_l56110")),
    ],
  },
  {
    entityType: "listed_entity",
    jurisdiction: "sg",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("sg_n626_6", "sg_n626_sdd"),
    boThreshold: "Reduced (SDD)",
    sddEligibility: "SDD for companies listed on SGX or an overseas exchange with equivalent disclosure (Notice 626 §7, Appendix 2).",
    sections: [
      sec("legal_entity", [
        it("Full name; registration number (UEN); place of incorporation", cite("sg_n626_6")),
        it("Evidence of listing on an approved exchange", cite("sg_n626_sdd")),
      ]),
      sec("screening", [
        it("Screen the entity and persons acting on its behalf", cite("sg_n626_6")),
      ]),
    ],
    eddTriggers: [
      edd("FATF counter-measure jurisdiction or ML/TF suspicion", "SDD not permitted; apply EDD per §8", cite("sg_n626_edd")),
    ],
  },
  {
    entityType: "listed_entity",
    jurisdiction: "hk",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("hk_amlo_s4", "hk_hkma_gl"),
    boThreshold: "Reduced (SDD)",
    sddEligibility: "SDD for companies on the SEHK or a recognised exchange whose disclosure regime meets the AMLO conditions (AMLO Sch. 2 s.4).",
    sections: [
      sec("legal_entity", [
        it("Full legal name; registration number and jurisdiction of incorporation", cite("hk_amlo_s2")),
        it("Evidence of listing and an equivalent disclosure regime", cite("hk_amlo_s4")),
      ]),
      sec("screening", [
        it("Sanctions, PEP and adverse-media screening", cite("hk_hkma_gl")),
      ]),
    ],
    eddTriggers: [
      edd("Higher-risk jurisdiction or ML/TF suspicion", "Re-escalate to standard or enhanced CDD", cite("hk_hkma_gl")),
    ],
  },
];
