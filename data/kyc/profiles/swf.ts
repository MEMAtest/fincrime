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
];
