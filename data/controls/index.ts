import { control01 } from "./control-01";
import { control02 } from "./control-02";
import { control03 } from "./control-03";
import { control04 } from "./control-04";
import { control05 } from "./control-05";
import { control06 } from "./control-06";
import { control07 } from "./control-07";
import { control08 } from "./control-08";
import { control09 } from "./control-09";
import { control10 } from "./control-10";
import { control11 } from "./control-11";
import { control12 } from "./control-12";
import { control13 } from "./control-13";
import { control14 } from "./control-14";
import { control15 } from "./control-15";
import { control16 } from "./control-16";
import { control17 } from "./control-17";
import { control18 } from "./control-18";
import { control19 } from "./control-19";
import { control20 } from "./control-20";
import { control21 } from "./control-21";
import { control22 } from "./control-22";
import { control23 } from "./control-23";
import { control24 } from "./control-24";
import { control25 } from "./control-25";
import { control26 } from "./control-26";
import { control27 } from "./control-27";
import { control28 } from "./control-28";
import { control29 } from "./control-29";
import { control30 } from "./control-30";
import { control31 } from "./control-31";
import { control32 } from "./control-32";
import { control33 } from "./control-33";
import { control34 } from "./control-34";
import { control35 } from "./control-35";
import { control36 } from "./control-36";
import { control37 } from "./control-37";
import { control38 } from "./control-38";
import { control39 } from "./control-39";
import { control40 } from "./control-40";
import { control41 } from "./control-41";
import { FIRM_PROFILES } from "../firm-profiles";
import type { Control, ControlCategory } from "./types";
import type { FirmType, RiskTheme } from "../typologies/types";

export const allControls: Control[] = [
  control01, control02, control03, control04, control05, control06, control07, control08,
  control09, control10, control11, control12, control13, control14, control15, control16, control17,
  control18, control19, control20, control21, control22, control23, control24, control25,
  control26, control27, control28, control29, control30, control31, control32, control33,
  control34, control35, control36, control37, control38, control39, control40, control41,
];

export const CONTROL_CATEGORY_ORDER: ControlCategory[] = [
  "customer_due_diligence",
  "transaction_monitoring",
  "screening",
  "ongoing_monitoring",
  "governance_reporting",
];

export const CONTROL_CATEGORY_LABEL: Record<ControlCategory, string> = {
  customer_due_diligence: "Customer Due Diligence",
  transaction_monitoring: "Transaction Monitoring",
  screening: "Screening",
  ongoing_monitoring: "Ongoing Monitoring",
  governance_reporting: "Governance & Reporting",
};

export const CONTROL_TYPE_LABEL: Record<Control["controlType"], string> = {
  preventive: "Preventive",
  detective: "Detective",
  corrective: "Corrective",
};

export function getControlBySlug(slug: string): Control | undefined {
  return allControls.find((c) => c.slug === slug);
}

export function getControlById(id: number): Control | undefined {
  return allControls.find((c) => c.id === id);
}

/** Controls that mitigate a given typology (by slug). */
export function controlsForTypology(slug: string): Control[] {
  return allControls.filter((c) => c.typologySlugs.includes(slug));
}

/** Controls that would have prevented a given enforcement case (firm + year). */
export function controlsForCase(firm: string, year: number): Control[] {
  const key = firm.trim().toLowerCase();
  return allControls.filter((c) =>
    c.enforcementRefs.some((r) => r.year === year && r.firm.trim().toLowerCase() === key)
  );
}

/** Controls applicable to a firm type. */
export function controlsForFirmType(firmType: FirmType): Control[] {
  return allControls.filter((c) => c.applicableFirmTypes.includes(firmType));
}

/**
 * A balanced starter register for a firm type: controls applicable to the firm
 * that address its higher inherent risks, spread across control categories (one
 * pass per category) so the builder opens populated rather than empty when
 * entered from a firm profile. Fully editable by the user.
 */
