import type { CddProfile } from "../types";
import { cite } from "../sources";
import { it, sec, edd } from "./_helpers";

/**
 * Regulated entity (a supervised credit / financial institution as the customer).
 * Lower inherent risk: SDD in most regimes, or an outright BO exemption in the US.
 */

export const regulatedEntity: CddProfile[] = [
  {
    entityType: "regulated_entity",
    jurisdiction: "global",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("fatf_r10"),
    boThreshold: "Reduced where the customer is a supervised FI",
    sddEligibility: "SDD where the customer is a regulated FI subject to AML obligations and supervised for compliance.",
    sections: [
      sec("legal_entity", [
        it("Name, legal form, registration number and registered office", cite("fatf_r10")),
        it("Evidence of regulated status with its home supervisor", cite("fatf_r10")),
      ]),
      sec("nature_purpose", [
        it("Nature of business and purpose of the relationship", cite("fatf_r10")),
      ]),
      sec("screening", [
        it("Screen the entity, signatories and authorised contacts", cite("fatf_r12")),
      ]),
    ],
    eddTriggers: [
      edd("Respondent in a correspondent relationship", "Enhanced due diligence on the respondent institution (FATF R.13)", cite("fatf_r13")),
    ],
    notes: "FATF baseline; SDD is conditional on a documented lower-risk assessment.",
  },
  {
    entityType: "regulated_entity",
    jurisdiction: "uk",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("mlr_r37", "jmlsg_regulated"),
    boThreshold: "Reduced (SDD)",
    sddEligibility: "SDD available (MLR reg. 37) where the entity is a regulated credit/financial institution and not on a restricted-industry list; approval from KYC advisory.",
    sections: [
      sec("legal_entity", [
        it("Legal name and trading names; registration number; country of incorporation", cite("mlr_r28", "jmlsg_regulated")),
        it("Registered office and principal place of business", cite("mlr_r28")),
      ]),
      sec("nature_purpose", [
        it("Nature of business; nature/purpose of the relationship; expected activity", cite("jmlsg_regulated")),
        it("Source of client / how the client was sourced", cite("jmlsg_regulated")),
      ]),
      sec("authority_signatory", [
        it("Proof of head-office regulated status from the home regulator (must be on the recognised-regulators list)", cite("jmlsg_regulated")),
        it("Proof of branch regulated status from the host regulator; inclusion in Bankers' Almanac / on the company website", cite("jmlsg_regulated"), { conditional: "for branches" }),
      ]),
      sec("screening", [
        it("PEP, sanctions and adverse-media screening of the entity (incl. previous/trading names), signatories and authorised contacts (incl. aliases)", cite("mlr_r35", "fca_fcg")),
      ]),
    ],
    eddTriggers: [
      edd("Correspondent banking relationship or higher-risk jurisdiction", "Apply EDD measures under MLR reg. 33/34", cite("mlr_r33")),
    ],
  },
  {
    entityType: "regulated_entity",
    jurisdiction: "us",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("us_cip_banks", "us_cdd"),
    boThreshold: "Exempt from BO identification",
    sddEligibility: "No SDD tier, but federally/state-regulated FIs are excluded legal-entity customers.",
    exemptionNote: "A regulated US financial institution is excluded from the legal-entity-customer definition under 31 CFR 1010.230(e)(2)(i), so beneficial-ownership identification is not required.",
    sections: [
      sec("legal_entity", [
        it("Legal name, physical location and TIN/EIN (CIP)", cite("us_cip_banks")),
        it("Confirm the entity is a federal/state-regulated financial institution", cite("us_cdd_e")),
      ]),
      sec("screening", [
        it("OFAC sanctions screening", cite("us_ffiec_pep")),
      ]),
    ],
    eddTriggers: [
      edd("Foreign financial institution correspondent account", "Risk-based / enhanced due diligence under 31 CFR 1010.610; no correspondent accounts for shell banks", cite("us_corresp")),
    ],
  },
  {
    entityType: "regulated_entity",
    jurisdiction: "eu",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("eu_amld_13", "eu_amld_sdd"),
    boThreshold: "Reduced (SDD)",
    sddEligibility: "SDD where the customer is a supervised EU/EEA financial institution (Annex II lower-risk factor).",
    sections: [
      sec("legal_entity", [
        it("Name, legal form, registration number and registered office", cite("eu_amld_13")),
        it("Confirm supervised/authorised status", cite("eu_amld_sdd")),
      ]),
      sec("screening", [
        it("PEP determination and sanctions screening", cite("eu_amld_pep")),
      ]),
    ],
    eddTriggers: [
      edd("Correspondent relationship or high-risk third country", "Enhanced measures per Arts. 18-18a", cite("eu_amld_edd")),
    ],
  },
  {
    entityType: "regulated_entity",
    jurisdiction: "de",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("de_gwg_10", "de_gwg_14"),
    boThreshold: "Reduced (SDD)",
    sddEligibility: "Simplified DD where the counterpart is a supervised institution subject to equivalent AML obligations (GwG §14; BaFin AuA).",
    sections: [
      sec("legal_entity", [
        it("Company name, legal form, register number and registered office", cite("de_gwg_11")),
        it("Confirm supervised status", cite("de_gwg_14")),
      ]),
      sec("screening", [
        it("PEP and sanctions screening", cite("de_gwg_15")),
      ]),
    ],
    eddTriggers: [
      edd("Correspondent relationship with a respondent in a high-risk third country", "Enhanced measures per §15(3) Nr.4", cite("de_gwg_15")),
    ],
  },
  {
    entityType: "regulated_entity",
    jurisdiction: "fr",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("fr_l5615", "fr_r56115"),
    boThreshold: "Reduced (vigilance allégée)",
    sddEligibility: "Simplified vigilance where the client is a French/EU regulated and supervised entity (CMF R.561-15(1)).",
    sections: [
      sec("legal_entity", [
        it("Name, legal form, registration number and registered office", cite("fr_r5615")),
        it("Verify supervised status (e.g. ACPR/AMF register / REGAFI)", cite("fr_r56115")),
      ]),
      sec("screening", [
        it("PEP and sanctions screening", cite("fr_l56110")),
      ]),
    ],
    eddTriggers: [
      edd("Correspondent banking relationship", "Enhanced vigilance per L.561-10-3 (no relationship with shell banks)", cite("fr_l56110")),
    ],
  },
  {
    entityType: "regulated_entity",
    jurisdiction: "sg",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("sg_n626_6", "sg_n626_sdd"),
    boThreshold: "Reduced (SDD)",
    sddEligibility: "SDD where the customer is a MAS-regulated FI or an FI from an equivalent jurisdiction (Notice 626 §7, Appendix 2).",
    sections: [
      sec("legal_entity", [
        it("Full name; registration number (UEN); place of incorporation", cite("sg_n626_6")),
        it("Verify current licensed/regulated status", cite("sg_n626_sdd")),
      ]),
      sec("screening", [
        it("Screen the entity, persons acting on its behalf and BOs", cite("sg_n626_6")),
      ]),
    ],
    eddTriggers: [
      edd("Counterpart from a FATF counter-measure jurisdiction", "SDD not permitted; apply EDD per §8", cite("sg_n626_edd")),
    ],
  },
  {
    entityType: "regulated_entity",
    jurisdiction: "hk",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("hk_amlo_s2", "hk_amlo_s4"),
    boThreshold: "Reduced (SDD; FI-to-FI)",
    sddEligibility: "SDD where the customer is an FI supervised in HK or an equivalent jurisdiction (AMLO Sch. 2 s.4).",
    sections: [
      sec("legal_entity", [
        it("Full legal name; registration number and jurisdiction of incorporation", cite("hk_amlo_s2")),
        it("Confirm the entity is subject to equivalent AML obligations and effective supervision", cite("hk_amlo_s4")),
      ]),
      sec("screening", [
        it("Sanctions, PEP and adverse-media screening", cite("hk_hkma_gl")),
      ]),
    ],
    eddTriggers: [
      edd("Correspondent relationship or higher-risk jurisdiction", "Enhanced measures per HKMA Guideline ch.4", cite("hk_hkma_gl")),
    ],
  },
];
