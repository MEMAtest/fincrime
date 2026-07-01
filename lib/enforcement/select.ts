import { enforcementCases } from "@/data/enforcement/cases";
import { enforcementBenchmarks } from "@/data/enforcement/benchmarks";
import { firmTypeTagsFor } from "@/data/enforcement/firm-tags";
import type { EnforcementCase, EnforcementBenchmarks } from "@/data/enforcement/types";
import type { RiskTheme, FirmType } from "@/data/typologies/types";

export { enforcementBenchmarks };
export const totalEnforcementCases = enforcementCases.length;

/**
 * Firm types for a case: the generated tags merged with the hand-authored
 * `firm-tags` sidecar (the generator only classifies a subset, mostly banks).
 * Use this everywhere instead of `case.firmTypes` so per-firm-type views are
 * honest without ever hand-editing the generated `cases.ts`.
 */
export function effectiveFirmTypes(c: EnforcementCase): FirmType[] {
  const extra = firmTypeTagsFor(c.firm, c.year);
  if (!extra.length) return c.firmTypes;
  return Array.from(new Set<FirmType>([...c.firmTypes, ...extra]));
}

/** Look up a real enforcement case by firm + year (trim/lowercase matched). */
export function findEnforcementCase(firm: string, year: number): EnforcementCase | undefined {
  const key = firm.trim().toLowerCase();
  return enforcementCases.find((c) => c.year === year && c.firm.trim().toLowerCase() === key);
}

/** Compact GBP formatter shared across the evidence and benchmarks panels. */
export function fmtGbp(n: number): string {
  if (n >= 1_000_000_000) return `£${(n / 1_000_000_000).toFixed(1)}bn`;
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(0)}m`;
  if (n >= 1_000) return `£${Math.round(n / 1_000)}k`;
  return `£${n}`;
}

/** Total GBP penalties across the cases tagged to the given themes. */
export function totalPenaltiesForThemes(themes: RiskTheme[]): number {
  const set = new Set(themes);
  return enforcementCases
    .filter((c) => c.riskThemes.some((t) => set.has(t)))
    .reduce((sum, c) => sum + c.amountGbp, 0);
}

/** How many cases are tagged to the given themes (mirrors casesForThemes' all-cases fallback). */
export function countCasesForThemes(themes: RiskTheme[]): number {
  if (!themes.length) return enforcementCases.length;
  const set = new Set(themes);
  const n = enforcementCases.filter((c) => c.riskThemes.some((t) => set.has(t))).length;
  return n || enforcementCases.length;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Enforcement benchmarks recomputed for a single firm type (or the full set for
 * "all"). Unlike `casesForFirmType`, this does NOT fall back to all cases when a
 * firm type has none, so the displayed counts move honestly with the filter.
 */
export function benchmarksForFirmType(firm: FirmType | "all"): EnforcementBenchmarks {
  if (firm === "all") return enforcementBenchmarks;

  const cases = enforcementCases.filter((c) => effectiveFirmTypes(c).includes(firm));

  const themeCounts = new Map<RiskTheme, number>();
  const yearAgg = new Map<number, { count: number; totalGbp: number }>();
  for (const c of cases) {
    for (const theme of c.riskThemes) {
      themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
    }
    const y = yearAgg.get(c.year) ?? { count: 0, totalGbp: 0 };
    y.count += 1;
    y.totalGbp += c.amountGbp;
    yearAgg.set(c.year, y);
  }

  const amounts = cases.map((c) => c.amountGbp);
  const totalGbp = amounts.reduce((sum, n) => sum + n, 0);
  const top = [...cases].sort(byAmount)[0];

  return {
    generatedAt: enforcementBenchmarks.generatedAt,
    source: enforcementBenchmarks.source,
    totalCases: cases.length,
    byRiskTheme: [...themeCounts.entries()]
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => b.count - a.count),
    byYear: [...yearAgg.entries()]
      .map(([year, v]) => ({ year, count: v.count, totalGbp: v.totalGbp }))
      .sort((a, b) => a.year - b.year),
    byFirmCategory: [],
    topBreachCategories: [],
    fineStats: {
      totalGbp,
      medianGbp: median(amounts),
      maxGbp: top?.amountGbp ?? 0,
      maxFirm: top?.firm ?? "",
    },
  };
}

const byAmount = (a: EnforcementCase, b: EnforcementCase) => b.amountGbp - a.amountGbp;

/** Real cases tagged to a risk theme (falls back to all financial-crime cases). */
export function casesForTheme(theme: RiskTheme, limit = 6): EnforcementCase[] {
  const direct = enforcementCases.filter((c) => c.riskThemes.includes(theme));
  const list = direct.length ? direct : enforcementCases;
  return [...list].sort(byAmount).slice(0, limit);
}

/** Union of cases across several themes, de-duplicated, largest fines first. */
export function casesForThemes(themes: RiskTheme[], limit = 6): EnforcementCase[] {
  if (!themes.length) return [...enforcementCases].sort(byAmount).slice(0, limit);
  const seen = new Set<string>();
  const out: EnforcementCase[] = [];
  for (const c of [...enforcementCases].sort(byAmount)) {
    if (c.riskThemes.some((t) => themes.includes(t)) && !seen.has(c.firm + c.year)) {
      seen.add(c.firm + c.year);
      out.push(c);
    }
  }
  return (out.length ? out : [...enforcementCases].sort(byAmount)).slice(0, limit);
}

/** Cases applicable to a firm type (falls back to all when unclassified). */
export function casesForFirmType(firmType: FirmType, limit = 6): EnforcementCase[] {
  const direct = enforcementCases.filter((c) => effectiveFirmTypes(c).includes(firmType));
  const list = direct.length ? direct : enforcementCases;
  return [...list].sort(byAmount).slice(0, limit);
}

/** How many cases are tagged to a firm type (no fallback, so counts move honestly). */
export function countCasesForFirmType(firmType: FirmType): number {
  return enforcementCases.filter((c) => effectiveFirmTypes(c).includes(firmType)).length;
}
