import type { CddProfile } from "../types";
import { cite } from "../sources";
import { it, sec, edd } from "./_helpers";

/** STAK (Stichting Administratiekantoor). No shareholders, only certificate holders; treated like a company for BO. */

export const stak: CddProfile[] = [
  {
    entityType: "stak",
    jurisdiction: "global",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fatf_r10", "fatf_r24"),
    boThreshold: "25% ownership/control (certificate holders give dividend rights, not ownership)",
    sddEligibility: "SDD where lower risk (FATF R.10).",
    sections: [
      sec("legal_entity", [it("Evidence of existence and the founding/constitution document", cite("fatf_r10"))]),
      sec("directors_controllers", [it("Identify the board members", cite("fatf_r24"))]),
      sec("beneficial_ownership", [
        it("Identify ownership/control of the entity as for a company; certificate holders do not confer ownership", cite("fatf_r24"), { threshold: "more than 25%" }),
      ]),
      sec("screening", [it("Screen the entity, directors and controllers", cite("fatf_r12"))]),
    ],
    eddTriggers: [edd("Opaque control or private-wealth use", "Enhanced scrutiny of control and source of funds", cite("fatf_r10"))],
  },
  {
    entityType: "stak",
    jurisdiction: "uk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("mlr_r28", "jmlsg_corp"),
    boThreshold: "25%+ (LR/MR) / 10%+ (HR) ownership/control",
    sddEligibility: "SDD where lower risk (MLR reg. 37).",
    sections: [
      sec("legal_entity", [
        it("Evidence of legal existence; legal name, registration number, date and country of incorporation; registered address; founding documents", cite("mlr_r28", "jmlsg_corp")),
      ]),
      sec("nature_purpose", [it("Nature/purpose of the relationship; expected activity; source of funds", cite("jmlsg_corp"))]),
      sec("directors_controllers", [it("Identify directors / board members", cite("jmlsg_corp"))]),
      sec("beneficial_ownership", [
        it("Identify ownership/control of the entity; verify UBOs", cite("mlr_r28"), { threshold: "25%+ (LR/MR); 10%+ (HR)" }),
      ]),
      sec("screening", [it("Screen the entity, directors, controllers and intermediary owners", cite("mlr_r35", "fca_fcg"))]),
    ],
    eddTriggers: [edd("Higher-risk rating or opaque control", "EDD form; verify source of funds/wealth; external EDD report", cite("mlr_r33"))],
  },
];
