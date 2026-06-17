import type { CddProfile } from "../types";
import { cite } from "../sources";
import { it, sec, edd, HI, legalPersonJurisdictions } from "./_helpers";

/** TCSP client: a corporate introduced/administered by a trust & company service provider. Corporate CDD + CSP checks. */

export const tcspClient: CddProfile[] = [
  {
    entityType: "tcsp_client",
    jurisdiction: "global",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fatf_r10", "fatf_r22"),
    boThreshold: "25% ownership or control",
    sddEligibility: "Risk-based; reliance on the CSP does not remove CDD responsibility.",
    sections: [
      sec("legal_entity", [it("Name, proof of existence and constitution; ownership details (registry or certified org chart)", cite("fatf_r10"))]),
      sec("beneficial_ownership", [it("Identify the ultimate natural-person owners/controllers", cite("fatf_r24"), { threshold: "more than 25%" })]),
      sec("screening", [it("Screen the entity, directors and beneficial owners", cite("fatf_r12"))]),
    ],
    eddTriggers: [edd("CSP or client in a higher-risk jurisdiction", "Enhanced scrutiny of ownership and rationale", cite("fatf_r22"))],
  },
  {
    entityType: "tcsp_client",
    jurisdiction: "uk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("mlr_r28", "jmlsg_corp"),
    boThreshold: "25%+ (LR/MR) / 10%+ (HR)",
    sddEligibility: "SDD where lower risk (MLR reg. 37); reliance does not transfer responsibility.",
    sections: [
      sec("legal_entity", [
        it("Evidence of legal existence; legal name, registration number, country of incorporation; registered address; founding documents", cite("mlr_r28", "jmlsg_corp")),
        it("Details of ownership (registrar of companies or certified org chart); check the CSP's country matches the underlying client's", cite("jmlsg_corp")),
      ]),
      sec("nature_purpose", [
        it("Nature/purpose of the relationship; expected activity", cite("jmlsg_corp")),
        it("Source of funds and source of wealth", cite("mlr_r28"), { risk: HI }),
      ]),
      sec("beneficial_ownership", [it("Identify ownership/control; verify UBOs", cite("mlr_r28"), { threshold: "25%+ (LR/MR); 10%+ (HR)" })]),
      sec("screening", [it("Screen the entity, directors, intermediary owners and signatories", cite("mlr_r35", "fca_fcg"))]),
    ],
    eddTriggers: [edd("Higher-risk jurisdiction or opaque ownership", "EDD form; verify source of funds/wealth; external EDD report", cite("mlr_r33"))],
  },
  ...legalPersonJurisdictions("tcsp_client", "corporate administered by the CSP", "the ultimate natural-person owners/controllers via the company registry or a certified org chart"),
];
