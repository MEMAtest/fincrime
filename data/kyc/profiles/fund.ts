import type { CddProfile } from "../types";
import { cite } from "../sources";
import { it, sec, edd, HI } from "./_helpers";

/** Fund / collective investment scheme. Often relies on a regulated manager; BO usually falls to the manager. */

export const fund: CddProfile[] = [
  {
    entityType: "fund",
    jurisdiction: "global",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("fatf_r10", "fatf_r22"),
    boThreshold: "Investors with controlling interests; otherwise the manager",
    sddEligibility: "SDD where the fund/manager is regulated by a recognised regulator.",
    sections: [
      sec("legal_entity", [
        it("Name, proof of existence, prospectus and the management/investment agreement", cite("fatf_r10")),
        it("Confirm the fund/manager's regulated status", cite("fatf_r22")),
      ]),
      sec("beneficial_ownership", [
        it("Identify controlling investors; otherwise the senior managing official of the manager", cite("fatf_r24")),
      ]),
      sec("screening", [it("Screen the fund, manager and directors", cite("fatf_r12"))]),
    ],
    eddTriggers: [edd("Unregulated fund or higher-risk nexus", "Enhanced scrutiny of investors and source of funds", cite("fatf_r10"))],
  },
  {
    entityType: "fund",
    jurisdiction: "uk",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("mlr_r37", "jmlsg_funds"),
    boThreshold: "10% (shareholders / beneficial owners of the fund)",
    sddEligibility: "Lower risk / SDD only where regulated by a recognised regulator.",
    sections: [
      sec("legal_entity", [
        it("Evidence of legal existence; legal name; date and country of incorporation; registered address", cite("mlr_r28", "jmlsg_funds")),
        it("Fund prospectus and investment management agreement", cite("jmlsg_funds")),
        it("Appointed service providers (administrator, investment/fund manager, advisor); CDD confirmation from administrator/manager", cite("jmlsg_funds")),
      ]),
      sec("nature_purpose", [
        it("Purpose of the fund; country of operations; expected activity; annual accounts", cite("jmlsg_funds")),
        it("Source of funds and source of wealth", cite("mlr_r28"), { risk: HI }),
      ]),
      sec("directors_controllers", [
        it("Identify directors; verify 2 (LR/MR) or up to 5 / all if fewer (HR)", cite("jmlsg_funds")),
      ]),
      sec("beneficial_ownership", [
        it("List of shareholders / beneficial owners and verify UBOs", cite("mlr_r28", "jmlsg_funds"), { threshold: "10%+" }),
      ]),
      sec("screening", [
        it("Screen the entity, directors, intermediary owners, the investment/fund manager and signatories", cite("mlr_r35", "fca_fcg")),
      ]),
    ],
    eddTriggers: [edd("Higher-risk rating or unregulated manager", "EDD form; verify source of funds/wealth; verify source/wealth of UBOs; external EDD report", cite("mlr_r33"))],
  },
  {
    entityType: "fund",
    jurisdiction: "us",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("us_cip_banks", "us_cdd"),
    boThreshold: "Control prong; registered funds/advisers excluded",
    sddEligibility: "No SDD tier.",
    exemptionNote: "Registered investment companies (mutual funds) and registered investment advisers are excluded legal-entity customers under 31 CFR 1010.230(e)(2)(vii)-(viii); other pooled vehicles advised by a regulated party are subject to the control prong only.",
    sections: [
      sec("legal_entity", [it("Legal name, physical location and TIN/EIN", cite("us_cip_banks"))]),
      sec("beneficial_ownership", [
        it("Control-prong individual for a pooled vehicle advised by a covered party (no ownership prong)", cite("us_cdd_d", "us_cdd_e")),
      ]),
      sec("screening", [it("OFAC sanctions screening", cite("us_ffiec_pep"))]),
    ],
    eddTriggers: [edd("Higher-risk fund or investors", "Risk-based enhanced due diligence", cite("us_ffiec_pep"))],
  },
  {
    entityType: "fund",
    jurisdiction: "eu",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("eu_amld_13", "eu_amld_bo"),
    boThreshold: "25% (collective investment undertakings: AMLR Art. 61)",
    sddEligibility: "SDD for regulated UCITS / listed funds (Annex II).",
    sections: [
      sec("legal_entity", [it("Name, legal form, registration number and registered office; manager and depositary", cite("eu_amld_13"))]),
      sec("beneficial_ownership", [
        it("Investors with more than 25%; otherwise the manager's senior managing official", cite("eu_amld_bo", "eu_amlr_bo"), { threshold: "more than 25%" }),
      ]),
      sec("screening", [it("PEP determination and sanctions screening", cite("eu_amld_pep"))]),
    ],
    eddTriggers: [edd("Unregulated fund, high-risk third country or complex structure", "Enhanced measures per Arts. 18-18a", cite("eu_amld_edd"))],
  },
  {
    entityType: "fund",
    jurisdiction: "de",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("de_gwg_11", "de_gwg_3"),
    boThreshold: "25%; fictitious BO (KVG board) typical for open funds",
    sddEligibility: "Simplified DD for regulated, listed UCITS (§14).",
    sections: [
      sec("legal_entity", [it("Name, legal form, register number and registered office; the KVG / manager", cite("de_gwg_11"))]),
      sec("beneficial_ownership", [
        it("Investors over 25%; otherwise the fictitious BO (senior fund manager / KVG board)", cite("de_gwg_3"), { threshold: "more than 25%" }),
      ]),
      sec("screening", [it("PEP and sanctions screening", cite("de_gwg_15"))]),
    ],
    eddTriggers: [edd("High-risk third country or complex/unusual transactions", "Enhanced measures per §15(3)", cite("de_gwg_15"))],
  },
  {
    entityType: "fund",
    jurisdiction: "fr",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("fr_r5612", "fr_amf_doc"),
    boThreshold: "25% (units/shares/voting); otherwise the management company",
    sddEligibility: "Vigilance allégée for regulated OPCVM via a supervised SGP.",
    sections: [
      sec("legal_entity", [it("Name, legal form, approval/registration number, ISIN and the société de gestion (SGP)", cite("fr_r5615", "fr_amf_doc"))]),
      sec("beneficial_ownership", [
        it("Investors holding more than 25% of units/shares/voting; otherwise the effective directors of the management company", cite("fr_r5612"), { threshold: "more than 25%" }),
      ]),
      sec("screening", [it("PEP and sanctions screening", cite("fr_l56110"))]),
    ],
    eddTriggers: [edd("Unregulated vehicle or high-risk nexus", "Vigilance renforcée per L.561-10", cite("fr_l56110"))],
  },
  {
    entityType: "fund",
    jurisdiction: "sg",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("sg_n626_6", "sg_n626_bo"),
    boThreshold: "25%; otherwise the licensed fund manager",
    sddEligibility: "SDD where managed by a MAS-licensed CMS holder / regulated scheme.",
    sections: [
      sec("legal_entity", [it("Fund identity; the fund manager (verify MAS licensing) and custodian", cite("sg_n626_6"))]),
      sec("beneficial_ownership", [
        it("Investors over 25% where the scheme is not an established MAS-regulated fund; otherwise the manager", cite("sg_n626_bo"), { threshold: "more than 25%" }),
      ]),
      sec("screening", [it("Screen the fund, manager and BOs", cite("sg_n626_6"))]),
    ],
    eddTriggers: [edd("Unregulated scheme or FATF counter-measure nexus", "EDD per Notice 626 §8", cite("sg_n626_edd"))],
  },
  {
    entityType: "fund",
    jurisdiction: "hk",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("hk_amlo_s2", "hk_sfc_gl"),
    boThreshold: "Manager as customer where SFC-licensed; else investors >25%",
    sddEligibility: "Manager-level reliance where the manager is a licensed corporation.",
    sections: [
      sec("legal_entity", [it("Fund identity; the management company (verify SFC licensing) and custodian/depositary", cite("hk_amlo_s2", "hk_sfc_gl"))]),
      sec("beneficial_ownership", [
        it("Where the SFC-licensed manager is the customer and investors lack direct control, the manager conducts investor-level CDD", cite("hk_sfc_gl")),
      ]),
      sec("screening", [it("Sanctions, PEP and adverse-media screening", cite("hk_sfc_gl"))]),
    ],
    eddTriggers: [edd("Unregulated fund or complex structure", "Enhanced due diligence per SFC Guideline", cite("hk_sfc_gl"))],
  },
];
