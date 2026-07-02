"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Scale, ShieldCheck, UserCheck, Search, ClipboardCheck, Users, Building2,
  Landmark, Flame, Layers, ArrowUpRight, Wrench, ChevronDown,
} from "lucide-react";
import ResultTabs from "@/components/results/ResultTabs";
import EvidencePanel from "@/components/results/EvidencePanel";
import HowItWorks from "@/components/shared/HowItWorks";
import RiskThemeIcon, { THEME_CONFIG } from "@/components/icons/RiskThemeIcon";
import RiskThemeModal from "@/components/firm-profiles/RiskThemeModal";
import TypologyDetailModal from "@/components/typologies/TypologyDetailModal";
import { allTypologies } from "@/data/typologies";
import { FIRM_TYPE_LABEL, PRODUCT_LABEL, CUSTOMER_LABEL, RISK_THEME_LABEL } from "@/data/typologies/labels";
import {
  FIRM_PROFILES, FIRM_TYPE_ORDER, RISK_LEVEL_LABEL, RISK_LEVEL_WEIGHT, FIRM_PROFILE_DISCLAIMER,
} from "@/data/firm-profiles";
import {
  countCasesForFirmType, totalEnforcementCases, enforcementBenchmarks,
} from "@/lib/enforcement/select";
import type { FirmType, RiskTheme } from "@/data/typologies/types";

