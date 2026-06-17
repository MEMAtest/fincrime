import type { CddProfile } from "../types";
import { cite } from "../sources";
import { it, sec, edd, HI, legalPersonJurisdictions } from "./_helpers";

/** SPV / special purpose vehicle (incl. diamonds & asset-holding vehicles). Corporate CDD with transparency focus. */

export const spv: CddProfile[] = [
  {
    entityType: "spv",
    jurisdiction: "global",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("fatf_r10", "fatf_r24"),
    boThreshold: "25% ownership or control",
    sddEligibility: "SDD where lower risk (FATF R.10).",
    sections: [
      sec("legal_entity", [it("Name, proof of existence, constitution and the purpose of the vehicle", cite("fatf_r10"))]),
      sec("beneficial_ownership", [
        it("Identify the natural person(s) ultimately owning or controlling the vehicle, including via intermediaries", cite("fatf_r24"), { threshold: "more than 25%" }),
      ]),
      sec("nature_purpose", [it("Purpose of the SPV and rationale for the structure", cite("fatf_r10"))]),
      sec("screening", [it("Screen the vehicle, directors and beneficial owners", cite("fatf_r12"))]),
    ],
    eddTriggers: [edd("Unnecessarily complex structure with no clear purpose", "Enhanced scrutiny of rationale, control and source of funds", cite("fatf_r10"))],
  },
  {
    entityType: "spv",
    jurisdiction: "uk",
    status: "in_force",
    inherentRisk: "varies",
    regulatoryBasis: cite("mlr_r28", "jmlsg_corp"),
    boThreshold: "25%+ (LR/MR) / 10%+ (HR)",
    sddEligibility: "SDD where lower risk (MLR reg. 37).",
    sections: [
      sec("legal_entity", [
        it("Evidence of legal existence; legal name, registration number, date and country of incorporation; registered address; founding documents", cite("mlr_r28", "jmlsg_corp")),
      ]),
      sec("nature_purpose", [
        it("Purpose of the vehicle and rationale for the structure; expected activity", cite("jmlsg_corp")),
        it("Source of funds and source of wealth", cite("mlr_r28"), { risk: HI }),
      ]),
      sec("directors_controllers", [it("Identify and verify directors / controllers", cite("jmlsg_corp"))]),
      sec("beneficial_ownership", [
        it("Identify ownership/control including intermediary holding entities; verify UBOs", cite("mlr_r28"), { threshold: "25%+ (LR/MR); 10%+ (HR)" }),
      ]),
      sec("screening", [it("Screen the entity, directors, intermediary owners and signatories", cite("mlr_r35", "fca_fcg"))]),
    ],
    eddTriggers: [edd("Complex or opaque structure, or higher-risk rating", "EDD form; verify source of funds/wealth of UBOs; external EDD report", cite("mlr_r33"))],
  },
  ...legalPersonJurisdictions("spv", "special purpose vehicle", "ownership and control including intermediary holding entities, and the purpose of the structure"),
];
