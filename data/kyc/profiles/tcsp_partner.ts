import type { CddProfile } from "../types";
import { cite } from "../sources";
import { it, sec, edd, legalPersonJurisdictions } from "./_helpers";

/** TCSP partner: the trust & company service provider itself as a counterparty / introducer. */

export const tcspPartner: CddProfile[] = [
  {
    entityType: "tcsp_partner",
    jurisdiction: "global",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fatf_r10", "fatf_r22"),
    boThreshold: "25% ownership or control of the TCSP",
    sddEligibility: "Risk-based; depends on the TCSP's regulation and supervision.",
    sections: [
      sec("legal_entity", [it("Identify the TCSP, its constitution and regulated/registered status", cite("fatf_r10", "fatf_r22"))]),
      sec("beneficial_ownership", [it("Identify the owners/controllers of the TCSP", cite("fatf_r24"), { threshold: "more than 25%" })]),
      sec("screening", [it("Screen the TCSP, partners and beneficial owners", cite("fatf_r12"))]),
    ],
    eddTriggers: [edd("TCSP in a higher-risk jurisdiction or weakly supervised", "Enhanced due diligence on the TCSP's controls and ownership", cite("fatf_r22"))],
  },
  {
    entityType: "tcsp_partner",
    jurisdiction: "uk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("mlr_r28", "jmlsg_corp"),
    boThreshold: "more than 25% (firms may apply 10% for higher-risk as policy)",
    sddEligibility: "SDD where the TCSP is regulated/supervised and lower risk (MLR reg. 37).",
    sections: [
      sec("legal_entity", [
        it("Evidence of legal existence; legal name, registration number, country of incorporation; registered address", cite("mlr_r28", "jmlsg_corp")),
        it("Evidence of regulated / registered status and AML supervision", cite("jmlsg_corp")),
      ]),
      sec("directors_controllers", [it("Identify and verify partners / directors", cite("jmlsg_corp"))]),
      sec("beneficial_ownership", [it("Identify ownership/control; verify UBOs", cite("mlr_r28"), { threshold: "more than 25% (firms often lower to 10% for higher-risk as policy)" })]),
      sec("screening", [it("Screen the entity, partners, intermediary owners and signatories", cite("mlr_r35", "fca_fcg"))]),
    ],
    eddTriggers: [edd("Weakly supervised TCSP or higher-risk jurisdiction", "EDD form; confirm AML controls; external EDD report", cite("mlr_r33"))],
  },
  ...legalPersonJurisdictions("tcsp_partner", "trust & company service provider", "the owners/controllers of the TCSP, and confirm its regulated / registered AML-supervised status"),
];
