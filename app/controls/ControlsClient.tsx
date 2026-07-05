"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ArrowRight, ArrowUpRight, ChevronDown, ChevronRight, AlertTriangle, Scale, Wrench } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import RiskThemeIcon from "@/components/icons/RiskThemeIcon";
import { THEME_CONFIG } from "@/components/icons/RiskThemeIcon";
import BenchmarksPanel from "@/components/results/BenchmarksPanel";
import SourceBadge from "@/components/shared/SourceBadge";
import ControlDetailModal from "@/components/controls/ControlDetailModal";
import { controlsForThemes, CONTROL_CATEGORY_LABEL, CONTROL_TYPE_LABEL } from "@/data/controls";
import { lessonFor } from "@/data/enforcement/lessons";
import { enforcementCases } from "@/data/enforcement/cases";
import { caseSlug } from "@/lib/enforcement/case-slug";
import type { RiskTheme, FirmType, SourceOrg } from "@/data/typologies/types";

/* ── Enforcement actions ───────────────────────────── */

// The five largest FCA fines, taken from the canonical dataset
// (data/enforcement/cases.ts) so this panel can never drift from /enforcement or
// show an uncited/incorrect figure. "What would have caught this" is joined from
// data/enforcement/lessons.ts by firm + year.
const TOP_ENFORCEMENT = [...enforcementCases].sort((a, b) => b.amountGbp - a.amountGbp).slice(0, 5);

/* ── Firm type labels ──────────────────────────────── */

const FIRM_TYPES: { value: FirmType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "emi", label: "EMI" },
  { value: "pi", label: "PI" },
  { value: "bank", label: "Bank" },
  { value: "msb", label: "MSB" },
  { value: "crypto", label: "Crypto" },
  { value: "neobank", label: "Neobank" },
  { value: "wealth_manager", label: "Wealth Mgr" },
  { value: "insurance", label: "Insurance" },
];

const RISK_THEMES: RiskTheme[] = [
  "terrorist_financing",
  "money_laundering",
  "sanctions_evasion",
  "fraud",
  "tax_evasion",
  "bribery_corruption",
  "proliferation_financing",
];

/* ── Framework filter ──────────────────────────────── */

type FrameworkFilter = "all" | "fatf" | "wolfsberg" | "fca" | "jmlsg";

const FRAMEWORK_OPTIONS: { value: FrameworkFilter; label: string; org?: SourceOrg }[] = [
  { value: "all", label: "All frameworks" },
  { value: "fatf", label: "FATF", org: "FATF" },
  { value: "wolfsberg", label: "Wolfsberg", org: "Wolfsberg" },
  { value: "fca", label: "FCA", org: "FCA" },
  { value: "jmlsg", label: "JMLSG", org: "JMLSG" },
];

const orgForFramework = (f: FrameworkFilter): SourceOrg | null =>
  FRAMEWORK_OPTIONS.find((o) => o.value === f)?.org ?? null;

/* ── Page component ────────────────────────────────── */

