import { describe, expect, it } from "vitest";
import { typologySlugsForCase, typologySlugsForThemes, CASE_TYPOLOGY_SLUG_CAP } from "../select";
import { enforcementCases } from "../../../data/enforcement/cases";
import { controlsForCase, controlsForThemes } from "../../../data/controls";

/** Same union-of-mapped-controls' typologySlugs the enforcement case page computes server-side. */
function caseControlTypologySlugs(firm: string, year: number, riskThemes: (typeof enforcementCases)[number]["riskThemes"]) {
  const direct = controlsForCase(firm, year);
  const mapped = direct.length ? direct : controlsForThemes(riskThemes);
  return Array.from(new Set(mapped.flatMap((c) => c.typologySlugs)));
}

describe("typologySlugsForCase", () => {
  it("returns nothing for no themes", () => {
    expect(typologySlugsForCase([], []).slugs).toEqual([]);
  });

  it("narrows to the intersection with the case's own mapped-control typology slugs when non-empty", () => {
    const themeBucket = typologySlugsForThemes(["money_laundering"]);
    expect(themeBucket.length).toBeGreaterThan(5);
    const controlSlugs = [themeBucket[0], themeBucket[1], "not-in-bucket-at-all"];
    const result = typologySlugsForCase(["money_laundering"], controlSlugs);
    expect(result.usedFallback).toBe(false);
    expect(result.slugs.sort()).toEqual([themeBucket[0], themeBucket[1]].sort());
  });

  it("falls back to the whole theme bucket when the intersection is empty", () => {
    const themeBucket = typologySlugsForThemes(["money_laundering"]);
    const result = typologySlugsForCase(["money_laundering"], ["totally-unrelated-slug"]);
    expect(result.usedFallback).toBe(true);
    expect(result.slugs).toEqual(themeBucket.slice(0, CASE_TYPOLOGY_SLUG_CAP));
    expect(result.totalBeforeCap).toBe(themeBucket.length);
  });

  it("caps the result and reports the pre-cap total rather than silently truncating", () => {
    const themeBucket = typologySlugsForThemes(["money_laundering"]);
    const result = typologySlugsForCase(["money_laundering"], themeBucket, 3);
    expect(result.slugs).toHaveLength(3);
    expect(result.totalBeforeCap).toBe(themeBucket.length);
  });

  it("real 44-case data: intersection is genuinely case-specific, not byte-identical across every money_laundering case", () => {
    const mlCases = enforcementCases.filter(
      (c) => c.riskThemes.length === 1 && c.riskThemes[0] === "money_laundering"
    );
    expect(mlCases.length).toBeGreaterThan(10);

    const linkKeys = new Set<string>();
    for (const c of mlCases) {
      const controlSlugs = caseControlTypologySlugs(c.firm, c.year, c.riskThemes);
      const { slugs } = typologySlugsForCase(c.riskThemes, controlSlugs);
      linkKeys.add(slugs.join(","));
    }
    // If every pure money_laundering case produced the same link, this would
    // be 1 - the exact defect this fix closes.
    expect(linkKeys.size).toBeGreaterThan(1);
  });

  it("real 44-case data: min/median/max slug counts are printed and every case stays within the cap", () => {
    const counts = enforcementCases
      .map((c) => {
        const controlSlugs = caseControlTypologySlugs(c.firm, c.year, c.riskThemes);
        return typologySlugsForCase(c.riskThemes, controlSlugs).slugs.length;
      })
      .sort((a, b) => a - b);

    const min = counts[0];
    const max = counts[counts.length - 1];
    const mid = Math.floor(counts.length / 2);
    const median = counts.length % 2 ? counts[mid] : (counts[mid - 1] + counts[mid]) / 2;

    console.log(`typologySlugsForCase over ${counts.length} real cases: min=${min} median=${median} max=${max}`);

    expect(counts.every((n) => n <= CASE_TYPOLOGY_SLUG_CAP)).toBe(true);
    expect(min).toBeGreaterThanOrEqual(0);
  });
});
