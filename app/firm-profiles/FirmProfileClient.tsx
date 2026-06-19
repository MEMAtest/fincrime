"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Scale, ShieldCheck, UserCheck, Search, ClipboardCheck, Users, Building2,
  Landmark, Flame, Layers, ArrowUpRight,
} from "lucide-react";
import ResultTabs from "@/components/results/ResultTabs";
import EvidencePanel from "@/components/results/EvidencePanel";
import BenchmarkStrip from "@/components/results/BenchmarkStrip";
import HowItWorks from "@/components/shared/HowItWorks";
import KeyTerms from "@/components/shared/KeyTerms";
import NextSteps from "@/components/shared/NextSteps";
import RiskThemeIcon, { THEME_CONFIG } from "@/components/icons/RiskThemeIcon";
import { allTypologies } from "@/data/typologies";
import { FIRM_TYPE_LABEL, PRODUCT_LABEL, CUSTOMER_LABEL, RISK_THEME_LABEL } from "@/data/typologies/labels";
import {
  FIRM_PROFILES, FIRM_TYPE_ORDER, RISK_LEVEL_LABEL, RISK_LEVEL_WEIGHT, FIRM_PROFILE_DISCLAIMER,
} from "@/data/firm-profiles";
import {
  benchmarksForFirmType, countCasesForFirmType, totalEnforcementCases, enforcementBenchmarks,
} from "@/lib/enforcement/select";
import type { FirmType, RiskTheme } from "@/data/typologies/types";

