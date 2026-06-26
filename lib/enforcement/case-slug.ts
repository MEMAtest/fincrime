import { enforcementCases } from "@/data/enforcement/cases";
import type { EnforcementCase } from "@/data/enforcement/types";

/**
 * Stable URL slug for an enforcement case (firm + year). The dataset has no
 * slug, so we derive one and disambiguate the few firms that appear in more than
 * one year by the year suffix. Kept here (not in the generated cases.ts) so the
 * generated file is never hand-edited.
 */
export function caseSlug(firm: string, year: number): string {
  // Slugify the FULL firm name (no word truncation) so distinct firms never
  // collapse to the same slug. Capped to keep URLs sane; full legal names are
  // already unique per case.
  const base = firm
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return `${base}-${year}`;
}

const bySlug = new Map<string, EnforcementCase>();
for (const c of enforcementCases) {
  const slug = caseSlug(c.firm, c.year);
  if (bySlug.has(slug)) {
    // Fail loud at module load if the generated dataset ever produces a slug
    // collision (rather than silently dropping a case from the static routes).
    throw new Error(`Duplicate enforcement case slug: ${slug}`);
  }
  bySlug.set(slug, c);
}

export const enforcementCaseSlugs: string[] = [...bySlug.keys()];

export function getEnforcementCaseBySlug(slug: string): EnforcementCase | undefined {
  return bySlug.get(slug);
}
