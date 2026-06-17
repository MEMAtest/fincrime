import type { CddProfile } from "../types";
import { cite } from "../sources";
import { it, sec, edd } from "./_helpers";

/** Foundation (Stiftung / fondation / fonds de dotation and equivalents). */

export const foundation: CddProfile[] = [
  {
    entityType: "foundation",
    jurisdiction: "global",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fatf_r10", "fatf_r25"),
    boThreshold: "Founders, board/council members, beneficiaries and controllers",
    sddEligibility: "Generally standard; opacity warrants enhanced DD.",
    sections: [
      sec("legal_entity", [it("Evidence of existence and the founding/constitution document", cite("fatf_r10", "fatf_r25"))]),
      sec("beneficial_ownership", [
        it("Identify the founders, board/council members, beneficiaries (or class) and any controller", cite("fatf_r25")),
      ]),
      sec("screening", [it("Screen the foundation, board members and founders", cite("fatf_r12"))]),
    ],
    eddTriggers: [edd("Cross-border or private-wealth structure", "Enhanced scrutiny of source of funds and control", cite("fatf_r10"))],
  },
  {
    entityType: "foundation",
    jurisdiction: "uk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("mlr_r28", "jmlsg_corp"),
    boThreshold: "Directors/controllers, founders and beneficiaries",
    sddEligibility: "Limited; treated similarly to charities/trusts.",
    sections: [
      sec("legal_entity", [
        it("Evidence of legal existence; legal name, registration number, date and country of incorporation; registered address; founding documents", cite("mlr_r28", "jmlsg_corp")),
      ]),
      sec("nature_purpose", [
        it("Nature/purpose of the relationship; expected activity; source of funds", cite("jmlsg_corp")),
      ]),
      sec("directors_controllers", [
        it("Identify directors/controllers; verify 2 (LR/MR) or up to 5 / all if fewer (HR)", cite("jmlsg_corp")),
      ]),
      sec("beneficial_ownership", [
        it("Identify and verify all founders; identify and verify beneficiaries (excl. minors) or the class", cite("mlr_r28", "jmlsg_corp")),
      ]),
      sec("screening", [it("Screen the entity, directors, founders and beneficiaries", cite("mlr_r35", "fca_fcg"))]),
    ],
    eddTriggers: [edd("Higher-risk rating or PEP exposure", "EDD form; external EDD report", cite("mlr_r33"))],
  },
  {
    entityType: "foundation",
    jurisdiction: "eu",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("eu_amld_13", "eu_amlr_arr"),
    boThreshold: "Founders, management & supervisory board, beneficiaries, controllers",
    sddEligibility: "Limited; higher-risk where used for private wealth.",
    sections: [
      sec("legal_entity", [it("Name, legal form, registration number and registered office; founding document", cite("eu_amld_13"))]),
      sec("beneficial_ownership", [
        it("Identify founders, managing-board and supervisory-board members, beneficiaries and controllers (AMLR Art. 57)", cite("eu_amlr_arr")),
      ]),
      sec("screening", [it("PEP determination and sanctions screening", cite("eu_amld_pep"))]),
    ],
    eddTriggers: [edd("Private-wealth use or high-risk third country", "Enhanced measures per Arts. 18-18a", cite("eu_amld_edd"))],
  },
  {
    entityType: "foundation",
    jurisdiction: "de",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("de_gwg_3", "de_gwg_11"),
    boThreshold: "Board members, beneficiaries and controllers (Stiftung)",
    sddEligibility: "Limited; enhanced where risk indicators present.",
    sections: [
      sec("legal_entity", [it("Name and legal form (Stiftung); registration and registered address; founding document", cite("de_gwg_11"))]),
      sec("beneficial_ownership", [
        it("Identify foundation-board members, beneficiaries (or class) and controllers; register in the Transparenzregister", cite("de_gwg_3", "de_gwg_20")),
      ]),
      sec("screening", [it("PEP and sanctions screening", cite("de_gwg_15"))]),
    ],
    eddTriggers: [edd("Private-wealth use, high-risk third country or unusual funding", "Enhanced measures per §15", cite("de_gwg_15"))],
  },
  {
    entityType: "foundation",
    jurisdiction: "fr",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fr_l5615", "fr_r5613"),
    boThreshold: "Deemed: administrators, supervisory-board members and directors",
    sddEligibility: "Limited; enhanced where risk indicators present.",
    sections: [
      sec("legal_entity", [it("Legal form (fondation / fonds de dotation), name and registration; registered address", cite("fr_r5615"))]),
      sec("beneficial_ownership", [
        it("Administrators, supervisory-board members and directors are deemed beneficial owners (no 25% threshold); file/cross-check the RBE", cite("fr_r5613", "fr_rbe")),
      ]),
      sec("screening", [it("PEP and sanctions screening", cite("fr_l56110"))]),
    ],
    eddTriggers: [edd("Cross-border transfers or high-risk country links", "Vigilance renforcée per L.561-10", cite("fr_l56110"))],
  },
  {
    entityType: "foundation",
    jurisdiction: "us",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("us_cip_banks", "us_cdd"),
    boThreshold: "Control prong (a non-profit foundation is excluded from the ownership prong)",
    sddEligibility: "No SDD tier.",
    exemptionNote: "A non-profit foundation that has filed organizational documents is excluded from the 25% ownership prong but subject to the control prong under 31 CFR 1010.230(e)(iii).",
    sections: [
      sec("legal_entity", [it("Legal name, physical location and EIN; organizational/founding documents", cite("us_cip_banks"))]),
      sec("beneficial_ownership", [it("One individual with significant control (e.g. president/director) under the control prong", cite("us_cdd_d", "us_cdd_e"))]),
      sec("screening", [it("OFAC sanctions screening of the entity and controllers", cite("us_ffiec_pep"))]),
    ],
    eddTriggers: [edd("Cross-border / cash-intensive activity", "Risk-based EDD on source and use of funds", cite("us_ffiec_pep"))],
  },
  {
    entityType: "foundation",
    jurisdiction: "sg",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("sg_n626_6", "sg_n626_bo"),
    boThreshold: "Board members / controllers",
    sddEligibility: "Generally no; higher risk where cross-border.",
    sections: [
      sec("legal_entity", [it("Registered name and registration number; governing document; office-bearers", cite("sg_n626_6"))]),
      sec("beneficial_ownership", [it("Identify the board members and controllers of the foundation", cite("sg_n626_bo"))]),
      sec("screening", [it("Screen the entity, board members and controllers", cite("sg_n626_6"))]),
    ],
    eddTriggers: [edd("Cross-border or higher-risk activity", "EDD per Notice 626 §8", cite("sg_n626_edd"))],
  },
  {
    entityType: "foundation",
    jurisdiction: "hk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("hk_amlo_s2", "hk_hkma_gl"),
    boThreshold: "Board members / controllers",
    sddEligibility: "Generally no; higher risk where cross-border.",
    sections: [
      sec("legal_entity", [it("Identify the foundation, its governing document and purposes", cite("hk_amlo_s2"))]),
      sec("beneficial_ownership", [it("Identify the board members and those who control the foundation", cite("hk_amlo_bo"))]),
      sec("screening", [it("Sanctions, PEP and adverse-media screening", cite("hk_hkma_gl"))]),
    ],
    eddTriggers: [edd("Cross-border or cash-intensive activity", "Enhanced due diligence per HKMA Guideline ch.4", cite("hk_hkma_gl"))],
  },
];
