"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Scale, AlertTriangle, ShieldCheck, Wrench, Layers, BookOpen, TrendingUp } from "lucide-react";
import ReferenceLink from "@/components/shared/ReferenceLink";
import ControlSummaryCard from "@/components/controls/ControlSummaryCard";
import NextSteps from "@/components/shared/NextSteps";
import RiskThemeIcon, { THEME_CONFIG } from "@/components/icons/RiskThemeIcon";
import { RISK_THEME_LABEL } from "@/data/typologies/labels";
import { enforcementCases } from "@/data/enforcement/cases";
import { fmtGbp, effectiveFirmTypes } from "@/lib/enforcement/select";
import { caseSlug } from "@/lib/enforcement/case-slug";
import type { EnforcementCase } from "@/data/enforcement/types";
import type { Control } from "@/data/controls/types";

function computePercentile(c: EnforcementCase) {
  const amounts = enforcementCases.map((x) => x.amountGbp).sort((a, b) => a - b);
  const mid = Math.floor(amounts.length / 2);
  const median = amounts.length % 2
    ? amounts[mid]
    : Math.round((amounts[mid - 1] + amounts[mid]) / 2);
  // Rank 1 = largest fine
  const sortedDesc = [...enforcementCases].sort((a, b) => b.amountGbp - a.amountGbp);
  const rank = sortedDesc.findIndex((x) => x.firm === c.firm && x.year === c.year) + 1;
  const topPct = Math.round((rank / sortedDesc.length) * 100);
  const medianX = median > 0 ? +(c.amountGbp / median).toFixed(1) : null;
  return { rank, total: sortedDesc.length, topPct, medianX };
}

