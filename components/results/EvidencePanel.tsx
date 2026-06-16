"use client";

import { ExternalLink, Scale, ListChecks, BookOpen } from "lucide-react";
import { casesForThemes } from "@/lib/enforcement/select";
import { INDICATORS_BY_THEME, FRAMEWORK_SOURCES } from "@/data/sources";
import { THEME_CONFIG } from "@/components/icons/RiskThemeIcon";
import type { RiskTheme } from "@/data/typologies/types";

export default function EvidencePanel({ themes }: { themes: RiskTheme[] }) {
  const cases = casesForThemes(themes, 6);

  // De-duplicate cited indicators across the selected themes
  const seen = new Set<string>();
  const indicators = themes
    .flatMap((t) => INDICATORS_BY_THEME[t] ?? [])
    .filter((i) => (seen.has(i.indicator) ? false : (seen.add(i.indicator), true)));

  return (
    <div className="space-y-8">
      {/* Real enforcement cases */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Scale className="h-5 w-5 text-emerald-500" />
          <h3 className="text-lg font-semibold text-foreground">
            Real enforcement: what failure costs
          </h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {cases.map((c) => (
            <div key={`${c.firm}-${c.year}`} className="glass-card rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="font-semibold text-foreground leading-tight">{c.firm}</div>
                  <div className="text-xs text-text-muted">
                    {c.regulator} · {c.year}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-bold text-emerald-500 tabular-nums">
                  {c.fine}
                </span>
              </div>
              <p className="text-sm text-text-muted leading-relaxed">{c.summary}</p>
              {c.sourceUrl ? (
                <a
                  href={c.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500 hover:text-emerald-400"
                >
                  Final notice <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-text-muted">
          Source: FCA fines dataset (regactions.com). Cases tagged to{" "}
          {themes.map((t) => THEME_CONFIG[t]?.label ?? t).join(", ") || "financial crime"}.
        </p>
      </section>

      {/* Cited red-flag indicators */}
      {indicators.length > 0 ? (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <ListChecks className="h-5 w-5 text-emerald-500" />
            <h3 className="text-lg font-semibold text-foreground">
              Red-flag indicators, cited
            </h3>
          </div>
          <ul className="space-y-2.5">
            {indicators.map((ind) => (
              <li key={ind.indicator} className="flex items-start gap-3 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-foreground">{ind.indicator}</span>
                <a
                  href={ind.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-medium text-emerald-500 hover:text-emerald-400 whitespace-nowrap"
                >
                  {ind.source}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Frameworks */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="h-5 w-5 text-emerald-500" />
          <h3 className="text-lg font-semibold text-foreground">Authoritative frameworks</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {FRAMEWORK_SOURCES.map((f) => (
            <a
              key={f.org}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-surface-border text-xs font-medium text-foreground hover:border-emerald-500/40"
            >
              {f.title} <ExternalLink className="h-3 w-3 text-text-muted" />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
