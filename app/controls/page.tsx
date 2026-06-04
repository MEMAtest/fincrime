"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronRight, AlertTriangle, Scale } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import RiskThemeIcon from "@/components/icons/RiskThemeIcon";
import { THEME_CONFIG } from "@/components/icons/RiskThemeIcon";
import BenchmarksPanel from "@/components/results/BenchmarksPanel";
import { allTypologies } from "@/data/typologies";
import type { RiskTheme, FirmType } from "@/data/typologies/types";

/* ── Enforcement actions ───────────────────────────── */

interface EnforcementAction {
  firm: string;
  regulator: string;
  year: number;
  fine: string;
  summary: string;
  controlAreas: RiskTheme[];
  preventedBy: string[];
}

const ENFORCEMENT_ACTIONS: EnforcementAction[] = [
  {
    firm: "Starling Bank",
    regulator: "FCA",
    year: 2024,
    fine: "£29m",
    summary: "AML screening failures — inadequate screening of sanctions lists and PEPs, with gaps in automated monitoring systems.",
    controlAreas: ["sanctions_evasion", "money_laundering"],
    preventedBy: [
      "Automated sanctions screening on all transactions",
      "PEP identification and enhanced due diligence",
      "Regular screening system effectiveness reviews",
      "Independent model validation of screening calibration",
    ],
  },
  {
    firm: "Monzo",
    regulator: "FCA",
    year: 2024,
    fine: "Warning notice",
    summary: "AML failings — insufficient monitoring of customer transactions and delayed suspicious activity reporting.",
    controlAreas: ["money_laundering", "fraud"],
    preventedBy: [
      "Real-time transaction monitoring with tuned thresholds",
      "Timely SAR submission workflows",
      "Adequate staffing for financial crime operations",
      "Board-level MI on AML control effectiveness",
    ],
  },
  {
    firm: "NatWest",
    regulator: "FCA",
    year: 2021,
    fine: "£265m",
    summary: "Cash monitoring failures — failed to adequately monitor cash deposits in a commercial customer account, allowing £365m in suspicious cash deposits over 5 years.",
    controlAreas: ["money_laundering"],
    preventedBy: [
      "Cash deposit anomaly detection rules",
      "Customer activity vs. expected profile monitoring",
      "Enhanced due diligence triggers on cash-intensive businesses",
      "Automated escalation for large cumulative cash deposits",
    ],
  },
  {
    firm: "HSBC",
    regulator: "FCA",
    year: 2021,
    fine: "£64m",
    summary: "Transaction monitoring failures — deficient automated transaction monitoring across multiple business lines.",
    controlAreas: ["money_laundering", "terrorist_financing"],
    preventedBy: [
      "Comprehensive transaction monitoring coverage",
      "Regular scenario tuning and gap analysis",
      "End-to-end data quality assurance",
      "Independent assurance over monitoring effectiveness",
    ],
  },
  {
    firm: "Metro Bank",
    regulator: "FCA",
    year: 2024,
    fine: "£16.7m",
    summary: "Transaction monitoring failure — an automated-system gap meant accounts opened from a certain date were not monitored for money-laundering risk, leaving tens of millions of transactions unmonitored.",
    controlAreas: ["money_laundering"],
    preventedBy: [
      "End-to-end coverage testing of automated transaction monitoring",
      "Controls to detect accounts excluded from monitoring",
      "Data-completeness reconciliation between onboarding and monitoring",
      "Independent assurance over monitoring coverage",
    ],
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

/* ── Page component ────────────────────────────────── */

export default function ControlsPage() {
  const [firmFilter, setFirmFilter] = useState<FirmType | "all">("all");
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

  // Filter typologies by firm type, then group by risk theme
  const grouped = useMemo(() => {
    const filtered =
      firmFilter === "all"
        ? allTypologies
        : allTypologies.filter((t) => t.applicableFirmTypes.includes(firmFilter));

    const map = new Map<
      RiskTheme,
      {
        typologies: typeof filtered;
        detectionRules: { rule: string; source: string }[];
        governanceItems: { item: string; source: string }[];
        workflowSteps: { step: string; source: string }[];
        metrics: { metric: string; source: string }[];
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
        t.metrics.map((m) => ({ metric: `${m.name} — target: ${m.target}`, source: t.title }))
      );

      map.set(theme, { typologies: themeTypologies, detectionRules, governanceItems, workflowSteps, metrics });
    }

    return map;
  }, [firmFilter]);

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
                Browse the financial crime controls your firm needs — grouped by
                risk theme, filtered by firm type, and mapped to real
                enforcement actions.
              </p>
            </div>
          </div>
        </section>

        <section className="pb-20 sm:pb-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Firm type filter */}
            <div role="group" aria-label="Filter by firm type" className="flex flex-wrap gap-2 mb-10 justify-center">
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
                  {ENFORCEMENT_ACTIONS.map((action, i) => (
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
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                          <Scale className="h-3.5 w-3.5 text-accent" />
                          Controls that would have prevented this:
                        </p>
                        <ul className="space-y-1">
                          {action.preventedBy.map((ctrl, j) => (
                            <li
                              key={j}
                              className="text-xs text-text-muted pl-4 relative before:content-[''] before:absolute before:left-1.5 before:top-[7px] before:w-1 before:h-1 before:rounded-full before:bg-accent"
                            >
                              {ctrl}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
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
                Where real financial-crime penalties have landed — grounded in the
                FCA fines dataset, so you can prioritise the controls that matter.
              </p>
              <BenchmarksPanel />
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
