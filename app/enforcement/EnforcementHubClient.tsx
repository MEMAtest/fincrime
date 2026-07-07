"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import RiskThemeIcon, { THEME_CONFIG } from "@/components/icons/RiskThemeIcon";
import { RISK_THEME_LABEL, FIRM_TYPE_LABEL } from "@/data/typologies/labels";
import { enforcementCases } from "@/data/enforcement/cases";
import { lessonFor } from "@/data/enforcement/lessons";
import { effectiveFirmTypes, fmtGbp } from "@/lib/enforcement/select";
import { caseSlug } from "@/lib/enforcement/case-slug";
import ToolPageHeader from "@/components/shared/ToolPageHeader";
import DonutChart from "@/components/charts/DonutChart";
import { controlsForCase } from "@/data/controls";
import type { RiskTheme, FirmType } from "@/data/typologies/types";

const ALL_THEMES: RiskTheme[] = [
  "money_laundering", "fraud", "sanctions_evasion", "terrorist_financing",
  "bribery_corruption", "proliferation_financing", "tax_evasion",
];

// Every firm type that actually has tagged cases (so no filter is a dead end).
const FIRM_FILTERS: FirmType[] = (Object.keys(FIRM_TYPE_LABEL) as FirmType[]).filter(
  (ft) => enforcementCases.some((c) => effectiveFirmTypes(c).includes(ft))
);

const sorted = [...enforcementCases].sort((a, b) => b.amountGbp - a.amountGbp);

