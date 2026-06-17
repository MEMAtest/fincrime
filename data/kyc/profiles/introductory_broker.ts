import type { CddProfile } from "../types";
import { cite } from "../sources";
import { it, sec, edd } from "./_helpers";

/** Introductory broker: an intermediary introducing underlying clients. Reliance does not remove CDD responsibility. */

export const introductoryBroker: CddProfile[] = [
  {
    entityType: "introductory_broker",
    jurisdiction: "global",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fatf_r10", "fatf_r22"),
    boThreshold: "25% ownership or control of the broker",
    sddEligibility: "Risk-based; depends on the broker's regulation and supervision.",
    sections: [
      sec("legal_entity", [it("Identify the broker, its constitution and regulated/registered status", cite("fatf_r10", "fatf_r22"))]),
      sec("beneficial_ownership", [it("Identify the owners/controllers of the broker", cite("fatf_r24"), { threshold: "more than 25%" })]),
      sec("nature_purpose", [it("Understand the introduction arrangement and respective CDD responsibilities", cite("fatf_r10"))]),
      sec("screening", [it("Screen the broker, principals and beneficial owners", cite("fatf_r12"))]),
    ],
    eddTriggers: [edd("Broker in a higher-risk jurisdiction or weakly supervised", "Enhanced due diligence on the broker's AML controls", cite("fatf_r22"))],
  },
  {
    entityType: "introductory_broker",
    jurisdiction: "uk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("mlr_r28", "jmlsg_regulated"),
    boThreshold: "25%+ (LR/MR) / 10%+ (HR)",
    sddEligibility: "SDD where the broker is regulated/supervised and lower risk (MLR reg. 37).",
    sections: [
      sec("legal_entity", [
        it("Evidence of legal existence; legal name, registration number, country of incorporation; registered address", cite("mlr_r28", "jmlsg_regulated")),
        it("Evidence of regulated / registered status and AML supervision", cite("jmlsg_regulated")),
      ]),
      sec("nature_purpose", [it("Nature/purpose of the introduction; respective CDD responsibilities", cite("jmlsg_regulated"))]),
      sec("beneficial_ownership", [it("Identify ownership/control; verify UBOs", cite("mlr_r28"), { threshold: "25%+ (LR/MR); 10%+ (HR)" })]),
      sec("screening", [it("Screen the entity, principals, intermediary owners and signatories", cite("mlr_r35", "fca_fcg"))]),
    ],
    eddTriggers: [edd("Weakly supervised broker or higher-risk jurisdiction", "EDD form; confirm AML controls; external EDD report", cite("mlr_r33"))],
  },
];
