/**
 * Controls library tagging + grouping logic (SPEC.md "Controls library and
 * tagging" and "Reuse, adapt or new"). Code tags are read directly off
 * mapped register fields; suggested tags come from the writer model but are
 * rejected in code if they are not in the controlled list - the model may
 * never invent a new tag value.
 */

export type CoverageGroup = "reuse" | "adapt" | "new" | "unassessed";

export function coverageGroup(coverageRaw: string | null | undefined): CoverageGroup {
  const value = (coverageRaw ?? "").trim().toLowerCase();
  if (value === "yes") return "reuse";
  if (value === "partial") return "adapt";
  if (value === "no") return "new";
  return "unassessed"; // blank, error, or anything else - excluded until the user sets a value
}

export interface CodeTags {
  backoffice_control?: string;
  fincrime_area?: string;
  jurisdiction?: string;
  regulation_reference?: string;
  coverage?: string;
  products_used_in?: string;
}

export function buildCodeTags(fields: Record<string, string>): CodeTags {
  const tags: CodeTags = {};
  if (fields.backoffice_control?.trim()) tags.backoffice_control = fields.backoffice_control.trim();
  if (fields.fincrime_area?.trim()) tags.fincrime_area = fields.fincrime_area.trim();
  if (fields.jurisdiction?.trim()) tags.jurisdiction = fields.jurisdiction.trim();
  const regulationParts = [fields.source_regulation, fields.requirement_reference].filter((v) => v && v.trim());
  if (regulationParts.length) tags.regulation_reference = regulationParts.join(" ").trim();
  if (fields.control_coverage_assessment?.trim()) tags.coverage = fields.control_coverage_assessment.trim();
  if (fields.fincrime_product?.trim() && fields.fincrime_product.trim().toLowerCase() !== "n/a") {
    tags.products_used_in = fields.fincrime_product.trim();
  }
  return tags;
}

export interface SuggestedTagCandidate {
  tagType: "risk_addressed" | "customer_type" | "lifecycle_stage";
  value: string;
  evidencePhrase: string;
}

export interface TagAcceptanceResult {
  accepted: SuggestedTagCandidate[];
  rejected: { candidate: SuggestedTagCandidate; reason: string }[];
}

/**
 * Enforces the controlled list in code: any suggested value not present
 * (case-insensitively) in its controlled list is rejected outright, never
 * shown as a confirmable suggestion. This is the boundary SPEC.md requires:
 * "the model may not invent new values."
 */
export function enforceControlledTags(
  candidates: SuggestedTagCandidate[],
  controlledLists: { risk_addressed: string[]; customer_type: string[]; lifecycle_stage: string[] }
): TagAcceptanceResult {
  const accepted: SuggestedTagCandidate[] = [];
  const rejected: { candidate: SuggestedTagCandidate; reason: string }[] = [];
  for (const candidate of candidates) {
    const list = controlledLists[candidate.tagType].map((v) => v.toLowerCase());
    if (!candidate.evidencePhrase || !candidate.evidencePhrase.trim()) {
      rejected.push({ candidate, reason: "No evidence phrase supplied for this suggestion." });
      continue;
    }
    if (!list.includes(candidate.value.toLowerCase())) {
      rejected.push({ candidate, reason: `"${candidate.value}" is not in the controlled list for ${candidate.tagType}.` });
      continue;
    }
    accepted.push(candidate);
  }
  return { accepted, rejected };
}

export interface MergeableControl {
  id: string;
  backofficeControl: string | null;
  confirmedRiskTags: string[]; // confirmed risk_addressed tag values
}

export interface MergeCandidateGroup {
  backofficeControl: string;
  riskTagValue: string;
  controlIds: string[];
}

/**
 * Proposes merge candidate groups: controls sharing a back office control
 * AND a shared CONFIRMED risk tag (SPEC.md build note: "risk tags must be
 * confirmed before merges are proposed on them"). Controls with no
 * confirmed risk tag, or no backoffice control, never form a group.
 */
export function proposeMergeGroups(controls: MergeableControl[]): MergeCandidateGroup[] {
  const groups = new Map<string, Set<string>>();
  for (const control of controls) {
    if (!control.backofficeControl) continue;
    for (const riskTag of control.confirmedRiskTags) {
      const key = `${control.backofficeControl}::${riskTag}`;
      const set = groups.get(key) ?? new Set<string>();
      set.add(control.id);
      groups.set(key, set);
    }
  }
  const result: MergeCandidateGroup[] = [];
  for (const [key, ids] of groups) {
    if (ids.size < 2) continue; // a merge needs at least two controls
    const [backofficeControl, riskTagValue] = key.split("::");
    result.push({ backofficeControl, riskTagValue, controlIds: Array.from(ids) });
  }
  return result;
}
