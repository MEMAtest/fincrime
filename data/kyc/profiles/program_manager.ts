import type { CddProfile } from "../types";
import { cite } from "../sources";
import { it, sec, edd, legalPersonJurisdictions } from "./_helpers";

/** Program manager: manages a card / e-money or payment program on behalf of an issuer. */

export const programManager: CddProfile[] = [
  {
    entityType: "program_manager",
    jurisdiction: "global",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fatf_r10", "fatf_r16"),
    boThreshold: "25% ownership or control",
    sddEligibility: "Risk-based; depends on the program's regulation and controls.",
    sections: [
      sec("legal_entity", [it("Identify the program manager, its constitution and regulated/registered status", cite("fatf_r10"))]),
      sec("beneficial_ownership", [it("Identify the owners/controllers of the program manager", cite("fatf_r24"), { threshold: "more than 25%" })]),
      sec("nature_purpose", [it("Understand the program, the issuer relationship and respective AML responsibilities", cite("fatf_r16"))]),
      sec("screening", [it("Screen the entity, principals and beneficial owners", cite("fatf_r12"))]),
    ],
    eddTriggers: [edd("Higher-risk program or jurisdiction", "Enhanced due diligence on the program's AML controls and flows", cite("fatf_r16"))],
  },
  {
    entityType: "program_manager",
    jurisdiction: "uk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("mlr_r28", "jmlsg_regulated"),
    boThreshold: "25%+ (LR/MR) / 10%+ (HR)",
    sddEligibility: "SDD where regulated/supervised and lower risk (MLR reg. 37).",
    sections: [
      sec("legal_entity", [
        it("Evidence of legal existence; legal name, registration number, country of incorporation; registered address", cite("mlr_r28", "jmlsg_regulated")),
        it("Evidence of regulated / registered status and AML supervision", cite("jmlsg_regulated")),
      ]),
      sec("nature_purpose", [it("Nature/purpose of the program; the issuer relationship and respective AML responsibilities", cite("jmlsg_regulated"))]),
      sec("beneficial_ownership", [it("Identify ownership/control; verify UBOs", cite("mlr_r28"), { threshold: "25%+ (LR/MR); 10%+ (HR)" })]),
      sec("screening", [it("Screen the entity, principals, intermediary owners and signatories", cite("mlr_r35", "fca_fcg"))]),
    ],
    eddTriggers: [edd("Higher-risk program, flows or jurisdiction", "EDD form; confirm AML controls; external EDD report", cite("mlr_r33"))],
  },
  ...legalPersonJurisdictions("program_manager", "program manager", "the owners/controllers of the program manager, and confirm its regulated / registered AML-supervised status"),
];
