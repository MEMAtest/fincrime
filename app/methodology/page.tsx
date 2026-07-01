import type { Metadata } from "next";
import ToolFrame from "@/components/layout/ToolFrame";
import SourceBadge from "@/components/shared/SourceBadge";
import { FRAMEWORK_SOURCES } from "@/data/sources";
import { enforcementBenchmarks, totalEnforcementCases } from "@/lib/enforcement/select";
import type { SourceOrg } from "@/data/typologies/types";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How FinCrime Control Lab works: deterministic, weighted scoring, citations to authoritative frameworks, a bounded role for AI, and real FCA enforcement data with its refresh date.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-2 text-sm text-text-muted leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function MethodologyPage() {
  return (
    <ToolFrame>
      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            <span className="gradient-text">Methodology</span>
          </h1>
          <p className="mt-3 text-text-muted max-w-2xl">
            How the lab produces its results, what it is grounded in, and where the limits are. The goal is
            that every output is explainable and traceable to a primary source.
          </p>

          <Section title="Deterministic scoring (no AI)">
            <p>
              Matches and scores are calculated by a fixed weighted model, not AI. In TypologyIQ each typology
              scores firm type 30, product 25, customer 20 and risk theme 25, awarding the weight when any of
              your selections applies. The same inputs always produce the same result, and the &quot;Why this
              matched&quot; panel shows exactly which of your selections contributed which points.
            </p>
          </Section>

          <Section title="Cited to authoritative frameworks">
            <p>
              Typologies, controls and KYC requirements map to primary sources. Every citation can be opened in
              place to read and copy the reference; the lab does not navigate you off-site. The standards used:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {FRAMEWORK_SOURCES.map((f) => (
                <SourceBadge key={f.org} source={f.org as SourceOrg} reference={f.title} url={f.url} title={f.title} />
              ))}
            </div>
          </Section>

          <Section title="A bounded role for AI">
            <p>
              AI is used only to write the plain-English &quot;Risk Intelligence&quot; summary that accompanies a
              result. It restates and explains the deterministic output; it does not introduce new facts or
              citations, and it does not change the score. AI output is labelled as AI-assisted and is not legal
              advice. Treat it as a starting point and verify against the cited sources.
            </p>
          </Section>

          <Section title="Real enforcement data">
            <p>
              The evidence and benchmark views draw on {totalEnforcementCases} real FCA enforcement cases from
              the public fines dataset (regactions.com / fcafines), each linked to its final notice. Where a case
              is annotated, the lab also shows the controls that would have caught the failure. This data was
              last refreshed on {enforcementBenchmarks.generatedAt}.
            </p>
          </Section>

          <Section title="Limits">
            <p>
              The lab is a design and education aid, not legal advice and not a substitute for your firm&apos;s
              own risk assessment. Coverage is broad but not exhaustive, regulation changes, and you should
              always verify against the cited primary source and your own policies before relying on an output.
            </p>
          </Section>
        </section>
      </main>
      </ToolFrame>
  );
}