export function starterControlsForFirmType(firmType: FirmType, limit = 8): Control[] {
  const profile = FIRM_PROFILES[firmType];
  const highThemes = new Set(
    profile.inherentRisks
      .filter((r) => r.level === "very_high" || r.level === "high")
      .map((r) => r.theme)
  );
  const relevant = allControls.filter(
    (c) => c.applicableFirmTypes.includes(firmType) && c.riskThemes.some((t) => highThemes.has(t))
  );
  const byCat = new Map<ControlCategory, Control[]>();
  for (const cat of CONTROL_CATEGORY_ORDER) byCat.set(cat, []);
  for (const c of relevant) byCat.get(c.category)?.push(c);

  const out: Control[] = [];
  for (let i = 0; out.length < limit; i++) {
    let advanced = false;
    for (const cat of CONTROL_CATEGORY_ORDER) {
      const arr = byCat.get(cat);
      if (arr && i < arr.length && out.length < limit) {
        out.push(arr[i]);
        advanced = true;
      }
    }
    if (!advanced) break;
  }
  return out;
}

/** Controls addressing any of the given risk themes. */
export function controlsForThemes(themes: RiskTheme[]): Control[] {
  if (!themes.length) return allControls;
  const set = new Set(themes);
  return allControls.filter((c) => c.riskThemes.some((t) => set.has(t)));
}

export interface CategoryGroup {
  category: ControlCategory;
  controls: Control[];
}

/**
 * Each control ONCE, grouped by control category (in CONTROL_CATEGORY_ORDER),
 * optionally narrowed by firm type / risk themes / framework. This replaces the
 * by-risk-theme grouping on the Controls Library, where a control that mitigates
 * three themes appeared three times and read as a duplicate. Risk theme is now a
 * filter (OR-match) with per-card theme badges rather than the grouping key.
 */
export function controlsByCategory(opts?: {
  firmType?: FirmType;
  themes?: RiskTheme[];
  frameworkOrg?: string;
}): CategoryGroup[] {
  const { firmType, themes, frameworkOrg } = opts ?? {};
  const themeSet = themes && themes.length ? new Set(themes) : null;
  const filtered = allControls.filter((c) => {
    if (firmType && !c.applicableFirmTypes.includes(firmType)) return false;
    if (themeSet && !c.riskThemes.some((t) => themeSet.has(t))) return false;
    if (frameworkOrg && !c.sources.some((s) => s.org === frameworkOrg)) return false;
    return true;
  });
  const byCat = new Map<ControlCategory, Control[]>();
  for (const cat of CONTROL_CATEGORY_ORDER) byCat.set(cat, []);
  for (const c of filtered) byCat.get(c.category)?.push(c);
  const out: CategoryGroup[] = [];
  for (const cat of CONTROL_CATEGORY_ORDER) {
    const arr = byCat.get(cat)!;
    if (arr.length) out.push({ category: cat, controls: arr });
  }
  return out;
}

/**
 * A sensible default priority for a control, DERIVED from real data (not
 * fabricated): controls with a real enforcement precedent are High; controls
 * mitigating several typologies are Medium; the rest Low. Fully editable by the
 * user in the register.
 */
export function defaultPriority(c: Control): "high" | "medium" | "low" {
  // Weighted by real signal: multiple enforcement precedents or broad typology
  // coverage => High; a single precedent or some coverage => Medium; else Low.
  if (c.enforcementRefs.length >= 2 || c.typologySlugs.length >= 3) return "high";
  if (c.enforcementRefs.length >= 1 || c.typologySlugs.length >= 1) return "medium";
  return "low";
}

/**
 * The count of cited evidence items backing a control: its framework sources
 * plus the enforcement precedents it addresses. Real, not fabricated.
 */
export function evidenceCount(c: Control): number {
  return c.sources.length + c.enforcementRefs.length;
}

export type { Control, ControlCategory } from "./types";
export type { ControlType, EnforcementRef, StrongVsWeak } from "./types";
