import type { CddProfile } from "../types";
import { cite } from "../sources";
import { it, sec, edd } from "./_helpers";

/** Sovereign wealth fund. State-owned; treated as a lower-risk government-linked entity. */

export const swf: CddProfile[] = [
  {
    entityType: "swf",
    jurisdiction: "global",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("fatf_r10"),
    boThreshold: "State / government (no private owners)",
    sddEligibility: "Lower risk where the home state is low-risk and the fund is transparent.",
    sections: [
      sec("legal_entity", [it("Identify the fund and confirm its state ownership and mandate", cite("fatf_r10"))]),
      sec("directors_controllers", [it("Identify the governing body / board and senior officials", cite("fatf_r24"))]),
      sec("screening", [it("Screen the fund, board and senior officials (PEP)", cite("fatf_r12"))]),
    ],
    eddTriggers: [edd("Home state is higher-risk or officials are PEPs", "Enhanced scrutiny of source of funds and control", cite("fatf_r12"))],
  },
  {
    entityType: "swf",
    jurisdiction: "uk",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("mlr_r37", "jmlsg_gov"),
    boThreshold: "State / government; identify principals and controllers",
    sddEligibility: "SDD available for low-risk state entities (MLR reg. 37).",
    sections: [
      sec("legal_entity", [
        it("Evidence of existence, mandate and state ownership; registered address", cite("mlr_r28", "jmlsg_gov")),
      ]),
      sec("directors_controllers", [it("Identify directors / principals / controllers; verify by risk level", cite("jmlsg_gov"))]),
      sec("authority_signatory", [it("Identify and verify authorised signatories", cite("jmlsg_gov"))]),
      sec("screening", [it("PEP, sanctions and adverse-media screening of all parties", cite("mlr_r35", "fca_fcg"))]),
    ],
    eddTriggers: [edd("Higher-risk home state or PEP exposure", "EDD form; verify source of funds/wealth", cite("mlr_r33"))],
  },
  {
    entityType: "swf",
    jurisdiction: "us",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("us_cip_banks", "us_cdd"),
    boThreshold: "Control prong (state-owned enterprise; commercial capacity is not exempt)",
    sddEligibility: "No SDD tier; PEP exposure typically warrants enhanced scrutiny.",
    sections: [
      sec("legal_entity", [it("Identify the fund, its state ownership and mandate (CIP information)", cite("us_cip_banks"))]),
      sec("beneficial_ownership", [it("Identify the control-prong individual; a foreign-government exemption applies only to governmental (non-commercial) capacity", cite("us_cdd_d", "us_cdd_e"))]),
      sec("screening", [it("OFAC sanctions screening; screen officials as senior foreign political figures", cite("us_ffiec_pep"))]),
    ],
    eddTriggers: [edd("Senior foreign political figure among officials (private banking)", "Enhanced scrutiny for proceeds of foreign corruption; ascertain source of funds", cite("us_private_bank"))],
  },
  {
    entityType: "swf",
    jurisdiction: "eu",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("eu_amld_13"),
    boThreshold: "State / sovereign; identify controllers and senior officials",
    sddEligibility: "SDD where the home state is low-risk and the fund is transparent (Annex II).",
    sections: [
      sec("legal_entity", [it("Identify the fund, its state ownership and mandate", cite("eu_amld_13"))]),
      sec("directors_controllers", [it("Identify the governing body and senior officials", cite("eu_amld_13"))]),
      sec("screening", [it("PEP determination and sanctions screening of officials", cite("eu_amld_pep"))]),
    ],
    eddTriggers: [edd("Higher-risk home state or PEP exposure (Annex III)", "Enhanced measures per Arts. 18-18a", cite("eu_amld_edd"))],
  },
  {
    entityType: "swf",
    jurisdiction: "de",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("de_gwg_10", "de_gwg_11"),
    boThreshold: "State / sovereign; identify controllers and senior officials",
    sddEligibility: "Simplified DD where the home state is low-risk (Anlage 1).",
    sections: [
      sec("legal_entity", [it("Identify the fund, its state ownership and mandate", cite("de_gwg_11"))]),
      sec("screening", [it("PEP and sanctions screening of officials", cite("de_gwg_15"))]),
    ],
    eddTriggers: [edd("Higher-risk home state or PEP exposure", "Enhanced measures per §15(3)", cite("de_gwg_15"))],
  },
  {
    entityType: "swf",
    jurisdiction: "fr",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fr_l5615", "fr_r56115"),
    boThreshold: "State / sovereign; identify controllers and senior officials",
    sddEligibility: "Vigilance allégée where the home state is low-risk (R.561-15).",
    sections: [
      sec("legal_entity", [it("Identify the fund, its state ownership and mandate", cite("fr_r5615"))]),
      sec("screening", [it("PEP and sanctions screening of officials", cite("fr_l56110"))]),
    ],
    eddTriggers: [edd("Higher-risk home state or PEP exposure", "Vigilance renforcée per L.561-10", cite("fr_l56110"))],
  },
  {
    entityType: "swf",
    jurisdiction: "sg",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("sg_n626_6", "sg_n626_sdd"),
    boThreshold: "State / sovereign; identify controllers and senior officials",
    sddEligibility: "SDD for sovereign entities of low-risk jurisdictions (Appendix 2).",
    sections: [
      sec("legal_entity", [it("Identify the fund, its state ownership and mandate", cite("sg_n626_6"))]),
      sec("screening", [it("Screen officials (PEP) and the fund", cite("sg_n626_6"))]),
    ],
    eddTriggers: [edd("Foreign PEP exposure or higher-risk jurisdiction", "EDD per Notice 626 §8", cite("sg_n626_edd"))],
  },
  {
    entityType: "swf",
    jurisdiction: "hk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("hk_amlo_s2", "hk_amlo_s4"),
    boThreshold: "State / sovereign; identify controllers and senior officials",
    sddEligibility: "SDD for low-risk sovereign / public bodies (AMLO Sch. 2 s.4).",
    sections: [
      sec("legal_entity", [it("Identify the fund, its state ownership and mandate", cite("hk_amlo_s2"))]),
      sec("screening", [it("Sanctions and PEP screening of officials", cite("hk_hkma_gl"))]),
    ],
    eddTriggers: [edd("Non-HK PEP exposure or high-risk jurisdiction", "Enhanced due diligence per HKMA Guideline ch.4", cite("hk_hkma_gl"))],
  },
];
