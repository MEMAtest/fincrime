import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ToolFrame from "@/components/layout/ToolFrame";
import EnforcementCaseClient from "./EnforcementCaseClient";
import { fmtGbp } from "@/lib/enforcement/select";
import { lessonFor } from "@/data/enforcement/lessons";
import { caseSlug, enforcementCaseSlugs, getEnforcementCaseBySlug } from "@/lib/enforcement/case-slug";
import { controlsForCase, controlsForThemes } from "@/data/controls";

export const dynamicParams = false;

export function generateStaticParams() {
  return enforcementCaseSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = getEnforcementCaseBySlug(slug);
  if (!c) return { title: "Enforcement case not found" };
  return {
    title: `${c.firm} (${c.regulator} ${c.year}): what failed and the controls that would have caught it`,
    description: `The ${fmtGbp(c.amountGbp)} ${c.regulator} action against ${c.firm} in ${c.year}: what went wrong and the financial crime controls that would have prevented it.`,
  };
}

export default async function EnforcementCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getEnforcementCaseBySlug(slug);
  if (!c) notFound();

  const lesson = lessonFor(c.firm, c.year);
  const direct = controlsForCase(c.firm, c.year);
  // Fall back to controls for the case's risk themes when none is tagged directly,
  // so every case page still teaches.
  const controls = direct.length ? direct : controlsForThemes(c.riskThemes).slice(0, 6);

  return (
    <ToolFrame>
      <main className="flex-1">
        <EnforcementCaseClient
          caseData={c}
          rootCause={lesson?.rootCause ?? c.summary}
          preventedBy={lesson?.preventedBy ?? []}
          controls={controls}
          isDirect={direct.length > 0}
          cSlug={caseSlug(c.firm, c.year)}
        />
      </main>
      </ToolFrame>
  );
}