export default function EnforcementHubClient() {
  const [theme, setTheme] = useState<RiskTheme | null>(null);
  const [firm, setFirm] = useState<FirmType | null>(null);
  const [visible, setVisible] = useState(12);

  const pickTheme = (t: RiskTheme | null) => { setTheme(t); setVisible(12); };
  const pickFirm = (f: FirmType | null) => { setFirm(f); setVisible(12); };

  const cases = useMemo(
    () =>
      sorted.filter((c) => {
        if (theme && !c.riskThemes.includes(theme)) return false;
        if (firm && !effectiveFirmTypes(c).includes(firm)) return false;
        return true;
      }),
    [theme, firm]
  );

  // KPIs reflect the active filter so the headline numbers move with the chips.
  const kpis = useMemo(() => {
    const amounts = cases.map((c) => c.amountGbp);
    const total = amounts.reduce((s, n) => s + n, 0);
    const sortedAmts = [...amounts].sort((a, b) => a - b);
    const mid = Math.floor(sortedAmts.length / 2);
    const median = sortedAmts.length === 0
      ? 0
      : sortedAmts.length % 2
        ? sortedAmts[mid]
        : Math.round((sortedAmts[mid - 1] + sortedAmts[mid]) / 2);
    const max = amounts.length ? Math.max(...amounts) : 0;
    return { count: cases.length, total, median, max };
  }, [cases]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <ToolPageHeader
        eyebrow="04 · ENFORCEMENT TRACKER"
        title="What failed,"
        titleAccent="and the fix"
        subtitle="Real FCA enforcement actions, each broken down into what went wrong and the financial crime controls that would have prevented it. Open a case to see the controls, then design them for your firm."
      />

      {/* KPI strip + theme breakdown donut */}
      <div className="glass-card rounded-2xl p-4 mb-8 flex flex-col sm:flex-row gap-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
          {[
            { label: "Enforcement cases", value: String(kpis.count) },
            { label: "Total penalties", value: fmtGbp(kpis.total) },
            { label: "Median fine", value: fmtGbp(kpis.median) },
            { label: "Largest", value: fmtGbp(kpis.max) },
          ].map((k) => (
            <div key={k.label} className="text-center">
              <div className="text-xl font-bold text-foreground tabular-nums">{k.value}</div>
              <div className="text-[11px] text-text-muted mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>
        {/* Theme distribution donut — always shows ALL cases as reference */}
        <div className="border-t sm:border-t-0 sm:border-l border-surface-border sm:pl-6 pt-4 sm:pt-0 shrink-0">
          <p className="text-[11px] uppercase tracking-wider text-text-muted mb-3">Theme mix (all cases)</p>
          <DonutChart
            size={100}
            thickness={16}
            centerLabel={String(sorted.length)}
            data={ALL_THEMES
              .map((t) => ({
                label: RISK_THEME_LABEL[t],
                value: sorted.filter((c) => c.riskThemes.includes(t)).length,
                color: THEME_CONFIG[t].glow,
              }))
              .filter((d) => d.value > 0)}
          />
        </div>
      </div>

      {/* Theme filter */}
      <div className="flex flex-wrap gap-2 mb-3">
        <FilterChip active={theme === null} onClick={() => pickTheme(null)}>All themes</FilterChip>
        {ALL_THEMES.map((t) => {
          const cfg = THEME_CONFIG[t];
          const active = theme === t;
          return (
            <button
              key={t}
              onClick={() => pickTheme(active ? null : t)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all cursor-pointer ${
                active ? "" : "glass-card text-text-muted hover:text-foreground"
              }`}
              style={active ? { backgroundColor: `${cfg.glow}18`, borderColor: `${cfg.glow}70`, color: cfg.primary } : undefined}
            >
              <RiskThemeIcon riskTheme={t} size="sm" animated={false} /> {RISK_THEME_LABEL[t]}
            </button>
          );
        })}
      </div>

      {/* Firm filter */}
      <div className="flex flex-wrap gap-2 mb-8 items-center">
        <span className="text-[11px] uppercase tracking-wider text-text-muted mr-1">Firm type</span>
        <FilterChip active={firm === null} onClick={() => pickFirm(null)}>All</FilterChip>
        {FIRM_FILTERS.map((f) => (
          <FilterChip key={f} active={firm === f} onClick={() => pickFirm(firm === f ? null : f)}>
            {FIRM_TYPE_LABEL[f]}
          </FilterChip>
        ))}
      </div>

      {/* Cases */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-text-muted">Showing {Math.min(visible, cases.length)} of {cases.length} case{cases.length === 1 ? "" : "s"}, largest fines first</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cases.slice(0, visible).map((c) => {
          const lesson = lessonFor(c.firm, c.year);
          const nControls = controlsForCase(c.firm, c.year).length;
          return (
            <Link
              key={`${c.firm}-${c.year}`}
              href={`/enforcement/${caseSlug(c.firm, c.year)}`}
              className="glass-card rounded-xl p-4 card-hover flex flex-col h-full"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="text-sm font-semibold text-foreground leading-tight flex items-center gap-1">
                  <span>{c.firm}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                </h3>
                <span className="text-sm font-bold text-emerald-500 tabular-nums shrink-0">{c.fine}</span>
              </div>
              <p className="text-xs text-text-muted">{c.regulator} · {c.year}</p>
              <div className="flex flex-wrap gap-1 my-2">
                {c.riskThemes.map((t) => {
                  const cfg = THEME_CONFIG[t];
                  return (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${cfg.glow}20`, color: cfg.primary }}>
                      {RISK_THEME_LABEL[t]}
                    </span>
                  );
                })}
              </div>
              <p className="text-xs text-text-muted leading-relaxed line-clamp-3 flex-1">{lesson?.rootCause ?? c.summary}</p>
              {nControls > 0 && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-accent">
                  <ShieldCheck className="h-3.5 w-3.5" /> {nControls} control{nControls === 1 ? "" : "s"} mapped
                </p>
              )}
            </Link>
          );
        })}
      </div>

      {visible < cases.length && (
        <div className="mt-5 text-center">
          <button onClick={() => setVisible((v) => v + 12)} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg glass-card text-sm font-medium text-foreground hover:text-accent transition-colors">
            Show more ({cases.length - visible} remaining)
          </button>
        </div>
      )}

      {cases.length === 0 && (
        <div className="text-center py-20 text-text-muted">No cases match this filter.</div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
        active ? "bg-accent text-white" : "glass-card text-text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
