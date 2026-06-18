"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ArrowRight, ChevronDown, ChevronRight, AlertTriangle, Scale } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RiskThemeIcon from "@/components/icons/RiskThemeIcon";
import { THEME_CONFIG } from "@/components/icons/RiskThemeIcon";
import BenchmarksPanel from "@/components/results/BenchmarksPanel";
import SourceBadge from "@/components/shared/SourceBadge";
import { allTypologies } from "@/data/typologies";
import { lessonFor } from "@/data/enforcement/lessons";
import type { RiskTheme, FirmType, SourceOrg } from "@/data/typologies/types";

/* ── Enforcement actions ───────────────────────────── */

// "What would have caught this" now lives once in data/enforcement/lessons.ts
// (joined by firm + year); this array only carries the display fields.
interface EnforcementAction {
  firm: string;
  regulator: string;
  year: number;
  fine: string;
  summary: string;
  controlAreas: RiskTheme[];
}

const ENFORCEMENT_ACTIONS: EnforcementAction[] = [
  {
    firm: "Starling Bank",
    regulator: "FCA",
    year: 2024,
    fine: "£29m",
    summary: "AML screening failures: inadequate screening of sanctions lists and PEPs, with gaps in automated monitoring systems.",
    controlAreas: ["sanctions_evasion", "money_laundering"],
  },
  {
    firm: "Monzo",
    regulator: "FCA",
    year: 2024,
    fine: "Warning notice",
    summary: "AML failings: insufficient monitoring of customer transactions and delayed suspicious activity reporting.",
    controlAreas: ["money_laundering", "fraud"],
  },
  {
    firm: "NatWest",
    regulator: "FCA",
    year: 2021,
    fine: "£265m",
    summary: "Cash monitoring failures: failed to adequately monitor cash deposits in a commercial customer account, allowing £365m in suspicious cash deposits over 5 years.",
    controlAreas: ["money_laundering"],
  },
  {
    firm: "HSBC",
    regulator: "FCA",
    year: 2021,
    fine: "£64m",
    summary: "Transaction monitoring failures: deficient automated transaction monitoring across multiple business lines.",
    controlAreas: ["money_laundering", "terrorist_financing"],
  },
  {
    firm: "Metro Bank",
    regulator: "FCA",
    year: 2024,
    fine: "£16.7m",
    summary: "Transaction monitoring failure: an automated-system gap meant accounts opened from a certain date were not monitored for money-laundering risk, leaving tens of millions of transactions unmonitored.",
    controlAreas: ["money_laundering"],
  },
];

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

  const toggleTheme = (theme: RiskTheme) => {
    setExpandedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(theme)) next.delete(theme);
      else next.add(theme);
      return next;
    });
  };

  const frameworkOrg = orgForFramework(frameworkFilter);

  // Filter typologies by firm type and framework, then group by risk theme
  const grouped = useMemo(() => {
    const filtered = allTypologies.filter((t) => {
      const firmMatch = firmFilter === "all" || t.applicableFirmTypes.includes(firmFilter);
      const fwMatch = !frameworkOrg || t.sources.some((s) => s.org === frameworkOrg);
      return firmMatch && fwMatch;
    });

    const map = new Map<
      RiskTheme,
      {
        typologies: typeof filtered;
        detectionRules: { rule: string; source: string }[];
        governanceItems: { item: string; source: string }[];
        workflowSteps: { step: string; source: string }[];
        metrics: { metric: string; source: string }[];
        frameworkSources: { reference: string; title: string; url: string; source: string }[];
      }
    >();

    for (const theme of RISK_THEMES) {
      const themeTypologies = filtered.filter((t) => t.riskTheme === theme);
      if (themeTypologies.length === 0) continue;

      const detectionRules = themeTypologies.flatMap((t) =>
        t.detectionLogic.map((r) => ({ rule: `${r.name}: ${r.logic}`, source: t.title }))
      );
      const governanceItems = themeTypologies.flatMap((t) =>
        t.governanceChecklist.map((g) => ({ item: `${g.item} (${g.frequency})`, source: t.title }))
      );
      const workflowSteps = themeTypologies.flatMap((t) =>
        t.workflowSteps.map((w) => ({ step: `${w.title}: ${w.description}`, source: t.title }))
      );
      const metrics = themeTypologies.flatMap((t) =>
        t.metrics.map((m) => ({ metric: `${m.name} (target: ${m.target})`, source: t.title }))
      );

      // When a framework is selected, surface that standard's specific citations.
      const frameworkSources = frameworkOrg
        ? themeTypologies.flatMap((t) =>
            t.sources
              .filter((s) => s.org === frameworkOrg)
              .map((s) => ({ reference: s.reference, title: s.title, url: s.url, source: t.title }))
          )
        : [];

      map.set(theme, { typologies: themeTypologies, detectionRules, governanceItems, workflowSteps, metrics, frameworkSources });
    }

    return map;
  }, [firmFilter, frameworkOrg]);

  return (
    <>
      <Header />
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
                  {ENFORCEMENT_ACTIONS.map((action, i) => {
                    const prevented = lessonFor(action.firm, action.year)?.preventedBy ?? [];
                    return (
                    <div
                      key={i}
                      className="border border-surface-border rounded-xl p-5"
                    >
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <span className="text-base font-semibold text-foreground">
                          {action.firm}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-risk-high/10 text-risk-high font-medium">
                          {action.fine}
                        </span>
                        <span className="text-xs text-text-muted">
                          {action.regulator} {action.year}
                        </span>
                      </div>
                      <p className="text-sm text-text-muted mb-3">
                        {action.summary}
                      </p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {action.controlAreas.map((area) => (
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
                            {data.typologies.length} typolog
                            {data.typologies.length === 1 ? "y" : "ies"}
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
                      <div className="px-6 pb-6 space-y-6">
                        {/* Detection Rules */}
                        {data.detectionRules.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-foreground mb-2">
                              Detection Rules
                            </h3>
                            <ul className="space-y-2">
                              {data.detectionRules.map((r, i) => (
                                <li
                                  key={i}
                                  className="text-sm text-text-muted border-l-2 border-accent/30 pl-3"
                                >
                                  {r.rule}
                                  <span className="block text-xs text-accent/70 mt-0.5">
                                    Source: {r.source}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Governance Items */}
                        {data.governanceItems.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-foreground mb-2">
                              Governance Items
                            </h3>
                            <ul className="space-y-2">
                              {data.governanceItems.map((g, i) => (
                                <li
                                  key={i}
                                  className="text-sm text-text-muted border-l-2 border-accent/30 pl-3"
                                >
                                  {g.item}
                                  <span className="block text-xs text-accent/70 mt-0.5">
                                    Source: {g.source}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Workflow Steps */}
                        {data.workflowSteps.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-foreground mb-2">
                              Workflow Steps
                            </h3>
                            <ul className="space-y-2">
                              {data.workflowSteps.map((w, i) => (
                                <li
                                  key={i}
                                  className="text-sm text-text-muted border-l-2 border-accent/30 pl-3"
                                >
                                  {w.step}
                                  <span className="block text-xs text-accent/70 mt-0.5">
                                    Source: {w.source}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Effectiveness Metrics */}
                        {data.metrics.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-foreground mb-2">
                              Effectiveness Metrics
                            </h3>
                            <ul className="space-y-2">
                              {data.metrics.map((m, i) => (
                                <li
                                  key={i}
                                  className="text-sm text-text-muted border-l-2 border-accent/30 pl-3"
                                >
                                  {m.metric}
                                  <span className="block text-xs text-accent/70 mt-0.5">
                                    Source: {m.source}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Framework references (when a framework filter is active) */}
                        {frameworkOrg && data.frameworkSources.length > 0 && (
                          <div>
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
      <Footer />
    </>
  );
}
