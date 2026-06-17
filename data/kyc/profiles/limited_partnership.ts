import type { CddProfile } from "../types";
import { cite } from "../sources";
import { it, sec, edd, HI } from "./_helpers";

/** Limited partnership (incl. limited partnership funds). General partners verified; limited partners by threshold. */

export const limitedPartnership: CddProfile[] = [
  {
    entityType: "limited_partnership",
    jurisdiction: "global",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fatf_r10", "fatf_r24"),
    boThreshold: "25% of capital, profits or voting rights; general partners identified",
    sddEligibility: "SDD where lower risk (FATF R.10).",
    sections: [
      sec("legal_entity", [it("Name, proof of existence and the limited-partnership agreement", cite("fatf_r10"))]),
      sec("beneficial_ownership", [
        it("Identify and verify the general partner(s); identify limited partners controlling the LP", cite("fatf_r24"), { threshold: "more than 25%" }),
      ]),
      sec("screening", [it("Screen the LP, general partners and beneficial owners", cite("fatf_r12"))]),
    ],
    eddTriggers: [edd("PEP or high-risk nexus", "Enhanced measures (FATF R.12/19)", cite("fatf_r12"))],
  },
  {
    entityType: "limited_partnership",
    jurisdiction: "uk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("mlr_r28", "jmlsg_corp"),
    boThreshold: "Limited partners 25%+ (LR/MR) / 10%+ (HR); general partners identified & verified",
    sddEligibility: "SDD where lower risk (MLR reg. 37).",
    sections: [
      sec("legal_entity", [
        it("Evidence of legal existence; LP5 form or partnership agreement", cite("mlr_r28", "jmlsg_corp")),
        it("Registration number; registered office and principal place of business", cite("mlr_r28")),
      ]),
      sec("nature_purpose", [
        it("Nature of business; expected activity; annual accounts", cite("jmlsg_corp")),
        it("Source of funds and source of wealth", cite("mlr_r28"), { risk: HI }),
      ]),
      sec("directors_controllers", [
        it("Identify and verify the general partner(s); identify the fund manager where applicable", cite("jmlsg_corp")),
      ]),
      sec("beneficial_ownership", [
        it("Identify limited partners and verify UBOs", cite("mlr_r28"), { threshold: "25%+ (LR/MR); 10%+ (HR)" }),
      ]),
      sec("screening", [
        it("Screen the entity, general/limited partners, fund managers and signatories", cite("mlr_r35", "fca_fcg")),
      ]),
    ],
    eddTriggers: [edd("Higher-risk rating or PEP exposure", "EDD form; verify source of funds/wealth; external EDD report", cite("mlr_r33"))],
  },
  {
    entityType: "limited_partnership",
    jurisdiction: "us",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("us_cip_banks", "us_cdd"),
    boThreshold: "25% ownership prong + control-prong individual",
    sddEligibility: "No SDD tier; risk-based scrutiny.",
    sections: [
      sec("legal_entity", [it("Legal name, principal place of business and TIN/EIN", cite("us_cip_banks"))]),
      sec("beneficial_ownership", [
        it("Each individual owning 25%+ (up to four) plus the general/managing partner under the control prong", cite("us_cdd_d"), { threshold: "25% or more" }),
      ]),
      sec("screening", [it("OFAC sanctions screening of the entity and BOs", cite("us_ffiec_pep"))]),
    ],
    eddTriggers: [edd("Higher-risk customer, geography or product", "Risk-based enhanced due diligence", cite("us_ffiec_pep"))],
  },
  {
    entityType: "limited_partnership",
    jurisdiction: "eu",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("eu_amld_13", "eu_amld_bo"),
    boThreshold: "25% (more than 25%); BO identified at 10% for some LP structures",
    sddEligibility: "SDD where lower risk (Annex II).",
    sections: [
      sec("legal_entity", [it("Name, legal form, registration number and registered office; LP agreement", cite("eu_amld_13"))]),
      sec("beneficial_ownership", [
        it("General partner(s) and natural persons controlling more than 25%; senior managing official fallback", cite("eu_amld_bo"), { threshold: "more than 25%" }),
      ]),
      sec("screening", [it("PEP determination and sanctions screening", cite("eu_amld_pep"))]),
    ],
    eddTriggers: [edd("PEP, high-risk third country or complex structure (Annex III)", "Enhanced measures per Arts. 18-18a", cite("eu_amld_edd"))],
  },
  {
    entityType: "limited_partnership",
    jurisdiction: "de",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("de_gwg_11", "de_gwg_3"),
    boThreshold: "25% (more than 25% of interests)",
    sddEligibility: "Simplified DD where low risk (§14).",
    sections: [
      sec("legal_entity", [it("Name, legal form (KG), Handelsregister number, registered office; general partner (Komplementär) as representative", cite("de_gwg_11"))]),
      sec("beneficial_ownership", [
        it("Natural person holding more than 25% or comparable control; register in the Transparenzregister", cite("de_gwg_3", "de_gwg_20"), { threshold: "more than 25%" }),
      ]),
      sec("screening", [it("PEP and sanctions screening", cite("de_gwg_15"))]),
    ],
    eddTriggers: [edd("PEP, high-risk third country or complex/unusual transactions", "Enhanced measures per §15(3)", cite("de_gwg_15"))],
  },
  {
    entityType: "limited_partnership",
    jurisdiction: "fr",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fr_r5615", "fr_r5611"),
    boThreshold: "25% (more than 25% of capital or voting rights)",
    sddEligibility: "Vigilance allégée where low risk (R.561-15).",
    sections: [
      sec("legal_entity", [it("Legal form (SCS/SCA), name, SIREN and registered office; K-bis under 3 months", cite("fr_r5615", "fr_r5651"))]),
      sec("beneficial_ownership", [
        it("Natural person holding more than 25% or exercising control; gérant fallback; cross-check the RBE", cite("fr_r5611", "fr_rbe"), { threshold: "more than 25%" }),
      ]),
      sec("screening", [it("PEP and sanctions screening", cite("fr_l56110"))]),
    ],
    eddTriggers: [edd("PEP, high-risk third country or complex chain", "Vigilance renforcée per L.561-10", cite("fr_l56110"))],
  },
  {
    entityType: "limited_partnership",
    jurisdiction: "sg",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("sg_n626_6", "sg_n626_bo"),
    boThreshold: "25% (more than 25%, cascading)",
    sddEligibility: "SDD only where a licensed entity (Appendix 2).",
    sections: [
      sec("legal_entity", [it("Full name; registration number (UEN); LP/LLP agreement; persons with executive authority", cite("sg_n626_6"))]),
      sec("beneficial_ownership", [
        it("Cascading identification of partners owning/controlling more than 25%", cite("sg_n626_bo"), { threshold: "more than 25%" }),
      ]),
      sec("screening", [it("Screen the entity, partners and BOs", cite("sg_n626_6"))]),
    ],
    eddTriggers: [edd("PEP, FATF counter-measure country or complex structure", "EDD per Notice 626 §8", cite("sg_n626_edd"))],
  },
  {
    entityType: "limited_partnership",
    jurisdiction: "hk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("hk_amlo_s2", "hk_amlo_bo"),
    boThreshold: "25% (more than 25% of capital, profits or voting rights)",
    sddEligibility: "SDD only where a regulated FI (s.4).",
    sections: [
      sec("legal_entity", [it("Full name; registration; LP agreement; the general partner / responsible person", cite("hk_amlo_s2", "hk_hkma_gl"))]),
      sec("beneficial_ownership", [
        it("Individual controlling more than 25% of capital, profits or voting rights, or exercising ultimate control", cite("hk_amlo_bo"), { threshold: "more than 25%" }),
      ]),
      sec("screening", [it("Sanctions, PEP and adverse-media screening", cite("hk_hkma_gl"))]),
    ],
    eddTriggers: [edd("PEP, high-risk jurisdiction or opaque structure", "Enhanced due diligence per HKMA Guideline ch.4", cite("hk_hkma_gl"))],
  },
];
