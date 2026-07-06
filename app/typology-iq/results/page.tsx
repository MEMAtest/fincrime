"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useMemo, useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import {
  Target, Database, Cpu, GitBranch, ClipboardCheck, BarChart3,
  ArrowLeft, ChevronDown, ChevronUp, Layers, Scale, Wrench, Maximize2,
} from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import ResultCard from "@/components/results/ResultCard";
import ResultsGrid from "@/components/results/ResultsGrid";
import ResultTabs from "@/components/results/ResultTabs";
import EvidencePanel from "@/components/results/EvidencePanel";
import BenchmarksPanel from "@/components/results/BenchmarksPanel";
import MatchExplanation from "@/components/results/MatchExplanation";
import BenchmarkStrip from "@/components/results/BenchmarkStrip";
import NarrativeCard from "@/components/results/NarrativeCard";
import KeyTerms from "@/components/shared/KeyTerms";
import HowItWorks from "@/components/shared/HowItWorks";
import NextSteps from "@/components/shared/NextSteps";
import TypologyDetailModal from "@/components/typologies/TypologyDetailModal";
import { useNarrative } from "@/lib/useNarrative";
import { allTypologies } from "@/data/typologies";
import { totalEnforcementCases, enforcementBenchmarks } from "@/lib/enforcement/select";
import SourceBadge from "@/components/shared/SourceBadge";
import Badge from "@/components/ui/Badge";
import PDFExportButton from "@/components/shared/PDFExportButton";
import RiskThemeIcon from "@/components/icons/RiskThemeIcon";
import { THEME_CONFIG } from "@/components/icons/RiskThemeIcon";
import { scoreTypologies } from "@/data/scoring/typology-scoring";
import { FIRM_TYPE_LABEL, PRODUCT_LABEL, CUSTOMER_LABEL, RISK_THEME_LABEL } from "@/data/typologies/labels";
import { parseListParam } from "@/lib/list-params";
import type { FirmType, ProductType, CustomerType, RiskTheme, SourceOrg } from "@/data/typologies/types";

function TypologyResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [showAllDetection, setShowAllDetection] = useState(false);
  const [showAllWorkflow, setShowAllWorkflow] = useState(false);
  const [detailSlug, setDetailSlug] = useState<string | null>(null);
  const activeChipRef = useRef<HTMLButtonElement>(null);

  const answers = useMemo(() => {
    // Validate against the enum (label-map keys) and de-dup, so a hand-edited or
    // stale deep link can't inject junk values that render raw or crash THEME_CONFIG.
    return {
      firmTypes: parseListParam(searchParams.get("firmType"), { allow: Object.keys(FIRM_TYPE_LABEL) }) as FirmType[],
      products: parseListParam(searchParams.get("product"), { allow: Object.keys(PRODUCT_LABEL) }) as ProductType[],
      customerTypes: parseListParam(searchParams.get("customerType"), { allow: Object.keys(CUSTOMER_LABEL) }) as CustomerType[],
      riskThemes: parseListParam(searchParams.get("riskThemes") ?? searchParams.get("riskTheme"), { allow: Object.keys(RISK_THEME_LABEL) }) as RiskTheme[],
    };
  }, [searchParams]);

  const hasAnswers = answers.firmTypes.length && answers.products.length && answers.customerTypes.length && answers.riskThemes.length;

  // Every typology that matches the profile, ranked highest-first. The user
  // selects one from the chip row to make it the active result.
  const matches = useMemo(() => {
    if (!hasAnswers) return [];
    return scoreTypologies(answers).filter((m) => m.score > 0);
  }, [answers, hasAnswers]);

  const activeParam = searchParams.get("active");
  const active = useMemo(
    () => (matches.length ? matches.find((m) => m.typology.slug === activeParam) ?? matches[0] : null),
    [matches, activeParam]
  );
  const activeRank = active ? matches.findIndex((m) => m.typology.slug === active.typology.slug) + 1 : 0;

  const selectTypology = (slug: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("active", slug);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };
  const onChipsKeyDown = (e: React.KeyboardEvent) => {
    if (!active || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
    e.preventDefault();
    const idx = matches.findIndex((m) => m.typology.slug === active.typology.slug);
    const next = e.key === "ArrowRight" ? Math.min(matches.length - 1, idx + 1) : Math.max(0, idx - 1);
    selectTypology(matches[next].typology.slug);
  };

  // Keep the active chip in view on narrow screens as the selection moves.
  useEffect(() => {
    activeChipRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [active?.typology.slug]);

  const { narrative, loading: narrativeLoading } = useNarrative(
    "/api/typology/narrative",
    active
      ? {
          typologyTitle: active.typology.title,
          typologyDescription: active.typology.description,
          controlObjective: active.typology.controlObjective,
          firmTypes: answers.firmTypes,
          products: answers.products,
          customerTypes: answers.customerTypes,
          riskThemes: answers.riskThemes,
          score: active.score,
        }
      : null
  );

  if (!active) {
    return (
      <div className="text-center py-20">
        <p className="text-text-muted">Missing parameters. Please complete the wizard first.</p>
        <Link href="/typology-iq" className="text-accent mt-4 inline-block">
          Start over
        </Link>
      </div>
    );
  }

  const { typology, score, breakdown } = active;
  const detectionRules = showAllDetection ? typology.detectionLogic : typology.detectionLogic.slice(0, 3);
  const workflowSteps = showAllWorkflow ? typology.workflowSteps : typology.workflowSteps.slice(0, 3);

  const priorityVariant = (p: string) => {
    switch (p) {
      case "critical": return "danger" as const;
      case "high": return "warning" as const;
      case "medium": return "info" as const;
      default: return "default" as const;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href={`/typology-iq?${searchParams.toString()}`}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to wizard
        </Link>
        <PDFExportButton
          module="typology_iq"
          assessmentData={{ ...answers, activeSlug: typology.slug, narrative }}
        />
      </div>

      {/* How TypologyIQ works (collapsed by default) */}
      <HowItWorks
        title="How TypologyIQ works"
        steps={[
          { title: "Deterministic match", body: "Your selections are scored against each typology with fixed weights (firm type 30, product 25, customer 20, risk theme 25). The same inputs always give the same result; nothing is random or AI-driven." },
          { title: "Cited typologies", body: "Each typology and its controls map to authoritative sources (FATF, Wolfsberg, FCA, JMLSG). Open any source badge to see and copy the reference." },
          { title: "AI-assisted summary", body: "The Risk Intelligence narrative is written by an AI model from your selections and the matched typology. It explains the deterministic result; it does not add new facts and is not legal advice." },
          { title: "Real enforcement", body: "The Evidence tab maps the risk to real FCA enforcement cases, including the controls that would have caught each failure." },
        ]}
        provenance={[
          { label: "Typologies", value: `${allTypologies.length}, framework-aligned` },
          { label: "Enforcement cases", value: `${totalEnforcementCases} FCA fines` },
          { label: "Scoring", value: "Deterministic, weighted" },
          { label: "Frameworks", value: "FATF, Wolfsberg, FCA, JMLSG" },
        ]}
        lastUpdated={enforcementBenchmarks.generatedAt}
      />

      <BenchmarkStrip />

      {/* Profile Assessed (multi-select) */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Firm Types", values: answers.firmTypes.map((v) => FIRM_TYPE_LABEL[v] ?? v) },
          { label: "Products", values: answers.products.map((v) => PRODUCT_LABEL[v] ?? v) },
          { label: "Customer Types", values: answers.customerTypes.map((v) => CUSTOMER_LABEL[v] ?? v) },
        ].map((group) => (
          <div key={group.label}>
            <p className="text-xs text-text-muted uppercase tracking-wider mb-2">{group.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.values.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03] text-xs text-foreground"
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Matched typologies: select one to explore */}
      <div className="mb-5">
        <p className="text-xs text-text-muted uppercase tracking-wider mb-2">
          {matches.length} typolog{matches.length === 1 ? "y" : "ies"} match your profile. Select one to explore.
        </p>
        <div
          role="radiogroup"
          aria-label="Matched typologies"
          onKeyDown={onChipsKeyDown}
          className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {matches.map((m) => {
            const cfg = THEME_CONFIG[m.typology.riskTheme];
            const isActive = m.typology.slug === typology.slug;
            return (
              <button
                key={m.typology.slug}
                ref={isActive ? activeChipRef : undefined}
                role="radio"
                aria-checked={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => selectTypology(m.typology.slug)}
                className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors cursor-pointer ${
                  isActive ? "text-white border-transparent" : "glass-card text-text-muted hover:text-foreground"
                }`}
                style={isActive ? { backgroundColor: cfg.glow } : undefined}
              >
                <RiskThemeIcon riskTheme={m.typology.riskTheme} size="sm" animated={false} />
                <span className="max-w-[180px] truncate">{m.typology.title}</span>
                <span className={`text-[11px] font-mono ${isActive ? "text-white/90" : "text-text-muted"}`}>{m.score}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Risk Themes */}
      {answers.riskThemes.length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Risk Themes Assessed</p>
          <div className="flex flex-wrap gap-2">
            {answers.riskThemes.map((theme) => {
              const cfg = THEME_CONFIG[theme];
              return (
                <span
                  key={theme}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium"
                  style={{
                    backgroundColor: `${cfg.glow}18`,
                    borderColor: `${cfg.primary}40`,
                    color: cfg.primary,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.primary }} />
                  {cfg.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Match Summary (of the active typology) */}
      <div className="glass-card rounded-2xl p-8 mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
              {activeRank === 1
                ? `Best match · Score ${score}/100`
                : `Selected match · ranked ${activeRank} of ${matches.length} · Score ${score}/100`}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              {typology.title}
            </h1>
            <p className="text-text-muted text-sm max-w-2xl leading-relaxed">
              {typology.description}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {typology.sources.map((s) => (
                <SourceBadge key={s.reference} source={s.org as SourceOrg} reference={s.reference} url={s.url} title={s.title} />
              ))}
              <button
                onClick={() => setDetailSlug(typology.slug)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline cursor-pointer"
              >
                <Maximize2 className="h-3.5 w-3.5" /> View full detail
              </button>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-5xl font-bold gradient-text">{score}</div>
            <p className="text-xs text-text-muted mt-1">/100 match</p>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="grid grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          {[
            { label: "Firm Type", score: breakdown.firmTypeScore, max: 30 },
            { label: "Product", score: breakdown.productScore, max: 25 },
            { label: "Customer", score: breakdown.customerTypeScore, max: 20 },
            { label: "Risk Theme", score: breakdown.riskThemeScore, max: 25 },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className={`text-lg font-bold ${item.score > 0 ? "text-accent" : "text-white/20"}`}>
                {item.score}/{item.max}
              </div>
              <p className="text-xs text-text-muted">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Key terms (inline glossary) */}
      <KeyTerms terms={["CDD", "EDD", "beneficial owner", "SAR", "transaction monitoring"]} />

      {/* Why this matched (deterministic explainability) */}
      <MatchExplanation answers={answers} result={active} />

      {/* Risk Intelligence (AI-assisted narrative, distinguished from cited fact) */}
      <NarrativeCard
        heading="Risk Intelligence"
        narrative={narrative}
        loading={narrativeLoading}
        scoringNote="In TypologyIQ the weights are firm type 30, product 25, customer 20, risk theme 25."
      />

      {/* Tabbed results: Controls · Evidence · Benchmarks */}
      <ResultTabs
        tabs={[
          {
            id: "controls",
            label: "Controls",
            icon: Layers,
            content: (
              <ResultsGrid>
                {/* Card 1: Control Objective */}
                <ResultCard title="Control Objective" icon={Target} className="md:col-span-2" index={0}>
                  <p className="leading-relaxed">{typology.controlObjective}</p>
                </ResultCard>

                {/* Card 2: Data Required */}
                <ResultCard title="Data Required" icon={Database} index={1}>
                  <ul className="space-y-2">
                    {typology.dataRequired.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </ResultCard>

                {/* Card 3: Detection Logic */}
                <ResultCard title="Detection Logic" icon={Cpu} index={2}>
                  <div className="space-y-3">
                    {detectionRules.map((rule) => (
                      <div key={rule.id} className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs text-slate-400">{rule.id}</span>
                          <Badge variant={priorityVariant(rule.priority)}>
                            {rule.priority}
                          </Badge>
                        </div>
                        <p className="font-medium text-slate-800 text-sm mb-1">{rule.name}</p>
                        <p className="text-xs text-slate-500">{rule.logic}</p>
                        {rule.threshold && (
                          <p className="text-xs text-accent mt-1">Threshold: {rule.threshold}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {typology.detectionLogic.length > 3 && (
                    <button
                      onClick={() => setShowAllDetection(!showAllDetection)}
                      className="flex items-center gap-1 text-xs text-accent mt-3 hover:underline cursor-pointer"
                    >
                      {showAllDetection ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {showAllDetection ? "Show less" : `Show all ${typology.detectionLogic.length} rules`}
                    </button>
                  )}
                </ResultCard>

                {/* Card 4: Investigation Workflow */}
                <ResultCard title="Investigation Workflow" icon={GitBranch} index={3}>
                  <div className="space-y-3">
                    {workflowSteps.map((ws) => (
                      <div key={ws.step} className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold shrink-0">
                          {ws.step}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{ws.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{ws.description}</p>
                          <div className="flex gap-3 mt-1">
                            {ws.sla && (
                              <span className="text-xs text-accent">SLA: {ws.sla}</span>
                            )}
                            <span className="text-xs text-slate-400">{ws.responsible}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {typology.workflowSteps.length > 3 && (
                    <button
                      onClick={() => setShowAllWorkflow(!showAllWorkflow)}
                      className="flex items-center gap-1 text-xs text-accent mt-3 hover:underline cursor-pointer"
                    >
                      {showAllWorkflow ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {showAllWorkflow ? "Show less" : `Show all ${typology.workflowSteps.length} steps`}
                    </button>
                  )}
                </ResultCard>

                {/* Card 5: Metrics */}
                <ResultCard title="Effectiveness Metrics" icon={BarChart3} index={4}>
                  <div className="space-y-3">
                    {typology.metrics.map((m) => (
                      <div key={m.name} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{m.name}</p>
                          <p className="text-xs text-slate-400">{m.description}</p>
                        </div>
                        <span className="text-sm font-mono text-accent shrink-0 ml-3">{m.target}</span>
                      </div>
                    ))}
                  </div>
                </ResultCard>

                {/* Card 6: Governance Checklist */}
                <ResultCard title="Governance Checklist" icon={ClipboardCheck} index={5}>
                  <div className="space-y-2">
                    {typology.governanceChecklist.map((g) => (
                      <div key={g.id} className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-0">
                        <input type="checkbox" className="mt-1 rounded border-slate-300 text-accent focus:ring-accent" readOnly />
                        <div>
                          <p className="text-sm text-slate-700">{g.item}</p>
                          <div className="flex gap-2 mt-0.5">
                            <span className="text-xs text-accent">{g.frequency}</span>
                            <span className="text-xs text-slate-400">Owner: {g.owner}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ResultCard>
              </ResultsGrid>
            ),
          },
          {
            id: "evidence",
            label: "Evidence",
            icon: Scale,
            content: <EvidencePanel themes={[typology.riskTheme]} typology={typology} />,
          },
          {
            id: "benchmarks",
            label: "Benchmarks",
            icon: BarChart3,
            content: <BenchmarksPanel />,
          },
        ]}
      />

      <NextSteps
        items={[
          { title: "Build these controls", body: "Adapt the controls for this typology to your firm and export a register.", href: `/control-builder?from=typology:${typology.slug}`, icon: Wrench },
          { title: "Browse the Controls Library", body: "The full catalogue of controls, by category, for your firm type.", href: `/controls?firmType=${answers.firmTypes[0]}`, icon: Layers },
          { title: "Map partner control ownership", body: "Define who owns each control across a partner payment flow (RACI).", href: "/partner-control-map", icon: GitBranch },
          { title: "Check KYC requirements", body: "What to collect by entity type and jurisdiction, each cited.", href: "/kyc-requirements", icon: ClipboardCheck },
        ]}
      />

      <TypologyDetailModal slug={detailSlug} onClose={() => setDetailSlug(null)} />
    </div>
  );
}

export default function TypologyResultsPage() {
  return (
    <ToolFrame>
      <main className="flex-1">
        <Suspense fallback={<div className="text-center py-20 text-text-muted">Loading results...</div>}>
          <TypologyResults />
        </Suspense>
      </main>
    </ToolFrame>
  );
}
