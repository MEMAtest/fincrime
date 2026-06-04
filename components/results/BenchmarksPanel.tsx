"use client";

import { BarChart3, TrendingUp } from "lucide-react";
import BarChart from "@/components/charts/BarChart";
import { enforcementBenchmarks } from "@/lib/enforcement/select";
import { THEME_CONFIG } from "@/components/icons/RiskThemeIcon";
import type { RiskTheme } from "@/data/typologies/types";

function fmtGbp(n: number): string {
  if (n >= 1_000_000_000) return `£${(n / 1_000_000_000).toFixed(1)}bn`;
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(0)}m`;
  if (n >= 1_000) return `£${Math.round(n / 1_000)}k`;
  return `£${n}`;
}

export default function BenchmarksPanel() {
  const b = enforcementBenchmarks;

  const themeBars = b.byRiskTheme.map((t) => ({
    label: THEME_CONFIG[t.theme as RiskTheme]?.label ?? t.theme,
    value: t.count,
    color: THEME_CONFIG[t.theme as RiskTheme]?.glow,
  }));

  const yearBars = b.byYear
    .filter((y) => y.totalGbp > 0)
    .slice(-8)
    .map((y) => ({ label: String(y.year), value: y.totalGbp }));

  const stats = [
    { label: "Enforcement cases", value: String(b.totalCases) },
    { label: "Total penalties", value: fmtGbp(b.fineStats.totalGbp) },
    { label: "Median fine", value: fmtGbp(b.fineStats.medianGbp) },
    { label: "Largest", value: fmtGbp(b.fineStats.maxGbp) },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="glass-card rounded-xl p-4">
            <div className="text-2xl font-bold text-foreground leading-none">{s.value}</div>
            <div className="text-xs text-text-muted mt-1.5">{s.label}</div>
          </div>
        ))}
      </div>

      <section className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 className="h-5 w-5 text-emerald-500" />
          <h3 className="text-base font-semibold text-foreground">
            Financial-crime enforcement by risk theme
          </h3>
        </div>
        <BarChart data={themeBars} />
      </section>

      {yearBars.length > 1 ? (
        <section className="glass-card rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <h3 className="text-base font-semibold text-foreground">
              Total penalties by year
            </h3>
          </div>
          <BarChart data={yearBars} format={fmtGbp} />
        </section>
      ) : null}

      <p className="text-xs text-text-muted">
        Source: {b.source} · as at {b.generatedAt}. Aggregates cover{" "}
        {b.totalCases} tagged financial-crime cases.
      </p>
    </div>
  );
}
