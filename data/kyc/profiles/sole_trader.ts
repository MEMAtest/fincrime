import type { CddProfile } from "../types";
import { cite } from "../sources";
import { it, sec, edd, HI } from "./_helpers";

/** Sole trader / sole proprietor. Identified as a natural person; the individual is their own BO. */

const personEdd = (pep: ReturnType<typeof cite>, hrc: ReturnType<typeof cite>) => [
  edd("Sole trader is a PEP, family member or close associate", "Senior-management approval; source of wealth/funds; enhanced monitoring", pep),
  edd("High-risk country nexus or unusual activity for the trade", "Enhanced measures and scrutiny of source of funds", hrc),
];

export const soleTrader: CddProfile[] = [
  {
    entityType: "sole_trader",
    jurisdiction: "global",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fatf_r10"),
    boThreshold: "n/a (the sole trader is the beneficial owner)",
    sddEligibility: "SDD where lower risk (FATF R.10).",
    sections: [
      sec("identity", [
        it("Full name, date of birth, residential address and nationality", cite("fatf_r10", "fatf_in10")),
        it("Verify identity from reliable, independent documents", cite("fatf_r10")),
      ]),
      sec("nature_purpose", [
        it("Nature of the business / trade and purpose of the relationship", cite("fatf_r10")),
        it("Source of funds / wealth", cite("fatf_r10"), { risk: HI }),
      ]),
      sec("screening", [it("Sanctions, PEP and adverse-media screening", cite("fatf_r12"))]),
    ],
    eddTriggers: personEdd(cite("fatf_r12"), cite("fatf_r10")),
  },
  {
    entityType: "sole_trader",
    jurisdiction: "uk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("mlr_r28", "jmlsg_indiv"),
    boThreshold: "n/a (the sole trader is the beneficial owner)",
    sddEligibility: "SDD where lower risk (MLR reg. 37).",
    sections: [
      sec("identity", [
        it("Full name, residential address, date of birth, place of birth and nationality", cite("mlr_r28", "jmlsg_indiv")),
        it("Occupation (with reference to restricted-industry risk appetite)", cite("jmlsg_indiv")),
        it("Verify identity: certified proof of ID + proof of address", cite("mlr_r28")),
      ]),
      sec("legal_entity", [
        it("Trading name", cite("jmlsg_indiv"), { conditional: "if relevant" }),
        it("Evidence of the principal place of business", cite("jmlsg_indiv"), { conditional: "if different from residential address" }),
      ]),
      sec("nature_purpose", [
        it("Nature/purpose of the relationship; expected activity; how the client was sourced", cite("jmlsg_indiv")),
        it("Source of funds and source of wealth", cite("mlr_r28"), { risk: HI }),
      ]),
      sec("screening", [it("PEP, sanctions and adverse-media screening (incl. aliases)", cite("mlr_r35", "fca_fcg"))]),
    ],
    eddTriggers: [
      edd("PEP, high-risk country, or complex/unusually large transactions", "Apply EDD measures under MLR reg. 33/35", cite("mlr_r33", "mlr_r35")),
    ],
  },
  {
    entityType: "sole_trader",
    jurisdiction: "us",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("us_cip_banks"),
    boThreshold: "n/a (no legal entity; the individual is the BO)",
    sddEligibility: "No SDD tier; risk-based scrutiny.",
    sections: [
      sec("identity", [
        it("Name, date of birth, address and identification number (SSN or EIN)", cite("us_cip_banks")),
        it("Verify identity (documentary or non-documentary)", cite("us_cip_banks")),
      ]),
      sec("nature_purpose", [it("Understand the nature/purpose of the business; ongoing monitoring", cite("us_cdd"))]),
      sec("screening", [it("OFAC sanctions screening", cite("us_ffiec_pep"))]),
    ],
    eddTriggers: personEdd(cite("us_ffiec_pep"), cite("us_ffiec_pep")),
  },
  {
    entityType: "sole_trader",
    jurisdiction: "eu",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("eu_amld_13"),
    boThreshold: "n/a (the individual is the BO)",
    sddEligibility: "SDD where lower risk (Annex II).",
    sections: [
      sec("identity", [
        it("Full name, place and date of birth, all nationalities, residential address", cite("eu_amld_13", "eu_amlr_22")),
        it("Verify identity against reliable, independent sources", cite("eu_amld_13")),
      ]),
      sec("nature_purpose", [it("Purpose and nature of the relationship; ongoing monitoring", cite("eu_amld_13"))]),
      sec("screening", [it("PEP determination and sanctions screening", cite("eu_amld_pep"))]),
    ],
    eddTriggers: personEdd(cite("eu_amld_pep"), cite("eu_amld_edd")),
  },
  {
    entityType: "sole_trader",
    jurisdiction: "de",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("de_gwg_11"),
    boThreshold: "n/a (the individual is the BO)",
    sddEligibility: "Simplified DD where low risk (§14).",
    sections: [
      sec("identity", [
        it("First/last name, place and date of birth, nationality and residential address", cite("de_gwg_11")),
        it("Verify via valid photo ID; record document type, number and issuer", cite("de_gwg_12")),
      ]),
      sec("legal_entity", [it("Business name and Handelsregister number", cite("de_gwg_11"), { conditional: "where registered" })]),
      sec("screening", [it("PEP and sanctions screening", cite("de_gwg_15"))]),
    ],
    eddTriggers: personEdd(cite("de_gwg_15"), cite("de_gwg_15")),
  },
  {
    entityType: "sole_trader",
    jurisdiction: "fr",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fr_r5615"),
    boThreshold: "n/a (the individual is the BO)",
    sddEligibility: "Vigilance allégée where low risk.",
    sections: [
      sec("identity", [
        it("Surname, given names, date and place of birth", cite("fr_r5615")),
        it("Verify via valid photo-ID or eIDAS-certified eID", cite("fr_r5651")),
      ]),
      sec("legal_entity", [it("Trade name and SIREN number", cite("fr_r5615"), { conditional: "where registered" })]),
      sec("screening", [it("PEP and sanctions screening", cite("fr_l56110"))]),
    ],
    eddTriggers: personEdd(cite("fr_l56110"), cite("fr_l561102")),
  },
  {
    entityType: "sole_trader",
    jurisdiction: "sg",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("sg_n626_6"),
    boThreshold: "n/a (the individual is the BO)",
    sddEligibility: "SDD where low risk (§7).",
    sections: [
      sec("identity", [
        it("Full name, ID number, residential address, date of birth and nationality", cite("sg_n626_6")),
        it("Business registration (trade name, UEN)", cite("sg_n626_6")),
        it("Verify via reliable, independent documents", cite("sg_n626_6")),
      ]),
      sec("screening", [it("Screen the individual against ML/TF and sanctions lists", cite("sg_n626_6"))]),
    ],
    eddTriggers: personEdd(cite("sg_n626_edd"), cite("sg_n626_edd")),
  },
  {
    entityType: "sole_trader",
    jurisdiction: "hk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("hk_amlo_s2", "hk_hkma_gl"),
    boThreshold: "n/a (the individual is the BO)",
    sddEligibility: "SDD where low risk (s.4).",
    sections: [
      sec("identity", [
        it("Full name, date of birth, nationality, ID number and residential address", cite("hk_hkma_gl")),
        it("Verify identity from reliable, independent sources; understand the nature of the business", cite("hk_amlo_s2")),
      ]),
      sec("screening", [it("Sanctions, PEP and adverse-media screening", cite("hk_hkma_gl"))]),
    ],
    eddTriggers: personEdd(cite("hk_hkma_gl"), cite("hk_hkma_gl")),
  },
];
