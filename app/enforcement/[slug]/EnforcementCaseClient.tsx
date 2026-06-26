"use client";

import Link from "next/link";
import { Scale, AlertTriangle, ShieldCheck, Wrench, Layers, BookOpen } from "lucide-react";
import ReferenceLink from "@/components/shared/ReferenceLink";
import ControlSummaryCard from "@/components/controls/ControlSummaryCard";
import NextSteps from "@/components/shared/NextSteps";
import RiskThemeIcon, { THEME_CONFIG } from "@/components/icons/RiskThemeIcon";
import { RISK_THEME_LABEL } from "@/data/typologies/labels";
import type { EnforcementCase } from "@/data/enforcement/types";
import type { Control } from "@/data/controls/types";

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
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/enforcement" className="flex items-center gap-1.5 text-sm text-text-muted hover:text-accent transition-colors mb-6 w-fit">
        <Scale className="h-4 w-4" /> All enforcement cases
      </Link>

      {/* Header */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{c.firm}</h1>
            <p className="text-sm text-text-muted mt-1">{c.regulator} enforcement action, {c.year}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-3xl font-bold text-emerald-500 tabular-nums">{c.fine}</div>
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
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500 hover:text-emerald-400"
              showIcon
            />
          ) : null}
        </div>
      </section>

      {/* What would have caught it */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
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
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
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
