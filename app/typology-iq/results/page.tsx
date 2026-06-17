"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import {
  Target, Database, Cpu, GitBranch, ClipboardCheck, BarChart3,
  ArrowLeft, FileText, BookOpen, ChevronDown, ChevronUp, Link2, Layers, Scale,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ResultCard from "@/components/results/ResultCard";
import ResultsGrid from "@/components/results/ResultsGrid";
import ResultTabs from "@/components/results/ResultTabs";
import EvidencePanel from "@/components/results/EvidencePanel";
import BenchmarksPanel from "@/components/results/BenchmarksPanel";
import SourceBadge from "@/components/shared/SourceBadge";
import Badge from "@/components/ui/Badge";
import PDFExportButton from "@/components/shared/PDFExportButton";
import RiskThemeIcon from "@/components/icons/RiskThemeIcon";
import { THEME_CONFIG } from "@/components/icons/RiskThemeIcon";
import { getBestMatch, getTopMatches, getRelatedTypologies } from "@/data/scoring/typology-scoring";
import { FIRM_TYPE_LABEL, PRODUCT_LABEL, CUSTOMER_LABEL, RISK_THEME_LABEL } from "@/data/typologies/labels";
import { parseListParam } from "@/lib/list-params";
import type { FirmType, ProductType, CustomerType, RiskTheme, SourceOrg } from "@/data/typologies/types";

function TypologyResults() {
  const searchParams = useSearchParams();
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [showAllDetection, setShowAllDetection] = useState(false);
  const [showAllWorkflow, setShowAllWorkflow] = useState(false);

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

  const result = useMemo(() => {
    if (!answers.firmTypes.length || !answers.products.length || !answers.customerTypes.length || !answers.riskThemes.length) {
      return null;
    }
    return getBestMatch(answers);
  }, [answers]);

  const topMatches = useMemo(() => {
    if (!answers.firmTypes.length) return [];
    return getTopMatches(answers, 3);
  }, [answers]);

  const relatedTypologies = useMemo(() => {
    if (!result) return [];
    return getRelatedTypologies(answers, result.typology.slug, 4);
  }, [answers, result]);

  useEffect(() => {
    if (!result) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start loading state before the async narrative fetch
    setNarrativeLoading(true);
    fetch("/api/typology/narrative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        typologyTitle: result.typology.title,
        typologyDescription: result.typology.description,
        controlObjective: result.typology.controlObjective,
        firmTypes: answers.firmTypes,
        products: answers.products,
        customerTypes: answers.customerTypes,
        riskThemes: answers.riskThemes,
        score: result.score,
      }),
    })
      .then((res) => res.json())
      .then((data) => setNarrative(data.narrative || null))
      .catch(() => setNarrative(null))
      .finally(() => setNarrativeLoading(false));
  }, [result, answers]);

  if (!result) {
    return (
      <div className="text-center py-20">
        <p className="text-text-muted">Missing parameters. Please complete the wizard first.</p>
        <Link href="/typology-iq" className="text-accent mt-4 inline-block">
          Start over
        </Link>
      </div>
    );
  }

  const { typology, score, breakdown } = result;
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
          href="/typology-iq"
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to wizard
        </Link>
        <PDFExportButton
          module="typology_iq"
          assessmentData={{ ...answers, narrative }}
        />
      </div>

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

      {/* Match Summary */}
      <div className="glass-card rounded-2xl p-8 mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
              Best Match · Score {score}/100
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              {typology.title}
            </h1>
            <p className="text-text-muted text-sm max-w-2xl leading-relaxed">
              {typology.description}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {typology.sources.map((s) => (
                <SourceBadge key={s.reference} source={s.org as SourceOrg} reference={s.reference} url={s.url} title={s.title} />
              ))}
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

      {/* Risk Overview (formerly AI Narrative) */}
      {(narrativeLoading || narrative) && (
        <div className="glass-card rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Risk Overview</h3>
          </div>
          {narrativeLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-text-muted">Generating risk overview...</span>
            </div>
          ) : (
            <p className="text-sm text-text-muted leading-relaxed">{narrative}</p>
          )}
        </div>
      )}

      {/* Tabbed results: Controls · Evidence · Benchmarks */}
      <ResultTabs
        tabs={[
          {
            id: "controls",
            label: "Controls",
            icon: Layers,
            content: (
              <>
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

      {/* Tied / Related Typologies (sharing same risk themes) */}
      {relatedTypologies.length > 0 && (
        <div className="mt-10">
          <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-accent" />
            Related Typologies
          </h3>
          <p className="text-xs text-text-muted mb-4">
            Other typologies in the risk themes you selected, commonly investigated together.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {relatedTypologies.map((match) => {
              const cfg = THEME_CONFIG[match.typology.riskTheme];
              return (
                <div key={match.typology.slug} className="glass-card rounded-xl p-4 flex items-start gap-3">
                  <div className="shrink-0">
                    <RiskThemeIcon riskTheme={match.typology.riskTheme} size="sm" animated={false} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="text-sm font-medium text-foreground truncate">
                        {match.typology.title}
                      </h4>
                      <span className="text-xs font-mono text-text-muted shrink-0">
                        {match.score}/100
                      </span>
                    </div>
                    <p className="text-xs text-text-muted line-clamp-2 mb-2">
                      {match.typology.description}
                    </p>
                    <span
                      className="inline-block text-[10px] uppercase tracking-wider font-medium"
                      style={{ color: cfg.primary }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Other Matches */}
      {topMatches.length > 1 && (
        <div className="mt-10">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-accent" />
            Other Potential Matches
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {topMatches.slice(1).map((match) => (
              <div key={match.typology.slug} className="glass-card rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium text-foreground">
                    {match.typology.title}
                  </h4>
                  <span className="text-sm font-mono text-text-muted">
                    {match.score}/100
                  </span>
                </div>
                <p className="text-xs text-text-muted line-clamp-2">
                  {match.typology.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
              </>
            ),
          },
          {
            id: "evidence",
            label: "Evidence",
            icon: Scale,
            content: <EvidencePanel themes={answers.riskThemes} />,
          },
          {
            id: "benchmarks",
            label: "Benchmarks",
            icon: BarChart3,
            content: <BenchmarksPanel />,
          },
        ]}
      />
    </div>
  );
}

export default function TypologyResultsPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Suspense fallback={<div className="text-center py-20 text-text-muted">Loading results...</div>}>
          <TypologyResults />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