export default function FirmProfileClient({ initialType }: { initialType: FirmType }) {
  const router = useRouter();
  const [activeType, setActiveType] = useState<FirmType>(initialType);
  const [themeFilter, setThemeFilter] = useState<RiskTheme | null>(null);
  const [openRisk, setOpenRisk] = useState<RiskTheme | null>(null);
  const [openTypology, setOpenTypology] = useState<string | null>(null);
  const [showAllTypologies, setShowAllTypologies] = useState(false);

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
  const openRiskData = openRisk ? profile.inherentRisks.find((r) => r.theme === openRisk) : undefined;
  const riskThemes = profile.inherentRisks.map((r) => r.theme);
  const firmCaseCount = countCasesForFirmType(activeType);

  const switchTo = (ft: FirmType) => {
    setActiveType(ft);
    setThemeFilter(null);
    setShowAllTypologies(false);
    router.replace(`/firm-profiles?type=${ft}`, { scroll: false });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Intro (one line) */}
      <div className="mb-3">
        <p className="text-[11px] uppercase tracking-wider text-accent font-medium">Firm Profiles</p>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Financial crime risk by business model</h1>
      </div>

      {/* Firm-type switcher */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto sm:flex-wrap -mx-4 px-4 sm:mx-0 sm:px-0 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Firm type">
        {FIRM_TYPE_ORDER.map((ft) => {
          const active = ft === activeType;
          return (
            <button
              key={ft}
              role="tab"
              aria-selected={active}
              onClick={() => switchTo(ft)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                active
                  ? "bg-accent text-white shadow-sm shadow-accent/20"
                  : "glass-card text-text-muted hover:text-foreground"
              }`}
            >
              <Landmark className="h-3.5 w-3.5" />
              {FIRM_TYPE_LABEL[ft]}
            </button>
          );
        })}
      </div>

      {/* Compact firm header: identity + inline stats, everything else behind one toggle */}
      <div className="glass-card rounded-2xl p-3.5 mb-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-foreground leading-tight">{label}</h2>
              <span className="text-accent text-xs font-medium">{profile.tagline}</span>
            </div>
            <p className="text-text-muted text-sm mt-1 leading-relaxed line-clamp-2">{profile.description}</p>
            {/* Inline stats, always visible (incl. mobile) */}
            <div className="flex items-center gap-5 mt-2.5">
              <MiniStat value={String(applicable.length)} label="typologies" />
              <MiniStat value={String(profile.inherentRisks.length)} label="risk themes" />
              <MiniStat value={firmCaseCount > 0 ? String(firmCaseCount) : "—"} label="FCA cases" />
            </div>
          </div>
        </div>

        <details className="group mt-3 pt-3 border-t border-white/10">
          <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-foreground transition-colors">
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            Services, products, customers &amp; market examples
          </summary>
          <div className="mt-3 space-y-3">
            <p className="flex items-start gap-2 text-xs text-text-muted"><Scale className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent" />{profile.regulatoryContext}</p>
            <div className="grid sm:grid-cols-3 gap-x-6 gap-y-3">
              <ChipGroup title="Typical services" items={profile.typicalServices} />
              {profile.products.length > 0 && <ChipGroup title="Products" items={profile.products.map((p) => PRODUCT_LABEL[p])} />}
              <ChipGroup title="Primary customers" items={profile.primaryCustomers.map((c) => CUSTOMER_LABEL[c])} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-text-muted mb-2">In the market</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {profile.illustrativeExamples.map((ex) => (
                  <div key={ex.name} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
                    <p className="text-sm font-semibold text-foreground">{ex.name}</p>
                    <p className="text-xs text-text-muted mt-0.5 leading-snug">{ex.note}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-text-muted/70 mt-2 italic">{FIRM_PROFILE_DISCLAIMER}</p>
            </div>
          </div>
        </details>
      </div>

      {/* Firm detail in one tabbed panel: only one section shows at a time */}
      <ResultTabs
        tabs={[
          {
            id: "risk",
            label: "Risk & typologies",
            icon: Flame,
            content: (
              <div className="grid lg:grid-cols-2 gap-5 items-start">
        {/* Where the risk concentrates */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Flame className="h-5 w-5 text-accent" />
            <h3 className="text-lg font-semibold text-foreground">Where the risk concentrates</h3>
          </div>
          <div className="space-y-1.5">
            {profile.inherentRisks.map((r) => {
              const cfg = THEME_CONFIG[r.theme];
              const w = RISK_LEVEL_WEIGHT[r.level];
              return (
                <button
                  key={r.theme}
                  onClick={() => setOpenRisk(r.theme)}
                  className="w-full text-left glass-card rounded-lg px-3 py-2 card-hover cursor-pointer flex items-center gap-3"
                >
                  <RiskThemeIcon riskTheme={r.theme} size="sm" animated={false} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{RISK_THEME_LABEL[r.theme]}</span>
                      <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ color: cfg.primary, backgroundColor: `${cfg.glow}1f` }}>
                        {RISK_LEVEL_LABEL[r.level]}
                      </span>
                    </span>
                    <span className="mt-1.5 block h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <span className="block h-full rounded-full" style={{ width: `${w * 100}%`, backgroundColor: cfg.primary }} />
                    </span>
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-text-muted shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Applicable typologies */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-5 w-5 text-accent" />
            <h3 className="text-lg font-semibold text-foreground">
              Typologies for a {label} <span className="text-text-muted font-normal">({applicable.length})</span>
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button
              onClick={() => { setThemeFilter(null); setShowAllTypologies(false); }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                themeFilter === null ? "bg-accent text-white" : "glass-card text-text-muted hover:text-foreground"
              }`}
            >
              All
            </button>
            {themesPresent.map((theme) => {
              const cfg = THEME_CONFIG[theme];
              const active = themeFilter === theme;
              return (
                <button
                  key={theme}
                  onClick={() => { setThemeFilter(active ? null : theme); setShowAllTypologies(false); }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
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
          <div className="space-y-1.5">
            {(showAllTypologies ? shownTypologies : shownTypologies.slice(0, 6)).map((t) => (
              <button
                key={t.id}
                onClick={() => setOpenTypology(t.slug)}
                className="w-full text-left glass-card rounded-lg px-3 py-2 card-hover cursor-pointer flex items-start gap-2.5"
              >
                <RiskThemeIcon riskTheme={t.riskTheme} size="sm" animated={false} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm font-medium text-foreground leading-tight">
                    <span className="truncate">{t.title}</span>
                    <ArrowUpRight className="h-3 w-3 shrink-0 text-text-muted" />
                  </span>
                  <span className="block text-xs text-text-muted line-clamp-1 mt-0.5">{t.description}</span>
                </span>
              </button>
            ))}
          </div>
          {shownTypologies.length > 6 && (
            <button
              onClick={() => setShowAllTypologies((v) => !v)}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover transition-colors cursor-pointer"
            >
              {showAllTypologies ? "Show fewer" : `View all ${shownTypologies.length} typologies`}
            </button>
          )}
        </div>
              </div>
            ),
          },
          {
            id: "enforcement",
            label: "Enforcement",
            icon: Scale,
            content: (
              <div className="space-y-4">
                <p className="text-sm text-text-muted">
                  {firmCaseCount > 0
                    ? `${firmCaseCount} FCA enforcement ${firmCaseCount === 1 ? "case is" : "cases are"} tagged directly to a ${label}. The cases below span this firm type's inherent risk themes; where we have a breakdown, each shows the controls that would have caught it.`
                    : `Real FCA cases across this firm type's inherent risk themes; where we have a breakdown, each shows the controls that would have caught it.`}
                </p>
                <EvidencePanel key={activeType} themes={riskThemes} compact moreHref="/enforcement" />
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

      <div className="mt-5">
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

      {/* Next steps: compact link row */}
      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-wider text-text-muted mb-2">Next steps</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Build the controls", href: `/control-builder?firmType=${activeType}`, icon: Wrench },
            { label: "Run in TypologyIQ", href: `/typology-iq?firmType=${activeType}`, icon: Search },
            { label: "Controls library", href: `/controls?firmType=${activeType}`, icon: ClipboardCheck },
            { label: "KYC requirements", href: "/kyc-requirements", icon: Users },
          ].map((n) => (
            <Link key={n.href} href={n.href} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-card text-sm text-foreground hover:text-accent card-hover transition-colors">
              <n.icon className="h-3.5 w-3.5 text-accent" /> {n.label} <ArrowUpRight className="h-3 w-3 text-text-muted" />
            </Link>
          ))}
        </div>
      </div>

      <RiskThemeModal
        theme={openRisk}
        levelLabel={openRiskData ? RISK_LEVEL_LABEL[openRiskData.level] : undefined}
        rationale={openRiskData?.rationale}
        typologies={openRisk ? applicable.filter((t) => t.riskTheme === openRisk) : []}
        buildHref={openRisk ? `/control-builder?from=theme:${openRisk}` : "/control-builder"}
        onOpenTypology={(slug) => { setOpenRisk(null); setOpenTypology(slug); }}
        onClose={() => setOpenRisk(null)}
      />
      <TypologyDetailModal slug={openTypology} onClose={() => setOpenTypology(null)} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-base font-bold text-foreground tabular-nums leading-none">{value}</span>
      <span className="text-[11px] text-text-muted whitespace-nowrap">{label}</span>
    </div>
  );
}

function ChipGroup({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-text-muted mb-2">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => (
          <span key={s} className="inline-flex items-center px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.03] text-[11px] text-foreground">{s}</span>
        ))}
      </div>
    </div>
  );
}
