import type { CddProfile } from "../types";
import { cite } from "../sources";
import { it, sec, edd, HI } from "./_helpers";

/** Trust (express trust and foreign equivalents). BO = settlor, trustee, protector, beneficiaries, controller. */

export const trust: CddProfile[] = [
  {
    entityType: "trust",
    jurisdiction: "global",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fatf_r10", "fatf_r25"),
    boThreshold: "Settlor, trustee, protector, beneficiaries (or class) and any controller",
    sddEligibility: "Generally standard or enhanced; complex/cross-border trusts are higher risk.",
    sections: [
      sec("legal_entity", [
        it("Evidence of existence and the trust deed / founding instrument", cite("fatf_r10", "fatf_r25")),
      ]),
      sec("nature_purpose", [
        it("Purpose of the trust and nature of the relationship", cite("fatf_r10")),
        it("Source of funds / wealth of the settlor", cite("fatf_r10"), { risk: HI }),
      ]),
      sec("beneficial_ownership", [
        it("Identify the settlor, trustee(s), protector (if any), beneficiaries or class of beneficiaries, and any person with ultimate control", cite("fatf_r25")),
      ]),
      sec("screening", [
        it("Screen the trustee, settlor, protector and beneficiaries", cite("fatf_r12")),
      ]),
    ],
    eddTriggers: [
      edd("Complex or cross-border trust structure", "Enhanced scrutiny of source of wealth and control", cite("fatf_r10")),
    ],
  },
  {
    entityType: "trust",
    jurisdiction: "uk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("mlr_r28", "jmlsg_corp"),
    boThreshold: "Trustees, settlors, beneficiaries (excl. minors), controllers, protectors",
    sddEligibility: "Limited; higher risk where complex/cross-border.",
    sections: [
      sec("legal_entity", [
        it("Evidence of legal existence and trust deeds / founding statement", cite("mlr_r28", "jmlsg_corp")),
        it("Legal name, registration number, date and country of incorporation; registered address", cite("mlr_r28")),
      ]),
      sec("nature_purpose", [
        it("Purpose of the trust; name/class of beneficiaries; expected account activity", cite("jmlsg_corp")),
        it("Source of funds and source of wealth", cite("mlr_r28")),
      ]),
      sec("authority_signatory", [
        it("Evidence of authority; verify the signatory's identity", cite("mlr_r28")),
      ]),
      sec("beneficial_ownership", [
        it("Identify all trustees, settlors and beneficiaries (excl. minors); verify all at lower risk", cite("mlr_r28", "jmlsg_corp")),
        it("Identify and verify controllers and protectors where applicable", cite("jmlsg_corp")),
      ]),
      sec("screening", [
        it("Screen the entity, trustees, settlors, beneficiaries, controllers and protectors (incl. aliases)", cite("mlr_r35", "fca_fcg")),
      ]),
    ],
    eddTriggers: [
      edd("Higher-risk rating, PEP exposure or complex structure", "EDD form; verify source of funds/wealth of settlors, trustees and beneficiaries; external EDD report", cite("mlr_r33")),
    ],
  },
  {
    entityType: "trust",
    jurisdiction: "us",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("us_cip_banks", "us_cdd"),
    boThreshold: "Trustee (deemed BO); grantor/settlor for revocable trusts",
    sddEligibility: "No SDD tier; trusts warrant heightened attention (FFIEC).",
    sections: [
      sec("legal_entity", [
        it("Trust name, trust documents and TIN (CIP)", cite("us_cip_banks")),
      ]),
      sec("beneficial_ownership", [
        it("Where a trust owns 25%+ of a legal-entity customer, the trustee is the beneficial owner", cite("us_cdd_d"), { threshold: "25%+" }),
        it("For a revocable trust, the grantor/settlor is generally identified (FFIEC guidance)", cite("us_cdd")),
      ]),
      sec("nature_purpose", [
        it("Understand the nature and beneficial interest; risk-based ongoing monitoring", cite("us_cdd")),
      ]),
      sec("screening", [
        it("OFAC sanctions screening of trustee, grantor and beneficiaries", cite("us_ffiec_pep")),
      ]),
    ],
    eddTriggers: [
      edd("Complex trust structure or higher-risk parties", "Heightened attention to understand the beneficial interest", cite("us_ffiec_pep")),
    ],
  },
  {
    entityType: "trust",
    jurisdiction: "eu",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("eu_amld_13", "eu_amld_bo"),
    boThreshold: "Settlor, trustee, protector, beneficiaries (or class), and any controller",
    sddEligibility: "Limited; private-wealth structures are a higher-risk factor (Annex III).",
    sections: [
      sec("legal_entity", [
        it("Trust instrument and evidence of the arrangement", cite("eu_amld_13")),
      ]),
      sec("beneficial_ownership", [
        it("Identify the settlor, trustee(s), protector, beneficiaries (or class) and any natural person exercising ultimate control", cite("eu_amld_bo", "eu_amlr_arr")),
      ]),
      sec("nature_purpose", [
        it("Purpose and nature of the relationship; ongoing monitoring", cite("eu_amld_13")),
      ]),
      sec("screening", [
        it("PEP determination and sanctions screening of all parties", cite("eu_amld_pep")),
      ]),
    ],
    eddTriggers: [
      edd("Legal structure for private wealth management (Annex III)", "Enhanced measures per Arts. 18-18a", cite("eu_amld_edd")),
    ],
  },
  {
    entityType: "trust",
    jurisdiction: "de",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("de_gwg_3", "de_gwg_11"),
    boThreshold: "Settlor, trustee, protector, board members, beneficiaries, controllers",
    sddEligibility: "Limited; opacity typically warrants enhanced DD.",
    sections: [
      sec("legal_entity", [
        it("Trust deed / Treuhand documentation; name and registered address", cite("de_gwg_11")),
      ]),
      sec("beneficial_ownership", [
        it("Identify settlors, trustees, protectors, designated beneficiaries and controllers (§3(3))", cite("de_gwg_3")),
        it("Trustees of foreign trusts located in Germany must register in the Transparenzregister (§21)", cite("de_gwg_20")),
      ]),
      sec("screening", [
        it("PEP and sanctions screening of all parties", cite("de_gwg_15")),
      ]),
    ],
    eddTriggers: [
      edd("Legal arrangement for private wealth management (Anlage 2)", "Enhanced due diligence per §15", cite("de_gwg_15")),
    ],
  },
  {
    entityType: "trust",
    jurisdiction: "fr",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fr_l5615", "fr_r56130"),
    boThreshold: "Constituant, fiduciaire, bénéficiaires, protecteur, >25% control",
    sddEligibility: "Limited; opacity typically warrants vigilance renforcée.",
    sections: [
      sec("legal_entity", [
        it("Trust deed / fiducie documentation (fiducie: Civil Code arts. 2011-2031)", cite("fr_r5615", "fr_r56130")),
      ]),
      sec("beneficial_ownership", [
        it("Identify the constituant (settlor), fiduciaire (trustee), bénéficiaires, protecteur and any person holding more than 25% of, or controlling, the trust assets", cite("fr_r56130"), { threshold: "more than 25%" }),
      ]),
      sec("nature_purpose", [
        it("Object and nature of the relationship; ongoing vigilance", cite("fr_l5615_1", "fr_l5616")),
      ]),
      sec("screening", [
        it("PEP and sanctions screening of all parties", cite("fr_l56110")),
      ]),
    ],
    eddTriggers: [
      edd("Opaque or cross-border trust structure", "Vigilance renforcée per L.561-10; document source of wealth of the settlor", cite("fr_l56110")),
    ],
  },
  {
    entityType: "trust",
    jurisdiction: "sg",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("sg_n626_6", "sg_n626_trust"),
    boThreshold: "Trustee, settlor, protector, beneficiaries (or class), ultimate controller",
    sddEligibility: "Generally no; higher risk where complex/cross-border.",
    sections: [
      sec("legal_entity", [
        it("Trust deed (or equivalent) and evidence of the arrangement", cite("sg_n626_6")),
      ]),
      sec("beneficial_ownership", [
        it("Identify and verify the trustee(s), settlor, protector, beneficiaries (or class) and any natural person with ultimate effective control; consider letters of wishes", cite("sg_n626_trust")),
        it("Identify beneficiaries before any distribution / as soon as reasonably practicable", cite("sg_n626_trust")),
      ]),
      sec("screening", [
        it("Screen the trustee, settlor, protector and beneficiaries", cite("sg_n626_6")),
      ]),
    ],
    eddTriggers: [
      edd("Complex or cross-border trust, or PEP among the parties", "EDD per Notice 626 §8", cite("sg_n626_edd")),
    ],
  },
  {
    entityType: "trust",
    jurisdiction: "hk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("hk_amlo_s2", "hk_amlo_bo"),
    boThreshold: "Settlor, trustee, protector/enforcer, beneficiaries (or class), ultimate controller",
    sddEligibility: "Generally no; complex trusts are higher risk.",
    sections: [
      sec("legal_entity", [
        it("Trust deed and evidence of the arrangement", cite("hk_amlo_s2")),
      ]),
      sec("beneficial_ownership", [
        it("Identify the settlor, trustee(s), protector or enforcer, beneficiaries (or class), and any individual exercising ultimate control; follow the chain where a party is a legal person", cite("hk_amlo_bo", "hk_hkma_gl")),
      ]),
      sec("screening", [
        it("Sanctions, PEP and adverse-media screening of all parties", cite("hk_hkma_gl")),
      ]),
    ],
    eddTriggers: [
      edd("Complex / multi-layered trust structure", "Enhanced due diligence per AMLO Sch. 2 s.5", cite("hk_amlo_s5", "hk_hkma_gl")),
    ],
  },
];
