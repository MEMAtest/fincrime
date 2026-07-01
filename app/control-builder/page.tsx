import type { Metadata } from "next";
import ControlRegisterApp from "./ControlRegisterApp";
import { allControls, getControlBySlug, controlsForCase, controlsForTypology, controlsForThemes, controlsForFirmType } from "@/data/controls";
import { getEnforcementCaseBySlug } from "@/lib/enforcement/case-slug";
import { getTypologyBySlug } from "@/data/typologies";
import { FIRM_TYPE_LABEL, RISK_THEME_LABEL } from "@/data/typologies/labels";
import type { FirmType, RiskTheme } from "@/data/typologies/types";

export const metadata: Metadata = {
  title: "Control Builder: design defensible financial crime controls",
  description:
    "Adapt financial crime controls to your firm: set thresholds, owners and systems with guidance on what good looks like, then export a committee-ready control register. Start from an enforcement case or a risk.",
};

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ControlBuilderPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const control = one(sp.control);
  const from = one(sp.from);
  const caseParam = one(sp.case);
  const firmType = one(sp.firmType);

  let initialSlugs: string[] = [];
  let contextLabel: string | undefined;

  if (control) {
    const c = getControlBySlug(control);
    if (c) initialSlugs = [c.slug];
  }

  if (from?.startsWith("case:")) {
    const cs = getEnforcementCaseBySlug(from.slice(5));
    if (cs) {
      // Mirror the case page: fall back to theme-derived controls when no control
      // is tagged directly to the case, so "Design all N" never opens empty.
      const direct = controlsForCase(cs.firm, cs.year);
      const list = direct.length ? direct : controlsForThemes(cs.riskThemes).slice(0, 6);
      initialSlugs = list.map((c) => c.slug);
      contextLabel = `Designed from the ${cs.firm} (${cs.regulator} ${cs.year}, ${cs.fine}) enforcement case`;
    }
  } else if (from?.startsWith("typology:")) {
    const t = getTypologyBySlug(from.slice(9));
    if (t) {
      initialSlugs = controlsForTypology(t.slug).map((c) => c.slug);
      contextLabel = `Controls for the ${t.title} typology`;
    }
  } else if (from?.startsWith("theme:")) {
    // Enter from a firm profile's risk-theme drill-in: scope the register to the
    // controls that address that risk theme.
    const theme = from.slice(6) as RiskTheme;
    const list = controlsForThemes([theme]);
    if (list.length) {
      initialSlugs = list.map((c) => c.slug);
      contextLabel = `Controls for ${RISK_THEME_LABEL[theme]} risk. Rate, adjust and export.`;
    }
  }

  if (control && caseParam) {
    const cs = getEnforcementCaseBySlug(caseParam);
    if (cs) contextLabel = `Designed from the ${cs.firm} (${cs.year}) enforcement case`;
  }

  if (!initialSlugs.length && firmType && firmType in FIRM_TYPE_LABEL) {
    // Enter from a firm profile: the register is the full set of controls that
    // apply to that firm type, ready to rate and prune.
    initialSlugs = controlsForFirmType(firmType as FirmType).map((c) => c.slug);
    contextLabel = `Control register for a ${FIRM_TYPE_LABEL[firmType as FirmType]}. Rate, adjust and export.`;
  }

  // Default (no context): the full catalogue as a complete starting register.
  if (!initialSlugs.length) {
    initialSlugs = allControls.map((c) => c.slug);
  }

  // De-duplicate while preserving order.
  initialSlugs = [...new Set(initialSlugs)];

  const initialFirmType =
    firmType && firmType in FIRM_TYPE_LABEL ? (firmType as FirmType) : undefined;

  return (
    <ControlRegisterApp
      initialSlugs={initialSlugs}
      contextLabel={contextLabel}
      initialFirmType={initialFirmType}
    />
  );
}
