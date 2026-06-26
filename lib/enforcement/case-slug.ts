import { enforcementCases } from "@/data/enforcement/cases";
import type { EnforcementCase } from "@/data/enforcement/types";

/**
 * Stable URL slug for an enforcement case (firm + year). The dataset has no
 * slug, so we derive one and disambiguate the few firms that appear in more than
 * one year by the year suffix. Kept here (not in the generated cases.ts) so the
 * generated file is never hand-edited.
 */
export function caseSlug(firm: string, year: number): string {
  const base = firm
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .split("-")
    .slice(0, 7)
    .join("-");
  return `${base}-${year}`;
}

const bySlug = new Map<string, EnforcementCase>();
for (const c of enforcementCases) bySlug.set(caseSlug(c.firm, c.year), c);

export const enforcementCaseSlugs: string[] = [...bySlug.keys()];

export function getEnforcementCaseBySlug(slug: string): EnforcementCase | undefined {
  return bySlug.get(slug);
}
