import type { CddProfile } from "../types";
import { cite } from "../sources";
import { it, sec, edd } from "./_helpers";

/** Government / public body. Lower inherent risk: SDD or BO exemption in most regimes. */

export const government: CddProfile[] = [
  {
    entityType: "government",
    jurisdiction: "global",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("fatf_r10"),
    boThreshold: "n/a (publicly controlled)",
    sddEligibility: "SDD where the body is transparent and publicly accountable.",
    sections: [
      sec("legal_entity", [it("Identify the public body and confirm its public status", cite("fatf_r10"))]),
      sec("nature_purpose", [it("Purpose of the relationship; ongoing monitoring", cite("fatf_r10"))]),
      sec("screening", [it("Screen authorised signatories", cite("fatf_r12"))]),
    ],
    eddTriggers: [edd("PEP exposure among officials or high-risk jurisdiction", "Enhanced scrutiny per FATF R.12", cite("fatf_r12"))],
  },
  {
    entityType: "government",
    jurisdiction: "uk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("mlr_r37", "jmlsg_gov"),
    boThreshold: "Directors / principals / controllers (no private owners)",
    sddEligibility: "SDD available (MLR reg. 37) for public-sector bodies.",
    sections: [
      sec("legal_entity", [
        it("Evidence of address and registration status; founding statements and proof of purpose", cite("jmlsg_gov")),
      ]),
      sec("directors_controllers", [
        it("Identify directors / principals / controllers; verify 2-5 by risk level", cite("jmlsg_gov")),
      ]),
      sec("authority_signatory", [it("Identify and verify authorised signatories", cite("jmlsg_gov"))]),
      sec("screening", [it("PEP, sanctions and adverse-media screening of all parties", cite("mlr_r35", "fca_fcg"))]),
    ],
    eddTriggers: [edd("Higher-risk rating or PEP exposure", "EDD form; verify source of funds/wealth", cite("mlr_r33"))],
  },
  {
    entityType: "government",
    jurisdiction: "us",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("us_cip_banks", "us_cdd"),
    boThreshold: "Exempt from BO identification",
    sddEligibility: "No SDD tier, but government bodies are excluded customers.",
    exemptionNote: "US federal, state and political-subdivision departments/agencies (and foreign governmental bodies acting in a governmental capacity) are excluded under 31 CFR 1010.230(e)(2)(xvi).",
    sections: [
      sec("legal_entity", [it("Identify the agency/department (CIP information)", cite("us_cip_banks"))]),
      sec("screening", [it("OFAC sanctions screening", cite("us_ffiec_pep"))]),
    ],
    eddTriggers: [edd("Foreign-government officials / SFPFs (private banking)", "Enhanced scrutiny for proceeds of foreign corruption", cite("us_private_bank"))],
  },
  {
    entityType: "government",
    jurisdiction: "eu",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("eu_amld_13", "eu_amld_sdd"),
    boThreshold: "n/a (publicly controlled)",
    sddEligibility: "SDD: public authorities/enterprises are a lower-risk factor (Annex II).",
    sections: [
      sec("legal_entity", [it("Identify the public authority/enterprise", cite("eu_amld_13"))]),
      sec("screening", [it("PEP determination and sanctions screening", cite("eu_amld_pep"))]),
    ],
    eddTriggers: [edd("High-risk third country or PEP exposure", "Enhanced measures per Arts. 18-18a", cite("eu_amld_edd"))],
  },
  {
    entityType: "government",
    jurisdiction: "de",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("de_gwg_10", "de_gwg_14"),
    boThreshold: "n/a (publicly controlled)",
    sddEligibility: "Simplified DD: public authorities/enterprises (Anlage 1).",
    sections: [
      sec("legal_entity", [it("Identify the public body (öffentliche Stelle)", cite("de_gwg_11"))]),
      sec("screening", [it("PEP and sanctions screening", cite("de_gwg_15"))]),
    ],
    eddTriggers: [edd("PEP exposure or high-risk third country", "Enhanced measures per §15(3)", cite("de_gwg_15"))],
  },
  {
    entityType: "government",
    jurisdiction: "fr",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("fr_l5615", "fr_r56115"),
    boThreshold: "n/a (publicly controlled)",
    sddEligibility: "Vigilance allégée for public authorities meeting R.561-15(3) criteria.",
    sections: [
      sec("legal_entity", [it("Identify the public body (État / collectivité / établissement public)", cite("fr_r5615"))]),
      sec("screening", [it("PEP and sanctions screening", cite("fr_l56110"))]),
    ],
    eddTriggers: [edd("PEP exposure or high-risk nexus", "Vigilance renforcée per L.561-10", cite("fr_l56110"))],
  },
  {
    entityType: "government",
    jurisdiction: "sg",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("sg_n626_6", "sg_n626_sdd"),
    boThreshold: "n/a (publicly controlled)",
    sddEligibility: "SDD: Singapore Government entities and low-risk sovereign entities (Appendix 2).",
    sections: [
      sec("legal_entity", [it("Identify the government / statutory body", cite("sg_n626_6"))]),
      sec("screening", [it("Screen authorised signatories", cite("sg_n626_6"))]),
    ],
    eddTriggers: [edd("Foreign PEP exposure or higher-risk jurisdiction", "EDD per Notice 626 §8", cite("sg_n626_edd"))],
  },
  {
    entityType: "government",
    jurisdiction: "hk",
    status: "in_force",
    inherentRisk: "low",
    regulatoryBasis: cite("hk_amlo_s2", "hk_amlo_s4"),
    boThreshold: "n/a (publicly controlled)",
    sddEligibility: "SDD for government / public bodies (AMLO Sch. 2 s.4).",
    sections: [
      sec("legal_entity", [it("Identify the government entity", cite("hk_amlo_s2"))]),
      sec("screening", [it("Sanctions and PEP screening of signatories", cite("hk_hkma_gl"))]),
    ],
    eddTriggers: [edd("Non-HK PEP exposure or high-risk jurisdiction", "Enhanced due diligence per HKMA Guideline ch.4", cite("hk_hkma_gl"))],
  },
];
