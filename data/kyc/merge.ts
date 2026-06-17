import type { Source } from "../typologies/types";
import type {
  EntityType,
  Jurisdiction,
  RiskLevel,
  CddCategoryKey,
  DocumentGuidance,
  RequirementStatus,
} from "./types";
import { CATEGORY_ORDER } from "./types";
import { getCddProfile } from "./index";
import { buildRequirements } from "./requirements";

/**
 * Multi-select merge engine. Combines the requirement lists of every selected
 * (entity x jurisdiction) scenario into ONE de-duplicated superset, keyed by
 * `category::title`. Each merged requirement records which scenarios it applies
 * to, groups acceptable documents per jurisdiction, and tracks the risk levels at
 * which it is required vs conditional so status can be derived across a multi-risk
 * selection. A single (1x1) selection reduces to today's single-scenario content.
 */

export interface ScenarioTag {
  entity: EntityType;
  jurisdiction: Jurisdiction;
  /** True when the FATF/global baseline was shown for this cell (no authored profile). */
  fallback: boolean;
}

export interface JurisdictionDocs {
  jurisdiction: Jurisdiction;
  guidance: DocumentGuidance[];
}

export interface MergedRequirement {
  /** Stable de-dup key, `${category}::${title}` — also the checklist/export id. */
  key: string;
  category: CddCategoryKey;
  title: string;
  whatItMeans: string;
  ruleSummary?: string;
  whatToCollect: string[];
  evidence: string[];
  legalBasis: Source[];
  /** Acceptable documents grouped per selected jurisdiction (empty when none). */
  documentGuidance: JurisdictionDocs[];
  /** Which selected scenarios this requirement applies to. */
  appliesTo: ScenarioTag[];
  /** Risk levels at which it is required (non-conditional) in some scenario. */
  requiredAtRisk: RiskLevel[];
  /** Risk levels at which it is conditional in some scenario. */
  conditionalAtRisk: RiskLevel[];
  eddTrigger: boolean;
}

export interface MergedResult {
  requirements: MergedRequirement[];
  /** Every (entity x jurisdiction) scenario contributing to the superset. */
  scenarios: ScenarioTag[];
  /** Union of the contributing profiles' regulatory bases. */
  provisions: Source[];
  /** Distinct beneficial-ownership thresholds across the selected profiles. */
  boThresholds: string[];
  anyFallback: boolean;
}

function addUnique(target: string[], values: string[]): void {
  for (const v of values) if (!target.includes(v)) target.push(v);
}

function mergeSources(target: Source[], values: Source[]): void {
  for (const s of values) {
    if (!target.some((t) => t.org === s.org && t.reference === s.reference)) target.push(s);
  }
}

/** Derive a merged requirement's status across the selected risk levels. */
export function mergedStatus(req: MergedRequirement, risks: RiskLevel[]): RequirementStatus {
  if (risks.some((r) => req.requiredAtRisk.includes(r))) return "required";
  if (risks.some((r) => req.conditionalAtRisk.includes(r))) return "conditional";
  return "not_applicable";
}

export function buildMergedRequirements(
  entities: EntityType[],
  jurisdictions: Jurisdiction[]
): MergedResult {
  const map = new Map<string, MergedRequirement>();
  const scenarios: ScenarioTag[] = [];
  const provisionSeen = new Map<string, Source>();
  const boThresholds: string[] = [];

  for (const entity of entities) {
    for (const jurisdiction of jurisdictions) {
      const lookup = getCddProfile(entity, jurisdiction);
      if (!lookup) continue;
      const tag: ScenarioTag = { entity, jurisdiction, fallback: lookup.fallback };
      scenarios.push(tag);
      if (lookup.profile.boThreshold && !boThresholds.includes(lookup.profile.boThreshold)) {
        boThresholds.push(lookup.profile.boThreshold);
      }
      for (const s of lookup.profile.regulatoryBasis) {
        provisionSeen.set(`${s.org}|${s.reference}`, s);
      }

      for (const r of buildRequirements(lookup.profile)) {
        const key = `${r.category}::${r.title}`;
        let m = map.get(key);
        if (!m) {
          m = {
            key,
            category: r.category,
            title: r.title,
            whatItMeans: r.whatItMeans,
            ruleSummary: r.ruleSummary,
            whatToCollect: [],
            evidence: [],
            legalBasis: [],
            documentGuidance: [],
            appliesTo: [],
            requiredAtRisk: [],
            conditionalAtRisk: [],
            eddTrigger: false,
          };
          map.set(key, m);
        }

        addUnique(m.whatToCollect, r.whatToCollect);
        addUnique(m.evidence, r.evidence);
        mergeSources(m.legalBasis, r.legalBasis);

        if (r.documentGuidance && r.documentGuidance.length) {
          // Group by the profile's actual jurisdiction (the docs were resolved for
          // it). On a FATF fallback this is "global", so fallback cells aren't
          // mislabelled with the selected jurisdiction's name.
          const docJur = lookup.profile.jurisdiction;
          let jd = m.documentGuidance.find((d) => d.jurisdiction === docJur);
          if (!jd) {
            jd = { jurisdiction: docJur, guidance: [] };
            m.documentGuidance.push(jd);
          }
          for (const dg of r.documentGuidance) {
            if (!jd.guidance.some((x) => x.label === dg.label && x.source.reference === dg.source.reference)) {
              jd.guidance.push(dg);
            }
          }
        }

        if (!m.appliesTo.some((a) => a.entity === entity && a.jurisdiction === jurisdiction)) {
          m.appliesTo.push(tag);
        }

        const bucket = r.conditional ? m.conditionalAtRisk : m.requiredAtRisk;
        for (const rl of r.appliesAtRisk) if (!bucket.includes(rl)) bucket.push(rl);
        if (r.eddTrigger) m.eddTrigger = true;
      }
    }
  }

  // Stable sort keeps category grouping while preserving first-seen order within a category.
  const requirements = [...map.values()].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
  );

  return {
    requirements,
    scenarios,
    provisions: [...provisionSeen.values()],
    boThresholds,
    anyFallback: scenarios.some((s) => s.fallback),
  };
}