export default function EnforcementCaseClient({
  caseData: c,
  rootCause,
  preventedBy,
  controls,
  isDirect,
  cSlug,
}: {
  caseData: EnforcementCase;
  rootCause: string;
  preventedBy: string[];
  controls: Control[];
  isDirect: boolean;
  cSlug: string;
}) {
  const { rank, total, topPct, medianX } = useMemo(() => computePercentile(c), [c]);

  const relatedCases = useMemo(() => {
    return enforcementCases
      .filter((x) => !(x.firm === c.firm && x.year === c.year))
      .filter((x) => x.riskThemes.some((t) => c.riskThemes.includes(t)))
      .sort((a, b) => b.amountGbp - a.amountGbp)
      .slice(0, 3);
  }, [c]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/enforcement" className="flex items-center gap-1.5 text-sm text-text-muted hover:text-accent transition-colors mb-6 w-fit">
        <Scale className="h-4 w-4" /> All enforcement cases
      </Link>

      {/* Header */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{c.firm}</h1>
            <p className="text-sm text-text-muted mt-1">{c.regulator} enforcement action, {c.year}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-3xl font-bold text-accent tabular-nums">{c.fine}</div>
            <div className="text-[11px] text-text-muted">financial penalty</div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {c.riskThemes.map((t) => {
            const cfg = THEME_CONFIG[t];
            return (
              <span key={t} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: `${cfg.glow}1f`, color: cfg.primary }}>
                <RiskThemeIcon riskTheme={t} size="sm" animated={false} /> {RISK_THEME_LABEL[t]}
              </span>
            );
          })}
          {c.breachCategories.map((b) => (
            <span key={b} className="inline-flex items-center px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03] text-[11px] text-text-muted">{b}</span>
          ))}
        </div>
      </div>

      {/* Where this fine sits */}
      <div className="glass-card rounded-xl p-4 mb-8">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-accent" />
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Where this fine sits</span>
        </div>
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <div className="text-[11px] text-text-muted mb-0.5">Rank (largest first)</div>
            <div className="text-xl font-bold text-foreground tabular-nums">#{rank} of {total}</div>
          </div>
          <div className="w-px h-8 bg-line-2 hidden sm:block" />
          <div>
            <div className="text-[11px] text-text-muted mb-0.5">Top percentile</div>
            <div className="text-xl font-bold text-foreground tabular-nums">
              {topPct <= 5 ? "Top 5%" : topPct <= 10 ? "Top 10%" : topPct <= 25 ? "Top 25%" : topPct <= 50 ? "Top 50%" : "Below median"}
            </div>
          </div>
          {medianX !== null && (
            <>
              <div className="w-px h-8 bg-line-2 hidden sm:block" />
              <div>
                <div className="text-[11px] text-text-muted mb-0.5">vs. median fine</div>
                <div className="text-xl font-bold text-foreground tabular-nums">{medianX}x</div>
              </div>
            </>
          )}
          <div className="flex-1 min-w-[120px]">
            <div className="h-1.5 rounded-full bg-line-2 overflow-hidden mt-1">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${Math.max(4, 100 - topPct + 5)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-text-muted mt-1">
              <span>smallest</span><span>largest</span>
            </div>
          </div>
        </div>
      </div>

      {/* What failed */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-risk-high" />
          <h2 className="text-lg font-semibold text-foreground">What failed</h2>
        </div>
        <div className="glass-card rounded-xl p-5">
          <p className="text-sm text-foreground leading-relaxed">{rootCause}</p>
          {c.sourceUrl ? (
            <ReferenceLink
              url={c.sourceUrl}
              label="Read the final notice"
              heading={`${c.firm} (${c.regulator} ${c.year})`}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover"
              showIcon
            />
          ) : null}
        </div>
      </section>

      {/* What would have caught it */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold text-foreground">The controls that would have caught it</h2>
        </div>
        <p className="text-sm text-text-muted mb-4 max-w-3xl">
          {isDirect
            ? "These controls map directly to this failure. Open any one in the Control Builder to set your own thresholds, owners and systems, then export an implementation-ready spec."
            : "This case has no bespoke control mapping yet, so the controls below are drawn from its risk themes. Open any one in the Control Builder to adapt it to your firm."}
        </p>

        {preventedBy.length > 0 && (
          <div className="glass-card rounded-xl p-4 mb-4">
            <p className="text-[11px] uppercase tracking-wider text-text-muted mb-2">In short, the firm needed</p>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {preventedBy.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {controls.map((control) => (
            <ControlSummaryCard
              key={control.slug}
              control={control}
              buildHref={`/control-builder?control=${control.slug}&case=${cSlug}`}
            />
          ))}
        </div>

        {controls.length > 0 && (
          <div className="mt-5">
            <Link
              href={`/control-builder?from=case:${cSlug}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors"
            >
              <Wrench className="h-4 w-4" /> Design all {controls.length} controls in the builder
            </Link>
          </div>
        )}
      </section>

      {/* Explore typologies behind this case */}
      {c.riskThemes.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold text-foreground mb-3">Typologies behind this case</h2>
          <div className="flex flex-wrap gap-2">
            {c.riskThemes.map((t) => {
              const cfg = THEME_CONFIG[t];
              return (
                <Link
                  key={t}
                  href={`/typology-iq/list?theme=${t}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105"
                  style={{ backgroundColor: `${cfg.glow}18`, borderColor: `${cfg.glow}50`, color: cfg.primary, border: `1px solid ${cfg.glow}50` }}
                >
                  <RiskThemeIcon riskTheme={t} size="sm" animated={false} />
                  {RISK_THEME_LABEL[t]} typologies
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Related cases */}
      {relatedCases.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold text-foreground mb-3">Related enforcement cases</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {relatedCases.map((rel) => (
              <Link
                key={`${rel.firm}-${rel.year}`}
                href={`/enforcement/${caseSlug(rel.firm, rel.year)}`}
                className="glass-card rounded-xl p-4 card-hover block"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2">{rel.firm}</p>
                  <span className="text-sm font-bold text-accent tabular-nums shrink-0">{rel.fine}</span>
                </div>
                <p className="text-xs text-text-muted">{rel.regulator} · {rel.year}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {rel.riskThemes.filter((t) => c.riskThemes.includes(t)).map((t) => {
                    const cfg = THEME_CONFIG[t];
                    return (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${cfg.glow}20`, color: cfg.primary }}>
                        {RISK_THEME_LABEL[t]}
                      </span>
                    );
                  })}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <NextSteps
        items={[
          { title: "Build these controls", body: "Adapt the controls to your firm and export a register.", href: `/control-builder?from=case:${cSlug}`, icon: Wrench },
          { title: "Browse all enforcement", body: "Every FCA case, what failed and the controls that address it.", href: "/enforcement", icon: Scale },
          { title: "Explore the typologies", body: "The financial crime patterns behind this case.", href: "/typology-iq/list", icon: Layers },
        ]}
      />

      <p className="mt-10 text-xs text-text-muted border-t border-surface-border pt-4 flex items-start gap-2">
        <BookOpen className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        Enforcement data is sourced from the FCA fines dataset. The control mapping is an analyst view of what
        would have addressed the failings described in the public notice, not a statement of the regulator{"'"}s findings.
      </p>
    </div>
  );
}
