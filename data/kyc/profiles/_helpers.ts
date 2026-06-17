import type { Source } from "../../typologies/types";
import type { CddItem, CddSection, CddSectionKey, EddTrigger, RiskLevel } from "../types";
import { SECTION_TITLE } from "../types";

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
