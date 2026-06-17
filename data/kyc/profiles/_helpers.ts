import type { Source } from "../../typologies/types";
import type { CddItem, CddProfile, CddSection, CddSectionKey, EddTrigger, EntityType, RiskLevel } from "../types";
import { SECTION_TITLE } from "../types";
import { cite } from "../sources";

export const ALL: RiskLevel[] = ["low", "medium", "high"];
export const MH: RiskLevel[] = ["medium", "high"];
export const HI: RiskLevel[] = ["high"];

/** Build a CDD item. Defaults to applying at all risk levels. */
export function it(
  text: string,
  sources: Source[],
  opts?: { risk?: RiskLevel[]; conditional?: string; threshold?: string }
): CddItem {
  return {
    text,
    appliesAtRisk: opts?.risk ?? ALL,
    sources,
    ...(opts?.conditional ? { conditional: opts.conditional } : {}),
    ...(opts?.threshold ? { threshold: opts.threshold } : {}),
  };
}

export function sec(key: CddSectionKey, items: CddItem[]): CddSection {
  return { key, title: SECTION_TITLE[key], items };
}

export function edd(trigger: string, action: string, sources: Source[]): EddTrigger {
  return { trigger, action, sources };
}

/**
 * Builds the US/EU/DE/FR/SG/HK profiles for a legal-person entity type that each
 * regime treats under its general legal-person CDD rule (corporate-equivalent):
 * identify the entity, identify BOs at the 25% threshold, screen, and apply EDD.
 * `descriptor` names the entity in the legal-entity line (e.g. "special purpose
 * vehicle"); `ownership` describes what to capture (e.g. "ownership and control,
 * including intermediaries"). UK and FATF/global profiles are authored bespoke.
 */
