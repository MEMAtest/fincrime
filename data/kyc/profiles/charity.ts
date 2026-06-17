import type { CddProfile } from "../types";
import { cite } from "../sources";
import { it, sec, edd, HI } from "./_helpers";

/** Charity / non-profit organisation (NPO). Treated as higher inherent risk for TF. */

export const charity: CddProfile[] = [
  {
    entityType: "charity",
    jurisdiction: "global",
    status: "in_force",
    inherentRisk: "high",
    regulatoryBasis: cite("fatf_r10", "fatf_r24"),
    boThreshold: "25% / controllers (NPOs rarely have owners)",
    sddEligibility: "Generally not appropriate; NPOs are a recognised TF-risk sector (FATF R.8).",
    sections: [
      sec("legal_entity", [
        it("Name, legal form, proof of existence and registration/charitable status", cite("fatf_r10")),
        it("Registered address and constitution / governing document", cite("fatf_r10")),
      ]),
      sec("nature_purpose", [
        it("Purpose of the charity and intended nature of the relationship", cite("fatf_r10")),
        it("Source of funds and donor profile", cite("fatf_r10"), { risk: HI }),
      ]),
      sec("directors_controllers", [
        it("Identify trustees / board members / controllers", cite("fatf_r24")),
      ]),
      sec("beneficial_ownership", [
        it("Identify those who control the NPO and the class of beneficiaries", cite("fatf_r24", "fatf_r25")),
      ]),
      sec("screening", [
        it("Screen the entity, trustees and controllers", cite("fatf_r12")),
      ]),
    ],
    eddTriggers: [
      edd("Cross-border activity or exposure to high-risk jurisdictions", "Enhanced scrutiny of donors, beneficiaries and fund flows", cite("fatf_r10")),
    ],
    notes: "FATF R.8 flags NPO abuse for terrorist financing; apply proportionate, risk-based scrutiny.",
  },
  {
    entityType: "charity",
    jurisdiction: "uk",
    status: "in_force",
    inherentRisk: "high",
    regulatoryBasis: cite("mlr_r28", "jmlsg_corp"),
    boThreshold: "Controllers / settlors / beneficiary classes",
    sddEligibility: "Not appropriate (higher-risk category).",
    sections: [
      sec("legal_entity", [
        it("Evidence of legal existence and registered charity status", cite("mlr_r28", "jmlsg_corp")),
        it("Legal name, registration number, date and country of incorporation", cite("mlr_r28")),
        it("Registered address; founding / constitutional documents", cite("jmlsg_corp")),
      ]),
      sec("nature_purpose", [
        it("Purpose of the charity; country of operations; expected account activity", cite("jmlsg_corp")),
        it("Annual accounts / financials; how the client was sourced", cite("jmlsg_corp")),
        it("Source of funds and source of wealth", cite("mlr_r28")),
      ]),
      sec("authority_signatory", [
        it("Evidence of authority; verify the signatory's identity", cite("mlr_r28")),
      ]),
      sec("directors_controllers", [
        it("Identify trustees / board members / controllers; verify up to 5 (or all if fewer)", cite("jmlsg_corp")),
      ]),
      sec("beneficial_ownership", [
        it("Identify and verify all settlors; identify and verify beneficiary classes", cite("mlr_r28", "jmlsg_corp")),
      ]),
      sec("screening", [
        it("Screen the entity, directors, trustees, settlors and authorised contacts", cite("mlr_r35", "fca_fcg")),
      ]),
      sec("edd", [
        it("EDD form confirming AML/TF and anti-bribery controls", cite("mlr_r33")),
        it("Donor information: geography, donor groups (govt/institutional/private), top 10 donors", cite("mlr_r33"), { conditional: "if not in annual accounts" }),
        it("Charity's AML policy (or document AML controls); external EDD report", cite("mlr_r33")),
      ]),
    ],
    eddTriggers: [
      edd("Higher-risk donors, jurisdictions or activities", "Verify source of funds/wealth; obtain donor information; external EDD report", cite("mlr_r33")),
    ],
  },
  {
    entityType: "charity",
    jurisdiction: "us",
    status: "in_force",
    inherentRisk: "high",
    regulatoryBasis: cite("us_cip_banks", "us_cdd"),
    boThreshold: "Control prong only (NPOs excluded from the ownership prong)",
    sddEligibility: "No SDD tier; NPOs flagged higher-risk for TF (FFIEC).",
    exemptionNote: "An NPO that has filed organizational documents is excluded from the 25% ownership prong but subject to the control prong under 31 CFR 1010.230(e)(iii).",
    sections: [
      sec("legal_entity", [
        it("Legal name, physical location and EIN; organizational documents", cite("us_cip_banks")),
      ]),
      sec("beneficial_ownership", [
        it("One individual with significant control (e.g. Executive Director) under the control prong", cite("us_cdd_e")),
      ]),
      sec("nature_purpose", [
        it("Understand purpose and expected activity; risk-based ongoing monitoring", cite("us_cdd")),
      ]),
      sec("screening", [
        it("OFAC sanctions screening of the entity and controllers", cite("us_ffiec_pep")),
      ]),
    ],
    eddTriggers: [
      edd("Higher-risk charitable organisation (cross-border / cash-intensive)", "Risk-based EDD on source and use of funds", cite("us_ffiec_pep")),
    ],
  },
  {
    entityType: "charity",
    jurisdiction: "eu",
    status: "in_force",
    inherentRisk: "high",
    regulatoryBasis: cite("eu_amld_13"),
    boThreshold: "Controllers / senior managing officials",
    sddEligibility: "Generally not appropriate (higher-risk).",
    sections: [
      sec("legal_entity", [
        it("Name, legal form, registration number and registered office; governing document", cite("eu_amld_13", "eu_amlr_22")),
      ]),
      sec("beneficial_ownership", [
        it("Identify those who control the NPO; senior managing official fallback", cite("eu_amld_bo")),
      ]),
      sec("nature_purpose", [
        it("Purpose and intended nature of the relationship; ongoing monitoring", cite("eu_amld_13")),
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
    entityType: "charity",
    jurisdiction: "de",
    status: "in_force",
    inherentRisk: "high",
    regulatoryBasis: cite("de_gwg_10", "de_gwg_11"),
    boThreshold: "Board members / controllers",
    sddEligibility: "Not appropriate where risk indicators present.",
    sections: [
      sec("legal_entity", [
        it("Name and legal form (e.V. / gGmbH); registration number and registered office", cite("de_gwg_11")),
        it("Verify via register extract / founding documents", cite("de_gwg_12")),
      ]),
      sec("beneficial_ownership", [
        it("Identify board members / controllers; register in the Transparenzregister", cite("de_gwg_3", "de_gwg_20")),
      ]),
      sec("screening", [
        it("PEP and sanctions screening", cite("de_gwg_15")),
      ]),
    ],
    eddTriggers: [
      edd("Unusual funding, geographic exposure or beneficiaries in high-risk jurisdictions", "Enhanced due diligence per §15", cite("de_gwg_15")),
    ],
  },
  {
    entityType: "charity",
    jurisdiction: "fr",
    status: "in_force",
    inherentRisk: "high",
    regulatoryBasis: cite("fr_l5615", "fr_r5613"),
    boThreshold: "Deemed: administrators, supervisory-board members and directors",
    sddEligibility: "Not appropriate where risk indicators present.",
    sections: [
      sec("legal_entity", [
        it("Legal form (association loi 1901 / fondation / fonds de dotation), name and registration number (RNA)", cite("fr_r5615")),
        it("Registered address", cite("fr_r5615")),
      ]),
      sec("beneficial_ownership", [
        it("Administrators, supervisory-board members and directors are deemed beneficial owners (no 25% threshold)", cite("fr_r5613")),
        it("File / cross-check the RBE where applicable", cite("fr_rbe")),
      ]),
      sec("screening", [
        it("PEP and sanctions screening", cite("fr_l56110")),
      ]),
    ],
    eddTriggers: [
      edd("Cross-border transfers, high-risk country links or large unverified donations", "Vigilance renforcée per L.561-10", cite("fr_l56110")),
    ],
  },
  {
    entityType: "charity",
    jurisdiction: "sg",
    status: "in_force",
    inherentRisk: "high",
    regulatoryBasis: cite("sg_n626_6"),
    boThreshold: "Controllers / office-bearers",
    sddEligibility: "Not appropriate (higher TF risk).",
    sections: [
      sec("legal_entity", [
        it("Registered name and charity/society registration number; governing document", cite("sg_n626_6")),
        it("Office-bearers and authorised signatories", cite("sg_n626_6")),
      ]),
      sec("beneficial_ownership", [
        it("Identify controllers of the entity", cite("sg_n626_bo")),
      ]),
      sec("screening", [
        it("Screen the entity, office-bearers and controllers", cite("sg_n626_6")),
      ]),
    ],
    eddTriggers: [
      edd("Cross-border or higher-risk activity", "Enhanced scrutiny of source and use of funds", cite("sg_n626_edd")),
    ],
  },
  {
    entityType: "charity",
    jurisdiction: "hk",
    status: "in_force",
    inherentRisk: "high",
    regulatoryBasis: cite("hk_amlo_s2", "hk_hkma_gl"),
    boThreshold: "Controllers",
    sddEligibility: "Not appropriate (higher TF risk).",
    sections: [
      sec("legal_entity", [
        it("Verify registration status (IRD tax-exempt / Social Welfare Dept)", cite("hk_hkma_gl")),
        it("Understand purposes and beneficiaries", cite("hk_amlo_s2")),
      ]),
      sec("beneficial_ownership", [
        it("Identify those who control the charity", cite("hk_amlo_bo")),
      ]),
      sec("screening", [
        it("Sanctions, PEP and adverse-media screening", cite("hk_hkma_gl")),
      ]),
    ],
    eddTriggers: [
      edd("Cash-intensive or cross-border charitable activity", "Enhanced monitoring of fund flows", cite("hk_hkma_gl")),
    ],
  },
];
