import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ControlBuilderClient from "./ControlBuilderClient";
import { getControlBySlug, controlsForCase, controlsForTypology } from "@/data/controls";
import { getEnforcementCaseBySlug } from "@/lib/enforcement/case-slug";
import { getTypologyBySlug } from "@/data/typologies";
import { FIRM_TYPE_LABEL } from "@/data/typologies/labels";
import type { FirmType } from "@/data/typologies/types";

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
      initialSlugs = controlsForCase(cs.firm, cs.year).map((c) => c.slug);
      contextLabel = `Designed from the ${cs.firm} (${cs.regulator} ${cs.year}, ${cs.fine}) enforcement case`;
    }
  } else if (from?.startsWith("typology:")) {
    const t = getTypologyBySlug(from.slice(9));
    if (t) {
      initialSlugs = controlsForTypology(t.slug).map((c) => c.slug);
      contextLabel = `Controls for the ${t.title} typology`;
    }
  }

  if (control && caseParam) {
    const cs = getEnforcementCaseBySlug(caseParam);
    if (cs) contextLabel = `Designed from the ${cs.firm} (${cs.year}) enforcement case`;
  }

  if (!initialSlugs.length && firmType && firmType in FIRM_TYPE_LABEL) {
    contextLabel = `Building controls for a ${FIRM_TYPE_LABEL[firmType as FirmType]}`;
  }

  // De-duplicate while preserving order.
  initialSlugs = [...new Set(initialSlugs)];

  return (
    <>
      <Header />
      <main className="flex-1">
        <ControlBuilderClient initialSlugs={initialSlugs} contextLabel={contextLabel} />
      </main>
      <Footer />
    </>
  );
}