export function legalPersonJurisdictions(
  entityType: EntityType,
  descriptor: string,
  ownership = "the natural person(s) ultimately owning or controlling the entity"
): CddProfile[] {
  const legal = (extra: Source[]) =>
    sec("legal_entity", [
      it(`Identify the ${descriptor}: name, legal form, registration number and registered office; constitution`, extra),
    ]);
  return [
    {
      entityType,
      jurisdiction: "us",
      status: "in_force",
      inherentRisk: "varies",
      regulatoryBasis: cite("us_cip_banks", "us_cdd"),
      boThreshold: "25% ownership prong + control-prong individual",
      sddEligibility: "No SDD tier; risk-based scrutiny.",
      sections: [
        legal(cite("us_cip_banks")),
        sec("beneficial_ownership", [
          it(`Each individual owning 25%+ (up to four) plus one control-prong individual; identify ${ownership}`, cite("us_cdd_d"), { threshold: "25% or more" }),
        ]),
        sec("screening", [it("OFAC sanctions screening of the entity and BOs", cite("us_ffiec_pep"))]),
      ],
      eddTriggers: [edd("Higher-risk customer, geography or product", "Risk-based enhanced due diligence", cite("us_ffiec_pep"))],
    },
    {
      entityType,
      jurisdiction: "eu",
      status: "in_force",
      inherentRisk: "varies",
      regulatoryBasis: cite("eu_amld_13", "eu_amld_bo"),
      boThreshold: "25% (more than 25%; AMLR: 25% or more from 2027)",
      sddEligibility: "SDD where lower risk (AMLD5 Annex II).",
      sections: [
        legal(cite("eu_amld_13")),
        sec("beneficial_ownership", [
          it(`Natural person(s) owning or controlling more than 25%; senior managing official fallback; identify ${ownership}`, cite("eu_amld_bo"), { threshold: "more than 25%" }),
        ]),
        sec("screening", [it("PEP determination and sanctions screening", cite("eu_amld_pep"))]),
      ],
      eddTriggers: [edd("PEP, high-risk third country or complex structure (Annex III)", "Enhanced measures per Arts. 18-18a", cite("eu_amld_edd"))],
    },
    {
      entityType,
      jurisdiction: "de",
      status: "in_force",
      inherentRisk: "varies",
      regulatoryBasis: cite("de_gwg_11", "de_gwg_3"),
      boThreshold: "25% (more than 25% of capital or voting rights)",
      sddEligibility: "Simplified DD where low risk (GwG §14).",
      sections: [
        legal(cite("de_gwg_11", "de_gwg_12")),
        sec("beneficial_ownership", [
          it(`Natural person holding more than 25% or comparable control; fictitious BO fallback; register in the Transparenzregister; identify ${ownership}`, cite("de_gwg_3", "de_gwg_20"), { threshold: "more than 25%" }),
        ]),
        sec("screening", [it("PEP and sanctions screening", cite("de_gwg_15"))]),
      ],
      eddTriggers: [edd("PEP, high-risk third country or complex/unusual transactions", "Enhanced measures per §15(3)", cite("de_gwg_15"))],
    },
    {
      entityType,
      jurisdiction: "fr",
      status: "in_force",
      inherentRisk: "varies",
      regulatoryBasis: cite("fr_r5615", "fr_r5611"),
      boThreshold: "25% (more than 25% of capital or voting rights)",
      sddEligibility: "Vigilance allégée where low risk (CMF R.561-15).",
      sections: [
        legal(cite("fr_r5615", "fr_r5651")),
        sec("beneficial_ownership", [
          it(`Natural person holding more than 25% or exercising control; legal-representative fallback; cross-check the RBE; identify ${ownership}`, cite("fr_r5611", "fr_rbe"), { threshold: "more than 25%" }),
        ]),
        sec("screening", [it("PEP and sanctions screening", cite("fr_l56110"))]),
      ],
      eddTriggers: [edd("PEP, high-risk third country or complex chain", "Vigilance renforcée per L.561-10 / L.561-10-2", cite("fr_l56110", "fr_l561102"))],
    },
    {
      entityType,
      jurisdiction: "sg",
      status: "in_force",
      inherentRisk: "varies",
      regulatoryBasis: cite("sg_n626_6", "sg_n626_bo"),
      boThreshold: "25% (more than 25%, cascading)",
      sddEligibility: "SDD only where a licensed entity (Notice 626 Appendix 2).",
      sections: [
        legal(cite("sg_n626_6")),
        sec("beneficial_ownership", [
          it(`Cascading identification of the natural person(s) owning or controlling more than 25%; identify ${ownership}`, cite("sg_n626_bo"), { threshold: "more than 25%" }),
        ]),
        sec("screening", [it("Screen the entity, persons acting on its behalf and BOs", cite("sg_n626_6"))]),
      ],
      eddTriggers: [edd("PEP, FATF counter-measure country or complex structure", "EDD per Notice 626 §8", cite("sg_n626_edd"))],
    },
    {
      entityType,
      jurisdiction: "hk",
      status: "in_force",
      inherentRisk: "varies",
      regulatoryBasis: cite("hk_amlo_s2", "hk_amlo_bo"),
      boThreshold: "25% (more than 25% of shares or voting rights)",
      sddEligibility: "SDD only where a regulated FI / listed company (AMLO Sch. 2 s.4).",
      sections: [
        legal(cite("hk_amlo_s2", "hk_hkma_gl")),
        sec("beneficial_ownership", [
          it(`Individual owning or controlling more than 25%, or exercising ultimate control; identify ${ownership}`, cite("hk_amlo_bo"), { threshold: "more than 25%" }),
        ]),
        sec("screening", [it("Sanctions, PEP and adverse-media screening", cite("hk_hkma_gl"))]),
      ],
      eddTriggers: [edd("PEP, high-risk jurisdiction or opaque structure", "Enhanced due diligence per HKMA Guideline ch.4", cite("hk_hkma_gl"))],
    },
  ];
}
