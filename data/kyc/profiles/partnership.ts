import type { CddProfile } from "../types";
import { cite } from "../sources";
import { it, sec, edd, HI, MH } from "./_helpers";

/** Partnership (general partnership and equivalents). */

export const partnership: CddProfile[] = [
  {
    entityType: "partnership",
    jurisdiction: "global",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fatf_r10", "fatf_r24"),
    boThreshold: "25% of capital, profits or voting rights",
    sddEligibility: "SDD where lower risk (FATF R.10).",
    sections: [
      sec("legal_entity", [
        it("Name, proof of existence and the partnership agreement", cite("fatf_r10")),
        it("Registration number and principal place of business", cite("fatf_r10")),
      ]),
      sec("beneficial_ownership", [
        it("Identify natural persons controlling the partnership", cite("fatf_r24"), { threshold: "more than 25%" }),
      ]),
      sec("nature_purpose", [
        it("Nature of business and purpose of the relationship", cite("fatf_r10")),
      ]),
      sec("screening", [
        it("Screen the partnership, partners and beneficial owners", cite("fatf_r12")),
      ]),
    ],
    eddTriggers: [
      edd("PEP or high-risk country nexus", "Enhanced measures (FATF R.12/19)", cite("fatf_r12")),
    ],
  },
  {
    entityType: "partnership",
    jurisdiction: "uk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("mlr_r28", "jmlsg_corp"),
    boThreshold: "25% (more than 25% of capital, profits or voting rights)",
    sddEligibility: "SDD where lower risk (MLR reg. 37).",
    sections: [
      sec("legal_entity", [
        it("Evidence of legal existence; legal name and trading names", cite("mlr_r28", "jmlsg_corp")),
        it("Registration number; country of incorporation; registered office and principal place of business", cite("mlr_r28")),
        it("Partnership agreement and founding/constitutional documents", cite("jmlsg_corp")),
      ]),
      sec("nature_purpose", [
        it("Nature of business; expected account activity; annual accounts", cite("jmlsg_corp")),
        it("Source of funds and source of wealth", cite("mlr_r28"), { risk: HI }),
      ]),
      sec("authority_signatory", [
        it("Evidence of authority; verify the signatory's identity", cite("mlr_r28")),
      ]),
      sec("directors_controllers", [
        it("Identify and verify 2 partners", cite("jmlsg_corp"), { risk: ["low"] }),
        it("Verify a minimum of 5 partners (or all if fewer), up to 50%", cite("jmlsg_corp"), { risk: MH }),
      ]),
      sec("beneficial_ownership", [
        it("Identify ownership/control including intermediaries; verify UBOs", cite("mlr_r28"), { threshold: "25%+ (LR/MR); 10%+ (HR)" }),
      ]),
      sec("screening", [
        it("Screen the entity, partners, intermediary owners and signatories", cite("mlr_r35", "fca_fcg")),
      ]),
    ],
    eddTriggers: [
      edd("Higher-risk rating or PEP exposure", "EDD form; verify source of funds/wealth; external EDD report", cite("mlr_r33")),
    ],
  },
  {
    entityType: "partnership",
    jurisdiction: "us",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("us_cip_banks", "us_cdd"),
    boThreshold: "25% ownership prong + control-prong individual",
    sddEligibility: "No SDD tier; risk-based scrutiny.",
    sections: [
      sec("legal_entity", [
        it("Legal name, principal place of business and TIN/EIN", cite("us_cip_banks")),
      ]),
      sec("beneficial_ownership", [
        it("Each individual owning 25%+ of the partnership (up to four)", cite("us_cdd_d"), { threshold: "25% or more" }),
        it("The managing/general partner under the control prong", cite("us_cdd_d")),
      ]),
      sec("nature_purpose", [
        it("Understand nature and purpose; ongoing monitoring", cite("us_cdd")),
      ]),
      sec("screening", [
        it("OFAC sanctions screening of the entity and BOs", cite("us_ffiec_pep")),
      ]),
    ],
    eddTriggers: [
      edd("Higher-risk customer, geography or product", "Risk-based enhanced due diligence", cite("us_ffiec_pep")),
    ],
  },
  {
    entityType: "partnership",
    jurisdiction: "eu",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("eu_amld_13", "eu_amld_bo"),
    boThreshold: "25% (more than 25%)",
    sddEligibility: "SDD where lower risk (Annex II).",
    sections: [
      sec("legal_entity", [
        it("Name, legal form, registration number and registered office; partnership agreement", cite("eu_amld_13")),
      ]),
      sec("beneficial_ownership", [
        it("Natural person(s) owning or controlling more than 25%; senior managing official fallback", cite("eu_amld_bo"), { threshold: "more than 25%" }),
      ]),
      sec("screening", [
        it("PEP determination and sanctions screening", cite("eu_amld_pep")),
      ]),
    ],
    eddTriggers: [
      edd("PEP, high-risk third country or complex structure (Annex III)", "Enhanced measures per Arts. 18-18a", cite("eu_amld_edd")),
    ],
  },
  {
    entityType: "partnership",
    jurisdiction: "de",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("de_gwg_11", "de_gwg_3"),
    boThreshold: "25% (more than 25% of partnership interests)",
    sddEligibility: "Simplified DD where low risk (§14).",
    sections: [
      sec("legal_entity", [
        it("Name, legal form (OHG/KG/GbR), Handelsregister number and registered office", cite("de_gwg_11")),
        it("Names of managing partners / legal representatives", cite("de_gwg_11")),
      ]),
      sec("beneficial_ownership", [
        it("Natural person holding more than 25% of interests or comparable control; register in Transparenzregister", cite("de_gwg_3", "de_gwg_20"), { threshold: "more than 25%" }),
      ]),
      sec("screening", [
        it("PEP and sanctions screening", cite("de_gwg_15")),
      ]),
    ],
    eddTriggers: [
      edd("PEP, high-risk third country or complex/unusual transactions", "Enhanced measures per §15(3)", cite("de_gwg_15")),
    ],
  },
  {
    entityType: "partnership",
    jurisdiction: "fr",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fr_r5615", "fr_r5611"),
    boThreshold: "25% (more than 25% of capital or voting rights)",
    sddEligibility: "Vigilance allégée where low risk (R.561-15).",
    sections: [
      sec("legal_entity", [
        it("Legal form (SNC/SCI), name, SIREN and registered office; K-bis under 3 months", cite("fr_r5615", "fr_r5651")),
      ]),
      sec("beneficial_ownership", [
        it("Natural person holding more than 25%, or exercising control; gérant fallback; cross-check the RBE", cite("fr_r5611", "fr_rbe"), { threshold: "more than 25%" }),
      ]),
      sec("screening", [
        it("PEP and sanctions screening", cite("fr_l56110")),
      ]),
    ],
    eddTriggers: [
      edd("Property holding (e.g. SCI), cross-border ownership or complex chain", "Vigilance renforcée per L.561-10 / L.561-10-2", cite("fr_l56110", "fr_l561102")),
    ],
  },
  {
    entityType: "partnership",
    jurisdiction: "sg",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("sg_n626_6", "sg_n626_bo"),
    boThreshold: "25% (more than 25% of profits/capital/voting)",
    sddEligibility: "SDD only where a licensed entity (Appendix 2).",
    sections: [
      sec("legal_entity", [
        it("Full name; registration number (UEN); partnership/LLP agreement", cite("sg_n626_6")),
        it("Persons with executive authority (e.g. managing partner)", cite("sg_n626_6")),
      ]),
      sec("beneficial_ownership", [
        it("Cascading identification of partners owning/controlling more than 25%", cite("sg_n626_bo"), { threshold: "more than 25%" }),
      ]),
      sec("screening", [
        it("Screen the entity, partners and BOs", cite("sg_n626_6")),
      ]),
    ],
    eddTriggers: [
      edd("PEP, FATF counter-measure country or complex structure", "EDD per Notice 626 §8", cite("sg_n626_edd")),
    ],
  },
  {
    entityType: "partnership",
    jurisdiction: "hk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("hk_amlo_s2", "hk_amlo_bo"),
    boThreshold: "25% (more than 25% of capital, profits or voting rights)",
    sddEligibility: "SDD only where a regulated FI (s.4).",
    sections: [
      sec("legal_entity", [
        it("Full name; registration; partnership agreement", cite("hk_amlo_s2", "hk_hkma_gl")),
      ]),
      sec("beneficial_ownership", [
        it("Individual entitled to or controlling more than 25% of capital, profits or voting rights, or exercising ultimate control", cite("hk_amlo_bo"), { threshold: "more than 25%" }),
      ]),
      sec("screening", [
        it("Sanctions, PEP and adverse-media screening", cite("hk_hkma_gl")),
      ]),
    ],
    eddTriggers: [
      edd("PEP, high-risk jurisdiction or opaque structure", "Enhanced due diligence per HKMA Guideline ch.4", cite("hk_hkma_gl")),
    ],
  },
];