export default function ControlsClient({ initialFramework, initialFirmType }: { initialFramework: string; initialFirmType?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  // Framework filter is URL-driven (server passes the ?framework= value), so the
  // page server-renders and footer /controls?framework=fca links update it.
  const fwParam = initialFramework.toLowerCase();
  const frameworkFilter: FrameworkFilter = FRAMEWORK_OPTIONS.some((o) => o.value === fwParam)
    ? (fwParam as FrameworkFilter)
    : "all";

  const setFrameworkFilter = (f: FrameworkFilter) => {
    router.replace(f === "all" ? pathname : `${pathname}?framework=${f}`, { scroll: false });
  };

  const [firmFilter, setFirmFilter] = useState<FirmType | "all">(
    FIRM_TYPES.some((f) => f.value === initialFirmType) ? (initialFirmType as FirmType) : "all"
  );
  const [enforcementOpen, setEnforcementOpen] = useState(false);
  const [expandedThemes, setExpandedThemes] = useState<Set<RiskTheme>>(new Set());
  const [openControl, setOpenControl] = useState<string | null>(null);

  const toggleTheme = (theme: RiskTheme) => {
    setExpandedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(theme)) next.delete(theme);
      else next.add(theme);
      return next;
    });
  };

  const frameworkOrg = orgForFramework(frameworkFilter);

  // Group the real control catalogue by risk theme, filtered by firm type and
  // framework. Each theme lists the controls that address it as compact rows
  // that open the full control specification in a modal (no navigation away, no
  // flattened rule wall).
  const grouped = useMemo(() => {
    const map = new Map<
      RiskTheme,
      {
        controls: ReturnType<typeof controlsForThemes>;
        frameworkSources: { reference: string; title: string; url: string; source: string }[];
      }
    >();

    for (const theme of RISK_THEMES) {
      let controls = controlsForThemes([theme]);
      if (firmFilter !== "all") controls = controls.filter((c) => c.applicableFirmTypes.includes(firmFilter));
      if (frameworkOrg) controls = controls.filter((c) => c.sources.some((s) => s.org === frameworkOrg));
      if (controls.length === 0) continue;

      // When a framework is selected, surface that standard's specific citations.
      const frameworkSources = frameworkOrg
        ? controls.flatMap((c) =>
            c.sources
              .filter((s) => s.org === frameworkOrg)
              .map((s) => ({ reference: s.reference, title: s.title, url: s.url, source: c.name }))
          )
        : [];

      map.set(theme, { controls, frameworkSources });
    }

    return map;
  }, [firmFilter, frameworkOrg]);

  return (
    <ToolFrame>
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden py-16 sm:py-20">
          <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                Controls Reference{" "}
                <span className="gradient-text">Library</span>
              </h1>
              <p className="mt-4 text-lg text-text-muted max-w-2xl mx-auto">
                Browse the financial crime controls your firm needs, grouped by
                risk theme, filtered by firm type and framework, and mapped to
                real enforcement actions.
              </p>
              <p className="mt-3 text-sm text-text-muted max-w-2xl mx-auto">
                This is the reference catalogue. To adapt controls to your firm and export a register, use the{" "}
                <Link href="/control-builder" className="text-accent hover:underline">Control Builder</Link>.
              </p>
              <div className="mt-5 flex justify-center">
                <Link href="/control-builder" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors">
                  <Wrench className="h-4 w-4" /> Build a control register
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-20 sm:pb-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Firm type filter */}
            <div role="group" aria-label="Filter by firm type" className="flex flex-wrap gap-2 mb-4 justify-center">
              {FIRM_TYPES.map((ft) => (
                <button
                  key={ft.value}
                  onClick={() => setFirmFilter(ft.value)}
                  aria-pressed={firmFilter === ft.value}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    firmFilter === ft.value
                      ? "bg-accent text-white"
                      : "bg-white/5 text-text-muted hover:bg-white/10 border border-surface-border"
                  }`}
                >
                  {ft.label}
                </button>
              ))}
            </div>

            {/* Framework filter */}
            <div role="group" aria-label="Filter by framework" className="flex flex-wrap gap-2 mb-6 justify-center">
              {FRAMEWORK_OPTIONS.map((fw) => (
                <button
                  key={fw.value}
                  onClick={() => setFrameworkFilter(fw.value)}
                  aria-pressed={frameworkFilter === fw.value}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    frameworkFilter === fw.value
                      ? "bg-foreground text-background"
                      : "bg-white/5 text-text-muted hover:bg-white/10 border border-surface-border"
                  }`}
                >
                  {fw.label}
                </button>
              ))}
            </div>

            {/* Framework banner */}
            {frameworkOrg && (
              <div className="glass-card rounded-xl px-5 py-4 mb-10 flex flex-wrap items-center gap-3">
                <Scale className="h-5 w-5 text-accent shrink-0" />
                <p className="text-sm text-text-muted">
                  Showing controls mapped to{" "}
                  <span className="font-semibold text-foreground">{frameworkOrg}</span>. Most
                  typologies map to several frameworks, so each view differs mainly by the cited
                  standard shown under each risk theme.
                </p>
              </div>
            )}

            {/* Enforcement Actions */}
            <div className="glass-card rounded-2xl mb-10 overflow-hidden">
              <button
                onClick={() => setEnforcementOpen(!enforcementOpen)}
                aria-expanded={enforcementOpen}
                className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-risk-high" />
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Enforcement Actions
                    </h2>
                    <p className="text-sm text-text-muted">
                      Real FCA fines and what controls would have prevented them
                    </p>
                  </div>
                </div>
                {enforcementOpen ? (
                  <ChevronDown className="h-5 w-5 text-text-muted" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-text-muted" />
                )}
              </button>

              {enforcementOpen && (
                <div className="px-6 pb-6 space-y-6">
                  {TOP_ENFORCEMENT.map((c) => {
                    const lesson = lessonFor(c.firm, c.year);
                    const prevented = lesson?.preventedBy ?? [];
                    return (
                    <div
                      key={`${c.firm}-${c.year}`}
                      className="border border-surface-border rounded-xl p-5"
                    >
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <span className="text-base font-semibold text-foreground">
                          {c.firm}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-risk-high/10 text-risk-high font-medium">
                          {c.fine}
                        </span>
                        <span className="text-xs text-text-muted">
                          {c.regulator} {c.year}
                        </span>
                      </div>
                      <p className="text-sm text-text-muted mb-3">
                        {lesson?.rootCause ?? c.summary}
                      </p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {c.riskThemes.map((area) => (
                          <span
                            key={area}
                            className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent"
                          >
                            {THEME_CONFIG[area].label}
                          </span>
                        ))}
                      </div>
                      {prevented.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                            <Scale className="h-3.5 w-3.5 text-accent" />
                            Controls that would have prevented this:
                          </p>
                          <ul className="space-y-1">
                            {prevented.map((ctrl, j) => (
                              <li
                                key={j}
                                className="text-xs text-text-muted pl-4 relative before:content-[''] before:absolute before:left-1.5 before:top-[7px] before:w-1 before:h-1 before:rounded-full before:bg-accent"
                              >
                                {ctrl}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <Link href={`/enforcement/${caseSlug(c.firm, c.year)}`} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
                        Read the case and cited notice <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Controls by Risk Theme */}
            <h2 className="text-xl font-semibold text-foreground mb-6">
              Controls by Risk Theme
            </h2>

            <div className="space-y-4">
              {RISK_THEMES.map((theme) => {
                const data = grouped.get(theme);
                if (!data) return null;
                const isOpen = expandedThemes.has(theme);

                return (
                  <div
                    key={theme}
                    className="glass-card rounded-2xl overflow-hidden"
                  >
                    <button
                      onClick={() => toggleTheme(theme)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-surface-hover transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <RiskThemeIcon
                          riskTheme={theme}
                          size="sm"
                          animated={false}
                        />
                        <div>
                          <span className="text-base font-semibold text-foreground">
                            {THEME_CONFIG[theme].label}
                          </span>
                          <span className="ml-2 text-xs text-text-muted">
                            {data.controls.length} control{data.controls.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                      {isOpen ? (
                        <ChevronDown className="h-5 w-5 text-text-muted" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-text-muted" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="px-6 pb-6 space-y-3">
                        <p className="text-sm text-text-muted">
                          Click a control to open its full specification: objective, threshold and rationale,
                          owners, systems, test plan and cited sources.
                        </p>
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          {data.controls.map((c) => (
                            <button
                              key={c.slug}
                              onClick={() => setOpenControl(c.slug)}
                              className="text-left glass-card rounded-xl p-4 card-hover cursor-pointer h-full flex flex-col"
                            >
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <h4 className="text-sm font-semibold text-foreground leading-tight flex items-center gap-1">
                                  <span>{c.name}</span>
                                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                                </h4>
                              </div>
                              <p className="text-xs text-text-muted leading-relaxed line-clamp-2 flex-1">
                                {c.plainSummary}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/5 text-text-muted border border-surface-border">
                                  {CONTROL_CATEGORY_LABEL[c.category]}
                                </span>
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                                  {CONTROL_TYPE_LABEL[c.controlType]}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>

                        {/* Framework references (when a framework filter is active) */}
                        {frameworkOrg && data.frameworkSources.length > 0 && (
                          <div className="pt-2">
                            <h3 className="text-sm font-semibold text-foreground mb-2">
                              {frameworkOrg} references
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {data.frameworkSources.map((s, i) => (
                                <SourceBadge
                                  key={`${s.reference}-${i}`}
                                  source={frameworkOrg}
                                  reference={s.reference}
                                  url={s.url}
                                  title={s.title}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Enforcement benchmarks */}
            <div className="mt-16">
              <h2 className="text-xl font-bold text-foreground mb-1">
                Enforcement benchmarks
              </h2>
              <p className="text-sm text-text-muted mb-6">
                Where real financial-crime penalties have landed, grounded in the
                FCA fines dataset, so you can prioritise the controls that matter.
              </p>
              <BenchmarksPanel firmFilter={firmFilter} />
            </div>

            {/* CTA */}
            <div className="mt-14 text-center">
              <Link
                href="/typology-iq"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent-hover transition-colors"
              >
                Get a tailored control framework
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <ControlDetailModal slug={openControl} onClose={() => setOpenControl(null)} />
    </ToolFrame>
  );
}
