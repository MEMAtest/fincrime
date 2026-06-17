import type { CddProfile } from "../types";
import { cite } from "../sources";
import { it, sec, edd, HI, MH } from "./_helpers";

/** Corporate (private limited / joint-stock company and equivalents). */

export const corporate: CddProfile[] = [
  {
    entityType: "corporate",
    jurisdiction: "global",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fatf_r10", "fatf_r24"),
    boThreshold: "25%",
    sddEligibility: "SDD where lower risk (FATF R.10 risk-based approach).",
    sections: [
      sec("legal_entity", [
        it("Name, legal form and proof of existence", cite("fatf_r10")),
        it("Registration number, registered office and principal place of business", cite("fatf_r10")),
        it("Powers that regulate and bind the company (constitution)", cite("fatf_r10")),
      ]),
      sec("nature_purpose", [
        it("Nature of business and purpose of the relationship", cite("fatf_r10")),
        it("Source of funds / wealth", cite("fatf_r10"), { risk: HI }),
      ]),
      sec("beneficial_ownership", [
        it("Identify the natural person(s) ultimately owning or controlling the company", cite("fatf_r24"), { threshold: "more than 25%" }),
        it("Understand the ownership and control structure", cite("fatf_r10", "fatf_r24")),
        it("Where no owner is identified, the natural person exercising control through other means / senior managing official", cite("fatf_r24")),
      ]),
      sec("screening", [
        it("Screen the entity, directors and beneficial owners", cite("fatf_r12")),
      ]),
    ],
    eddTriggers: [
      edd("PEP among directors or beneficial owners", "Senior-management approval; source of wealth/funds; enhanced monitoring", cite("fatf_r12")),
      edd("High-risk country nexus", "Enhanced measures (FATF R.10/19)", cite("fatf_r10")),
    ],
    notes: "FATF baseline; national law specifies exact data fields and verification.",
  },
  {
    entityType: "corporate",
    jurisdiction: "uk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("mlr_r28", "jmlsg_corp"),
    boThreshold: "25% (more than 25% of shares or voting rights)",
    sddEligibility: "SDD where lower risk (MLR reg. 37) and not on a restricted-industry list.",
    sections: [
      sec("legal_entity", [
        it("Evidence of legal existence; legal name and trading names", cite("mlr_r28", "jmlsg_corp")),
        it("Registration number and date of incorporation", cite("mlr_r28")),
        it("Country of incorporation; registered office and principal place of business", cite("mlr_r28")),
        it("Founding / constitutional documents", cite("jmlsg_corp")),
      ]),
      sec("nature_purpose", [
        it("Nature of business; country of operations; expected account activity", cite("jmlsg_corp")),
        it("Annual accounts / financials; how the client was sourced", cite("jmlsg_corp")),
        it("Source of funds and source of wealth of the entity", cite("mlr_r28"), { risk: HI }),
      ]),
      sec("authority_signatory", [
        it("Evidence of authority to open/operate the account; verify the signatory's identity", cite("mlr_r28", "jmlsg_corp")),
      ]),
      sec("directors_controllers", [
        it("Verify 2 directors", cite("jmlsg_corp"), { risk: ["low"] }),
        it("Verify up to 5 directors (or all if fewer)", cite("jmlsg_corp"), { risk: MH }),
      ]),
      sec("beneficial_ownership", [
        it("Identify ownership/control including intermediary holding entities", cite("mlr_r28", "jmlsg_corp")),
        it("Verify identity of UBOs", cite("mlr_r28"), { threshold: "25%+ (LR/MR); 10%+ (HR)" }),
        it("Verify ALL UBOs at 25%+", cite("mlr_r28"), { risk: HI, threshold: "25%+" }),
      ]),
      sec("authorised_contacts", [
        it("Identify and verify all authorised contacts", cite("jmlsg_corp")),
      ]),
      sec("screening", [
        it("Screen the entity (incl. previous/trading names), directors, controllers, intermediary owners and signatories", cite("mlr_r35", "fca_fcg")),
      ]),
    ],
    eddTriggers: [
      edd("High-risk rating, PEP exposure or high-risk country nexus", "EDD form; verify source of funds and wealth; identify net worth and source of wealth of UBOs; external EDD report (discretionary); Wolfsberg questionnaire for FIs", cite("mlr_r33", "mlr_r35")),
    ],
  },
  {
    entityType: "corporate",
    jurisdiction: "us",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("us_cip_banks", "us_cdd"),
    boThreshold: "25% ownership prong + one control-prong individual",
    sddEligibility: "No formal SDD tier; risk-based scrutiny.",
    exemptionNote: "Listed companies, regulated FIs and government bodies are excluded legal-entity customers under 31 CFR 1010.230(e).",
    sections: [
      sec("legal_entity", [
        it("Legal name, principal place of business / physical location", cite("us_cip_banks")),
        it("Taxpayer identification number (EIN); formation documents", cite("us_cip_banks")),
      ]),
      sec("nature_purpose", [
        it("Understand nature and purpose to form a customer risk profile; ongoing monitoring", cite("us_cdd")),
      ]),
      sec("beneficial_ownership", [
        it("Each individual owning 25% or more of equity (up to four)", cite("us_cdd_d"), { threshold: "25% or more" }),
        it("One individual with significant responsibility to control/manage (control prong)", cite("us_cdd_d")),
        it("Certification of beneficial owners by the individual opening the account", cite("us_cdd_d")),
      ]),
      sec("screening", [
        it("OFAC sanctions screening of the entity and beneficial owners", cite("us_ffiec_pep")),
      ]),
    ],
    eddTriggers: [
      edd("Higher-risk customer, geography or product", "Risk-based enhanced due diligence (FFIEC)", cite("us_ffiec_pep")),
      edd("Correspondent account for a foreign financial institution", "Risk-based / enhanced due diligence under 31 CFR 1010.610", cite("us_corresp")),
    ],
    notes: "The CTA company-level BOI registry (31 CFR 1010.380) is distinct from this FI CDD obligation and was largely suspended for domestic companies in March 2025.",
  },
  {
    entityType: "corporate",
    jurisdiction: "eu",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("eu_amld_13", "eu_amld_bo"),
    boThreshold: "25% (more than 25%; AMLR: 25% or more, from 2027)",
    sddEligibility: "SDD where lower risk per AMLD5 Annex II.",
    sections: [
      sec("legal_entity", [
        it("Name, legal form, registration number and registered office", cite("eu_amld_13", "eu_amlr_22")),
        it("Names of senior managers / legal representatives", cite("eu_amlr_22")),
      ]),
      sec("nature_purpose", [
        it("Purpose and intended nature of the relationship; ongoing monitoring", cite("eu_amld_13")),
      ]),
      sec("beneficial_ownership", [
        it("Natural person(s) owning or controlling more than 25% of shares/voting rights", cite("eu_amld_bo"), { threshold: "more than 25%" }),
        it("Understand the ownership and control structure", cite("eu_amld_13")),
        it("Senior managing official recorded where no BO is identified", cite("eu_amld_bo")),
      ]),
      sec("screening", [
        it("PEP determination and sanctions screening of the entity and BOs", cite("eu_amld_pep")),
      ]),
    ],
    eddTriggers: [
      edd("PEP, high-risk third country, or complex/opaque structure (Annex III)", "Enhanced measures per Arts. 18-18a", cite("eu_amld_edd")),
    ],
    notes: "AMLR (Reg. 2024/1624) replaces these for the financial sector from 10 Jul 2027 (BO may fall to 15% for high-risk sectors).",
  },
  {
    entityType: "corporate",
    jurisdiction: "de",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("de_gwg_10", "de_gwg_11", "de_gwg_3"),
    boThreshold: "25% (more than 25% of capital or voting rights)",
    sddEligibility: "Simplified DD where low risk (GwG §14).",
    sections: [
      sec("legal_entity", [
        it("Company name, legal form (Rechtsform)", cite("de_gwg_11")),
        it("Registration number (Handelsregister) and registered office", cite("de_gwg_11")),
        it("Verify via commercial register extract or founding documents", cite("de_gwg_12")),
      ]),
      sec("directors_controllers", [
        it("Names of managing directors / legal representatives (Geschäftsführer / Vorstand)", cite("de_gwg_11")),
      ]),
      sec("beneficial_ownership", [
        it("Natural person holding more than 25% of capital or voting rights, or comparable control", cite("de_gwg_3"), { threshold: "more than 25%" }),
        it("Fictitious BO (legal representative) where no natural person qualifies", cite("de_gwg_3")),
        it("Cross-check the Transparenzregister", cite("de_gwg_20")),
      ]),
      sec("screening", [
        it("PEP and sanctions screening of the entity and BOs", cite("de_gwg_15")),
      ]),
    ],
    eddTriggers: [
      edd("PEP, high-risk third country, or complex/unusual transactions (§15(3))", "Enhanced measures; senior-management approval; origin of assets", cite("de_gwg_15")),
    ],
  },
  {
    entityType: "corporate",
    jurisdiction: "fr",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fr_l5615", "fr_r5615", "fr_r5611"),
    boThreshold: "25% (more than 25% of capital or voting rights)",
    sddEligibility: "Vigilance allégée where low risk (CMF R.561-15).",
    sections: [
      sec("legal_entity", [
        it("Legal form, name (dénomination), registration number and registered office", cite("fr_r5615")),
        it("Verify via a K-bis / registry extract less than 3 months old", cite("fr_r5651")),
      ]),
      sec("beneficial_ownership", [
        it("Natural person holding more than 25% of capital or voting rights, or exercising control", cite("fr_r5611"), { threshold: "more than 25%" }),
        it("Legal representative recorded where no BO meets the threshold", cite("fr_r5611")),
        it("Cross-check the Registre des bénéficiaires effectifs (RBE)", cite("fr_rbe")),
      ]),
      sec("nature_purpose", [
        it("Object and nature of the relationship; ongoing vigilance", cite("fr_l5615_1", "fr_l5616")),
      ]),
      sec("screening", [
        it("PEP and sanctions screening of the entity and BOs", cite("fr_l56110")),
      ]),
    ],
    eddTriggers: [
      edd("PEP, high-risk third country, or complex/unusual transactions", "Vigilance renforcée per L.561-10 / L.561-10-2", cite("fr_l56110", "fr_l561102")),
    ],
  },
  {
    entityType: "corporate",
    jurisdiction: "sg",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("sg_n626_6", "sg_n626_bo"),
    boThreshold: "25% (more than 25%, cascading)",
    sddEligibility: "SDD for FIs/listed companies in Notice 626 Appendix 2 (§7).",
    sections: [
      sec("legal_entity", [
        it("Full name; registration number (UEN); place of incorporation", cite("sg_n626_6")),
        it("Registered address and principal place of business; constitution", cite("sg_n626_6")),
      ]),
      sec("directors_controllers", [
        it("Identity of directors / persons with executive authority (and verification)", cite("sg_n626_6")),
      ]),
      sec("beneficial_ownership", [
        it("Cascading identification of the natural person(s) owning/controlling more than 25%", cite("sg_n626_bo"), { threshold: "more than 25%" }),
        it("Then control through other means; then senior managing official", cite("sg_n626_bo")),
      ]),
      sec("screening", [
        it("Screen the entity, persons acting on its behalf and BOs", cite("sg_n626_6")),
      ]),
    ],
    eddTriggers: [
      edd("PEP, FATF counter-measure country, or complex/unusual transactions", "EDD per Notice 626 §8 (senior-management approval, source of wealth/funds)", cite("sg_n626_edd")),
    ],
  },
  {
    entityType: "corporate",
    jurisdiction: "hk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("hk_amlo_s2", "hk_amlo_bo"),
    boThreshold: "25% (more than 25% of shares or voting rights)",
    sddEligibility: "SDD for listed companies / regulated FIs (AMLO Sch. 2 s.4).",
    sections: [
      sec("legal_entity", [
        it("Full legal name and any trading name", cite("hk_amlo_s2", "hk_hkma_gl")),
        it("Registration number and jurisdiction of incorporation; registered office", cite("hk_hkma_gl")),
        it("Articles of association / constitutional document; nature of business", cite("hk_hkma_gl")),
        it("Companies Registry search within 6 months for HK companies", cite("hk_hkma_gl")),
      ]),
      sec("directors_controllers", [
        it("Names of directors (with risk-based identity verification)", cite("hk_hkma_gl")),
      ]),
      sec("beneficial_ownership", [
        it("Individual owning/controlling more than 25% of shares or voting rights, or exercising ultimate control", cite("hk_amlo_bo"), { threshold: "more than 25%" }),
        it("Take reasonable measures to verify the BO's identity", cite("hk_amlo_s2")),
      ]),
      sec("screening", [
        it("Sanctions, PEP and adverse-media screening of the entity and BOs", cite("hk_hkma_gl")),
      ]),
    ],
    eddTriggers: [
      edd("PEP, high-risk jurisdiction, or complex/opaque structure", "EDD per AMLO Sch. 2 s.5 and HKMA Guideline ch.4", cite("hk_amlo_s5", "hk_hkma_gl")),
    ],
  },
];
