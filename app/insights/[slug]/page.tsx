import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock, ArrowRight } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import ArticleCitations from "@/components/insights/ArticleCitations";
import { insightArticles, getInsightBySlug } from "@/data/insights";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return insightArticles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getInsightBySlug(slug);
  if (!article) return {};

  return {
    title: `${article.title} | FinCrime Control Lab`,
    description: article.summary,
    openGraph: {
      title: article.title,
      description: article.summary,
      type: "article",
      publishedTime: article.publishDate,
    },
  };
}

export default async function InsightArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getInsightBySlug(slug);
  if (!article) notFound();

  return (
    <ToolFrame>
      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Back link */}
          <Link
            href="/insights"
            className="inline-flex items-center gap-1.5 py-2 text-xs text-text-muted hover:text-accent transition-colors mb-6"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All insights
          </Link>

          {/* Header */}
          <header className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                {new Date(article.publishDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span className="text-[var(--line)]">·</span>
              <span className="flex items-center gap-1 text-xs text-text-muted">
                <Clock className="h-3 w-3" />
                {article.readingMinutes} min read
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
              {article.title}
            </h1>
            <p className="mt-4 text-base text-text-muted leading-relaxed">
              {article.summary}
            </p>

            <div className="mt-5 flex flex-wrap gap-1.5">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--surface-2)] text-text-muted border border-[var(--line)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </header>

          {/* Body */}
          <div className="prose-article space-y-8">
            {article.sections.map((section, i) => (
              <section key={i}>
                {section.heading && (
                  <h2 className="text-lg font-semibold text-foreground mb-3">
                    {section.heading}
                  </h2>
                )}
                <div className="space-y-4">
                  {section.paragraphs.map((para, j) => (
                    <p key={j} className="text-sm text-text-muted leading-relaxed">
                      {para}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Tool CTA */}
          <div className="mt-12 glass-card rounded-2xl p-6 border-accent/20 bg-accent/[0.03]">
            <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-2">
              Try the tool
            </p>
            <p className="text-sm text-text-muted leading-relaxed mb-4">
              {article.toolCTA.description}
            </p>
            <Link
              href={article.toolCTA.href}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {article.toolCTA.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Citations */}
          <ArticleCitations citations={article.citations} />
        </article>
      </main>
    </ToolFrame>
  );
}
