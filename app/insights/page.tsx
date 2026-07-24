import type { Metadata } from "next";
import Link from "next/link";
import { Clock, ArrowRight } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import { insightArticles } from "@/data/insights";

export const metadata: Metadata = {
  title: "AML insights and guidance | FinCrime Control Lab",
  description:
    "Practical guides on AML controls, financial crime typologies, FCA enforcement lessons and regulatory obligations for UK-regulated firms -- grounded in FATF, JMLSG, FCA and MLR 2017.",
};

export default function InsightsPage() {
  const sorted = [...insightArticles].sort(
    (a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
  );

  return (
    <ToolFrame>
      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <ToolPageHeader
            eyebrow="INSIGHTS"
            title="AML guidance and"
            titleAccent="regulatory insight"
            subtitle="Practical articles on financial crime controls, typologies, FCA enforcement and AML obligations for UK-regulated firms. Each article cites published regulatory frameworks and links to the relevant tool."
          />

          <div className="mt-10 space-y-5">
            {sorted.map((article) => (
              <Link
                key={article.slug}
                href={`/insights/${article.slug}`}
                className="block glass-card rounded-2xl p-4 sm:p-6 hover:border-accent/40 transition-colors group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                    {new Date(article.publishDate).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-[var(--line)]">·</span>
                  <span className="flex items-center gap-1 text-[11px] text-text-muted">
                    <Clock className="h-3 w-3" />
                    {article.readingMinutes} min read
                  </span>
                </div>

                <h2 className="text-base font-semibold text-foreground group-hover:text-accent transition-colors leading-snug">
                  {article.title}
                </h2>
                <p className="mt-2 text-sm text-text-muted leading-relaxed line-clamp-3">
                  {article.summary}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {article.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--surface-2)] text-text-muted border border-[var(--line)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className="flex items-center gap-1 text-xs text-accent font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Read article <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </ToolFrame>
  );
}
