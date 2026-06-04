import { enforcementCases } from "@/data/enforcement/cases";
import { enforcementBenchmarks } from "@/data/enforcement/benchmarks";
import type { EnforcementCase } from "@/data/enforcement/types";
import type { RiskTheme, FirmType } from "@/data/typologies/types";

export { enforcementBenchmarks };
export const totalEnforcementCases = enforcementCases.length;

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
  const direct = enforcementCases.filter((c) => c.firmTypes.includes(firmType));
  const list = direct.length ? direct : enforcementCases;
  return [...list].sort(byAmount).slice(0, limit);
}
