import type { CddProfile } from "../types";
import { cite } from "../sources";
import { it, sec, edd, HI } from "./_helpers";

/** Limited partnership (incl. limited partnership funds). General partners verified; limited partners by threshold. */

export const limitedPartnership: CddProfile[] = [
  {
    entityType: "limited_partnership",
    jurisdiction: "global",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fatf_r10", "fatf_r24"),
    boThreshold: "25% of capital, profits or voting rights; general partners identified",
    sddEligibility: "SDD where lower risk (FATF R.10).",
    sections: [
      sec("legal_entity", [it("Name, proof of existence and the limited-partnership agreement", cite("fatf_r10"))]),
      sec("beneficial_ownership", [
        it("Identify and verify the general partner(s); identify limited partners controlling the LP", cite("fatf_r24"), { threshold: "more than 25%" }),
      ]),
      sec("screening", [it("Screen the LP, general partners and beneficial owners", cite("fatf_r12"))]),
    ],
    eddTriggers: [edd("PEP or high-risk nexus", "Enhanced measures (FATF R.12/19)", cite("fatf_r12"))],
  },
  {
    entityType: "limited_partnership",
    jurisdiction: "uk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("mlr_r28", "jmlsg_corp"),
    boThreshold: "Limited partners 25%+ (LR/MR) / 10%+ (HR); general partners identified & verified",
    sddEligibility: "SDD where lower risk (MLR reg. 37).",
    sections: [
      sec("legal_entity", [
        it("Evidence of legal existence; LP5 form or partnership agreement", cite("mlr_r28", "jmlsg_corp")),
        it("Registration number; registered office and principal place of business", cite("mlr_r28")),
      ]),
      sec("nature_purpose", [
        it("Nature of business; expected activity; annual accounts", cite("jmlsg_corp")),
        it("Source of funds and source of wealth", cite("mlr_r28"), { risk: HI }),
      ]),
      sec("directors_controllers", [
        it("Identify and verify the general partner(s); identify the fund manager where applicable", cite("jmlsg_corp")),
      ]),
      sec("beneficial_ownership", [
        it("Identify limited partners and verify UBOs", cite("mlr_r28"), { threshold: "25%+ (LR/MR); 10%+ (HR)" }),
      ]),
      sec("screening", [
        it("Screen the entity, general/limited partners, fund managers and signatories", cite("mlr_r35", "fca_fcg")),
      ]),
    ],
    eddTriggers: [edd("Higher-risk rating or PEP exposure", "EDD form; verify source of funds/wealth; external EDD report", cite("mlr_r33"))],
  },
];
