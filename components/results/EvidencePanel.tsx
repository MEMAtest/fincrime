"use client";

import { useState } from "react";
import { Scale, ListChecks, BookOpen, ShieldCheck, ChevronDown } from "lucide-react";
import { casesForThemes, fmtGbp, totalPenaltiesForThemes, countCasesForThemes } from "@/lib/enforcement/select";
import { lessonFor } from "@/data/enforcement/lessons";
import { INDICATORS_BY_THEME, FRAMEWORK_SOURCES } from "@/data/sources";
import { THEME_CONFIG } from "@/components/icons/RiskThemeIcon";
import ReferenceLink from "@/components/shared/ReferenceLink";
import type { RiskTheme, Typology } from "@/data/typologies/types";

export default function EvidencePanel({ themes, typology }: { themes: RiskTheme[]; typology?: Typology }) {
  const [showAll, setShowAll] = useState(false);
  const cases = casesForThemes(themes, 12);
  const visible = showAll ? cases : cases.slice(0, 6);
  const totalPenalties = totalPenaltiesForThemes(themes);
  const matchedCount = countCasesForThemes(themes);
  const themeLabel = themes.map((t) => THEME_CONFIG[t]?.label ?? t).join(", ") || "financial crime";

  // Fallback "what would have caught this" when a case has no bespoke lesson:
  // controls drawn from the matched typology (if one was passed in).
  const fallbackControls = typology ? typology.detectionLogic.slice(0, 3).map((r) => r.name) : [];

  // De-duplicate cited indicators across the selected themes
  const seen = new Set<string>();
  const indicators = themes
    .flatMap((t) => INDICATORS_BY_THEME[t] ?? [])
    .filter((i) => (seen.has(i.indicator) ? false : (seen.add(i.indicator), true)));

  return (
    <div className="space-y-8">
      {/* Real enforcement cases */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Scale className="h-5 w-5 text-emerald-500" />
          <h3 className="text-lg font-semibold text-foreground">Real enforcement: what failure costs</h3>
        </div>
        {totalPenalties > 0 && (
          <p className="text-sm text-text-muted mb-4">
            UK regulators have fined firms <span className="font-semibold text-emerald-500">{fmtGbp(totalPenalties)}</span> across the cases tagged to {themeLabel}.
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          {visible.map((c) => {
            const lesson = lessonFor(c.firm, c.year);
            const controls = lesson?.preventedBy ?? fallbackControls;
            return (
              <div key={`${c.firm}-${c.year}`} className="glass-card rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="font-semibold text-foreground leading-tight">{c.firm}</div>
                    <div className="text-xs text-text-muted">
                      {c.regulator} · {c.year}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-emerald-500 tabular-nums">{c.fine}</span>
                </div>
                <p className="text-sm text-text-muted leading-relaxed">{lesson?.rootCause ?? c.summary}</p>

                {controls.length > 0 && (
                  <div className="mt-3 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-500 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {lesson ? "What would have caught this" : "Controls in this typology that address this"}
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {controls.map((ctrl, j) => (
                        <li key={j} className="text-xs text-text-muted flex gap-1.5">
                          <span className="mt-1.5 h-1 w-1 rounded-full bg-emerald-400 shrink-0" />
                          <span>{ctrl}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {c.sourceUrl ? (
                  <ReferenceLink
                    url={c.sourceUrl}
                    label="Final notice"
                    heading={`${c.firm} (${c.regulator} ${c.year})`}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500 hover:text-emerald-400"
                    showIcon
                  />
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-text-muted">
            Source: FCA fines dataset (regactions.com). Showing {visible.length} of {matchedCount} cases tagged to {themeLabel}.
          </p>
          {cases.length > 6 && (
            <button
              onClick={() => setShowAll((s) => !s)}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500 hover:text-emerald-400 cursor-pointer"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} />
              {showAll ? "Show fewer" : `Show ${cases.length - 6} more`}
            </button>
          )}
        </div>
      </section>

      {/* Cited red-flag indicators */}
      {indicators.length > 0 ? (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <ListChecks className="h-5 w-5 text-emerald-500" />
            <h3 className="text-lg font-semibold text-foreground">Red-flag indicators, cited</h3>
          </div>
          <ul className="space-y-2.5">
            {indicators.map((ind) => (
              <li key={ind.indicator} className="flex items-start gap-3 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-foreground">{ind.indicator}</span>
                <ReferenceLink
                  url={ind.url}
                  label={ind.source}
                  heading={ind.indicator}
                  className="shrink-0 text-xs font-medium text-emerald-500 hover:text-emerald-400 whitespace-nowrap"
                />
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
            <ReferenceLink
              key={f.org}
              url={f.url}
              label={f.title}
              heading={f.title}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-surface-border text-xs font-medium text-foreground hover:border-emerald-500/40"
              showIcon
            />
          ))}
        </div>
      </section>
    </div>
  );
}
