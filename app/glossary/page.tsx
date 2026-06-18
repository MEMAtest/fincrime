import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SourceBadge from "@/components/shared/SourceBadge";
import { GLOSSARY } from "@/data/glossary";

export const metadata: Metadata = {
  title: "Financial crime glossary",
  description:
    "Plain-English definitions of financial crime and AML terms (typology, beneficial owner, PEP, SAR, EDD, SDD, MLRO, structuring and more), each cited to an authoritative source.",
};

export default function GlossaryPage() {
  const entries = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Financial crime <span className="gradient-text">glossary</span>
          </h1>
          <p className="mt-3 text-text-muted max-w-2xl">
            Plain-English definitions of the terms used across the lab. Each is cited to an authoritative
            source; open the badge to see and copy the reference. This is guidance, not legal advice.
          </p>

          <div className="mt-8 space-y-4">
            {entries.map((e) => (
              <div key={e.slug} id={e.slug} className="glass-card rounded-2xl p-5 scroll-mt-24">
                <h2 className="text-base font-semibold text-foreground">{e.term}</h2>
                {e.aliases && e.aliases.length > 0 && (
                  <p className="text-[11px] text-text-muted mt-0.5">Also: {e.aliases.join(", ")}</p>
                )}
                <p className="mt-2 text-sm text-text-muted leading-relaxed">{e.long ?? e.short}</p>
                {e.source && (
                  <div className="mt-3">
                    <SourceBadge source={e.source.org} reference={e.source.reference} url={e.source.url} title={e.source.title} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