export default function FirmProfileClient({ initialType }: { initialType: FirmType }) {
  const [activeType, setActiveType] = useState<FirmType>(initialType);
  const [themeFilter, setThemeFilter] = useState<RiskTheme | null>(null);

  const profile = FIRM_PROFILES[activeType];
  const label = FIRM_TYPE_LABEL[activeType];

  const applicable = useMemo(
    () => allTypologies.filter((t) => t.applicableFirmTypes.includes(activeType)),
    [activeType]
  );

  // Themes present among this firm type's typologies, ordered by the profile's
  // own inherent-risk ranking first, then any remaining themes.
  const themesPresent = useMemo(() => {
    const present = new Set(applicable.map((t) => t.riskTheme));
    const ranked = profile.inherentRisks.map((r) => r.theme).filter((t) => present.has(t));
    const extras = [...present].filter((t) => !ranked.includes(t));
    return [...ranked, ...extras];
  }, [applicable, profile]);

  const shownTypologies = themeFilter ? applicable.filter((t) => t.riskTheme === themeFilter) : applicable;
  const riskThemes = profile.inherentRisks.map((r) => r.theme);
  const firmCaseCount = countCasesForFirmType(activeType);
  const firmBenchmarks = benchmarksForFirmType(activeType);

  const switchTo = (ft: FirmType) => {
    setActiveType(ft);
    setThemeFilter(null);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/firm-profiles?type=${ft}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Intro */}
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-wider text-accent font-medium mb-1">Firm Profiles</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Financial crime risk by business model</h1>
        <p className="text-text-muted text-sm max-w-3xl mt-2 leading-relaxed">
          Pick a firm archetype to see what it sells, where its financial crime risk concentrates, which AML
          typologies apply, and what real FCA enforcement looks like. Use it to prepare for a financial crime
          interview, or as a quick reference for the firm you work in.
        </p>
      </div>

      {/* Firm-type switcher */}
      <div className="flex flex-wrap gap-2 mb-8" role="tablist" aria-label="Firm type">
        {FIRM_TYPE_ORDER.map((ft) => {
          const active = ft === activeType;
          return (
            <button
              key={ft}
              role="tab"
              aria-selected={active}
              onClick={() => switchTo(ft)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
                active
                  ? "bg-accent text-white shadow-md shadow-accent/20"
                  : "glass-card text-text-muted hover:text-foreground"
              }`}
            >
              <Landmark className="h-3.5 w-3.5" />
              {FIRM_TYPE_LABEL[ft]}
            </button>
          );
        })}
      </div>

      {/* Hero */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 mb-8">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">{label}</h2>
            <p className="text-accent text-sm font-medium mt-0.5">{profile.tagline}</p>
          </div>
        </div>
        <p className="text-text-muted text-sm leading-relaxed mt-4 max-w-3xl">{profile.description}</p>
        <div className="mt-3 flex items-start gap-2 text-xs text-text-muted max-w-3xl">
          <Scale className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent" />
          <span>{profile.regulatoryContext}</span>
        </div>

        <div className="mt-6 grid sm:grid-cols-2 gap-x-8 gap-y-5">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-text-muted mb-2">Typical services</p>
            <ul className="space-y-1.5">
              {profile.typicalServices.map((s) => (
                <li key={s} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-text-muted mb-2">Products</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.products.map((p) => (
                  <span key={p} className="inline-flex items-center px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.03] text-[11px] text-foreground">
                    {PRODUCT_LABEL[p]}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-text-muted mb-2">Primary customers</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.primaryCustomers.map((c) => (
                  <span key={c} className="inline-flex items-center px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.03] text-[11px] text-foreground">
                    {CUSTOMER_LABEL[c]}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Illustrative examples */}
        <div className="mt-6 pt-5 border-t border-white/10">
          <p className="text-[11px] uppercase tracking-wider text-text-muted mb-2">In the market</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {profile.illustrativeExamples.map((ex) => (
              <div key={ex.name} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <p className="text-sm font-semibold text-foreground">{ex.name}</p>
                <p className="text-xs text-text-muted mt-0.5 leading-snug">{ex.note}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-text-muted/70 mt-2 italic">{FIRM_PROFILE_DISCLAIMER}</p>
        </div>
      </div>

      <KeyTerms terms={["CDD", "EDD", "PEP", "transaction monitoring", "SAR"]} />

      {/* Coverage stats + enforcement KPIs */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Stat label="Applicable typologies" value={String(applicable.length)} />
        <Stat label="Inherent risk themes" value={String(profile.inherentRisks.length)} />
        <Stat label="FCA cases (this firm type)" value={firmCaseCount > 0 ? String(firmCaseCount) : "see themes"} />
      </div>
      {firmBenchmarks.totalCases > 0 ? (
        <BenchmarkStrip firmFilter={activeType} />
      ) : (
        <div className="glass-card rounded-2xl p-4 mb-8 text-sm text-text-muted">
          No FCA monetary fines in our dataset are tagged specifically to a {label}. The Enforcement tab below
          shows real cases drawn from this firm type{"'"}s inherent risk themes.
        </div>
      )}

      {/* Inherent-risk heatmap */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-semibold text-foreground">Where the risk concentrates</h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {profile.inherentRisks.map((r) => {
            const cfg = THEME_CONFIG[r.theme];
            const w = RISK_LEVEL_WEIGHT[r.level];
            return (
              <div key={r.theme} className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <RiskThemeIcon riskTheme={r.theme} size="sm" animated={false} />
                  <span className="text-sm font-semibold text-foreground">{RISK_THEME_LABEL[r.theme]}</span>
                  <span
                    className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ color: cfg.primary, backgroundColor: `${cfg.glow}1f` }}
                  >
                    {RISK_LEVEL_LABEL[r.level]}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden mb-2">
                  <div className="h-full rounded-full" style={{ width: `${w * 100}%`, backgroundColor: cfg.primary }} />
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{r.rationale}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Applicable typologies */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-semibold text-foreground">
            Typologies for a {label} <span className="text-text-muted font-normal">({applicable.length})</span>
          </h3>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setThemeFilter(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
              themeFilter === null ? "bg-accent text-white" : "glass-card text-text-muted hover:text-foreground"
            }`}
          >
            All themes
          </button>
          {themesPresent.map((theme) => {
            const cfg = THEME_CONFIG[theme];
            const active = themeFilter === theme;
            return (
              <button
                key={theme}
                onClick={() => setThemeFilter(active ? null : theme)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  active ? "text-white" : "glass-card text-text-muted hover:text-foreground"
                }`}
                style={active ? { backgroundColor: cfg.glow } : undefined}
              >
                <RiskThemeIcon riskTheme={theme} size="sm" animated={false} />
                {RISK_THEME_LABEL[theme]}
              </button>
            );
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shownTypologies.map((t) => {
            const cfg = THEME_CONFIG[t.riskTheme];
            return (
              <Link
                key={t.id}
                href={`/typology-iq/t/${t.slug}`}
                className="block glass-card rounded-xl p-4 card-hover h-full"
              >
                <div className="flex items-start gap-2.5 mb-2">
                  <RiskThemeIcon riskTheme={t.riskTheme} size="sm" animated={false} />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-foreground leading-tight flex items-center gap-1">
                      <span className="truncate">{t.title}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                    </h4>
                    <span
                      className="inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full mt-1"
                      style={{ backgroundColor: `${cfg.glow}20`, color: cfg.primary }}
                    >
                      {RISK_THEME_LABEL[t.riskTheme]}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-text-muted leading-relaxed line-clamp-3">{t.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Enforcement / KYC / Controls */}
      <ResultTabs
        tabs={[
          {
            id: "enforcement",
            label: "Enforcement",
            icon: Scale,
            content: (
              <div className="space-y-4">
                <p className="text-sm text-text-muted">
                  {firmCaseCount > 0
                    ? `${firmCaseCount} FCA enforcement ${firmCaseCount === 1 ? "case is" : "cases are"} tagged to a ${label}. The cases below are drawn from this firm type's inherent risk themes, with what would have caught each one.`
                    : `The cases below are drawn from this firm type's inherent risk themes, with what would have caught each one.`}
                </p>
                <EvidencePanel themes={riskThemes} />
              </div>
            ),
          },
          {
            id: "kyc",
            label: "KYC focus",
            icon: UserCheck,
            content: (
              <div className="space-y-4">
                <p className="text-sm text-text-muted">What customer due diligence has to get right for this model.</p>
                <ul className="space-y-2.5">
                  {profile.kycPointers.map((k) => (
                    <li key={k} className="flex items-start gap-2.5 text-sm text-foreground">
                      <UserCheck className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                      <span className="leading-relaxed">{k}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/kyc-requirements"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                >
                  <Users className="h-4 w-4" /> Open the KYC requirements matrix
                </Link>
              </div>
            ),
          },
          {
            id: "controls",
            label: "Control priorities",
            icon: ShieldCheck,
            content: (
              <div className="space-y-4">
                <p className="text-sm text-text-muted">The controls that matter most for this model, in priority order.</p>
                <ol className="space-y-2.5">
                  {profile.controlPriorities.map((c, i) => (
                    <li key={c} className="flex items-start gap-2.5 text-sm text-foreground">
                      <span className="w-5 h-5 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{c}</span>
                    </li>
                  ))}
                </ol>
                <Link
                  href={`/controls?firmType=${activeType}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                >
                  <ClipboardCheck className="h-4 w-4" /> See the full controls library for this firm type
                </Link>
              </div>
            ),
          },
        ]}
      />

      <div className="mt-10">
        <HowItWorks
          title="How this profile is derived"
          steps={[
            {
              title: "Inherent risks are an informed analyst view",
              body: "The ranked risk themes reflect where this business model concentrates financial crime risk, drawn from FATF and Wolfsberg typologies and FCA guidance. Treat them as a starting point for your own risk assessment, not a substitute for it.",
            },
            {
              title: "Typologies are filtered live from the library",
              body: `The applicable typologies are filtered from the ${allTypologies.length}-strong typology library by the firm types each one declares, so this list stays in step with the catalogue and the TypologyIQ wizard.`,
            },
            {
              title: "Enforcement is real FCA data",
              body: "The enforcement cases and penalties come from the FCA fines dataset, joined to this firm type and its risk themes. Named example firms illustrate the business model only and are not an allegation against them.",
            },
          ]}
          provenance={[
            { label: "Typology library", value: `${allTypologies.length} cited typologies` },
            { label: "Enforcement dataset", value: `${totalEnforcementCases} FCA cases` },
            { label: "Cases tagged to this firm type", value: String(firmCaseCount) },
          ]}
          lastUpdated={enforcementBenchmarks.generatedAt}
        />
      </div>

      <NextSteps
        items={[
          {
            title: "Run this in TypologyIQ",
            body: `Score a ${label} against the library and build its control framework.`,
            href: `/typology-iq?firmType=${activeType}`,
            icon: Search,
          },
          {
            title: "See the controls library",
            body: "Detection rules, workflows and governance for this firm type.",
            href: `/controls?firmType=${activeType}`,
            icon: ClipboardCheck,
          },
          {
            title: "Check KYC requirements",
            body: "Map the CDD evidence needed by customer and entity type.",
            href: "/kyc-requirements",
            icon: Users,
          },
        ]}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card rounded-xl px-4 py-2.5">
      <div className="text-lg font-bold text-foreground tabular-nums leading-none">{value}</div>
      <div className="text-[11px] text-text-muted mt-1">{label}</div>
    </div>
  );
}
