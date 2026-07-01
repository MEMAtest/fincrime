"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, Suspense } from "react";
import Link from "next/link";
import {
  Gauge, ListChecks, Route, BarChart3, ClipboardCheck, ArrowLeft, Layers, Scale,
} from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import ResultCard from "@/components/results/ResultCard";
import ResultsGrid from "@/components/results/ResultsGrid";
import ResultTabs from "@/components/results/ResultTabs";
import EvidencePanel from "@/components/results/EvidencePanel";
import BenchmarksPanel from "@/components/results/BenchmarksPanel";
import BenchmarkStrip from "@/components/results/BenchmarkStrip";
import SourceBadge from "@/components/shared/SourceBadge";
import PDFExportButton from "@/components/shared/PDFExportButton";
import NarrativeCard from "@/components/results/NarrativeCard";
import KeyTerms from "@/components/shared/KeyTerms";
import HowItWorks from "@/components/shared/HowItWorks";
import NextSteps from "@/components/shared/NextSteps";
import { useNarrative } from "@/lib/useNarrative";
import { allMaturityFrameworks } from "@/data/maturity";
import { totalEnforcementCases, enforcementBenchmarks } from "@/lib/enforcement/select";
import { scoreMaturity } from "@/data/scoring/maturity-scoring";
import { MATURITY_LABEL, MATURITY_ORDER, CONTROL_AREA_LABEL } from "@/data/maturity/types";
import type { ControlArea, MaturityLevel } from "@/data/maturity/types";
import type { SourceOrg } from "@/data/typologies/types";

const LEVELS: MaturityLevel[] = ["initial", "developing", "defined", "managed", "optimised"];

function LevelScale({ current, target }: { current: MaturityLevel; target: MaturityLevel }) {
  const cur = MATURITY_ORDER[current];
  const tgt = MATURITY_ORDER[target];
  return (
    <div className="flex items-center gap-1.5">
      {LEVELS.map((lvl) => {
        const o = MATURITY_ORDER[lvl];
        const filled = o <= cur;
        const inGap = o > cur && o <= tgt;
        return (
          <div key={lvl} className="flex-1 text-center">
            <div
              className={`h-2.5 rounded-full ${
                filled ? "bg-emerald-500" : inGap ? "bg-emerald-500/30" : "bg-surface-border"
              }`}
            />
            <div className="mt-1.5 text-[10px] text-text-muted truncate">{MATURITY_LABEL[lvl]}</div>
          </div>
        );
      })}
    </div>
  );
}

function MaturityResults() {
  const searchParams = useSearchParams();

  const answers = useMemo(() => ({
    area: searchParams.get("area") as ControlArea,
    currentLevel: searchParams.get("currentLevel") as MaturityLevel,
    targetLevel: searchParams.get("targetLevel") as MaturityLevel,
  }), [searchParams]);

  const result = useMemo(() => {
    if (!answers.area || !answers.currentLevel || !answers.targetLevel) return null;
    return scoreMaturity(answers);
  }, [answers]);

  const { narrative, loading: narrativeLoading } = useNarrative(
    "/api/maturity/narrative",
    result
      ? {
          area: answers.area,
          title: result.framework.title,
          currentLevel: answers.currentLevel,
          targetLevel: answers.targetLevel,
          gapLevels: result.gapLevels,
        }
      : null
  );

  if (!result) {
    return (
      <div className="text-center py-20">
        <p className="text-text-muted">Missing parameters. Please complete the wizard first.</p>
        <Link href="/controls-maturity" className="text-accent mt-4 inline-block">Start over</Link>
      </div>
    );
  }

  const { framework, currentLevel, targetLevel, currentScore, targetScore, gapScore, remediation } = result;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <Link href="/controls-maturity" className="flex items-center gap-1.5 text-sm text-text-muted hover:text-accent transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to wizard
        </Link>
        <PDFExportButton module="controls_maturity" assessmentData={{ ...answers, narrative }} />
      </div>

      <div className="mb-6">
        <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-xs font-medium">
          {CONTROL_AREA_LABEL[answers.area]}
        </span>
      </div>

      <div className="glass-card rounded-2xl p-8 mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Maturity Assessment</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{framework.title}</h1>
            <p className="text-text-muted text-sm max-w-2xl leading-relaxed">{framework.description}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {framework.sources.map((s) => (
                <SourceBadge key={`${s.org}-${s.reference}`} source={s.org as SourceOrg} reference={s.reference} url={s.url} title={s.title} />
              ))}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-5xl font-bold gradient-text">{currentScore}</div>
            <p className="text-xs text-text-muted mt-1">/100 today · target {targetScore}</p>
          </div>
        </div>
        <LevelScale current={currentLevel} target={targetLevel} />
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-text-muted">Current: <span className="text-foreground font-medium">{MATURITY_LABEL[currentLevel]}</span></span>
          <span className="text-text-muted">Gap: <span className="text-emerald-500 font-medium">{gapScore} pts ({result.gapLevels} level{result.gapLevels === 1 ? "" : "s"})</span></span>
          <span className="text-text-muted">Target: <span className="text-foreground font-medium">{MATURITY_LABEL[targetLevel]}</span></span>
        </div>
      </div>

      {/* How it works (collapsed) */}
      <HowItWorks
        title="How the maturity assessment works"
        steps={[
          { title: "Deterministic gap", body: "Your current and target levels map to a fixed score, and the gap drives the roadmap. The same inputs always give the same result; no AI is involved." },
          { title: "Levels and remediation from the framework", body: "Level descriptors, remediation actions and owners come from the control-area framework, mapped to JMLSG, FCA and (for sanctions) OFSI guidance." },
          { title: "AI-assisted summary", body: "Maturity Intelligence is written by an AI model from your levels; it explains the gap and does not add new facts. It is not legal advice." },
          { title: "Real enforcement", body: "The Evidence tab maps this area to real FCA enforcement cases, including the controls that would have caught each failure." },
        ]}
        provenance={[
          { label: "Control areas", value: `${allMaturityFrameworks.length} frameworks` },
          { label: "Enforcement cases", value: `${totalEnforcementCases} FCA fines` },
          { label: "Scoring", value: "Deterministic, level-based" },
          { label: "Frameworks", value: "JMLSG, FCA, OFSI" },
        ]}
        lastUpdated={enforcementBenchmarks.generatedAt}
      />

      <BenchmarkStrip />

      <KeyTerms terms={["three lines of defence", "MLRO", "transaction monitoring", "risk-based approach"]} />

      {/* Maturity Intelligence (AI-assisted, distinguished from cited fact) */}
      <NarrativeCard heading="Maturity Intelligence" narrative={narrative} loading={narrativeLoading} />

      <ResultTabs
        tabs={[
          {
            id: "controls",
            label: "Roadmap",
            icon: Layers,
            content: (
              <ResultsGrid>
                <ResultCard title="Remediation Roadmap" icon={Route} className="md:col-span-2" index={0}>
                  {remediation.length === 0 ? (
                    <p className="text-sm text-slate-600">You are already at or above your target maturity for this area.</p>
                  ) : (
                    <div className="space-y-3">
                      {remediation.map((r, i) => (
                        <div key={r.fromLevel + i} className="flex gap-3">
                          <div className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
                          <div>
                            <p className="font-medium text-slate-800 text-sm">{r.action}</p>
                            <div className="flex gap-3 mt-0.5">
                              <span className="text-xs text-accent">From {MATURITY_LABEL[r.fromLevel]}</span>
                              <span className="text-xs text-slate-400">Owner: {r.owner}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ResultCard>

                <ResultCard title="Maturity Levels" icon={Gauge} index={1}>
                  <div className="space-y-2">
                    {framework.levels.map((l) => {
                      const isCurrent = l.level === currentLevel;
                      const isTarget = l.level === targetLevel;
                      return (
                        <div key={l.level} className={`p-2.5 rounded-lg ${isCurrent ? "bg-emerald-50 border border-emerald-200" : "bg-slate-50"}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-800">{MATURITY_LABEL[l.level]}</span>
                            {isCurrent && <span className="text-[10px] uppercase text-emerald-600 font-semibold">Current</span>}
                            {isTarget && !isCurrent && <span className="text-[10px] uppercase text-accent font-semibold">Target</span>}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{l.descriptor}</p>
                        </div>
                      );
                    })}
                  </div>
                </ResultCard>

                <ResultCard title="Effectiveness Metrics" icon={BarChart3} index={2}>
                  <div className="space-y-3">
                    {framework.metrics.map((m) => (
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

                <ResultCard title="Governance Checklist" icon={ClipboardCheck} className="md:col-span-2" index={3}>
                  <div className="space-y-2">
                    {framework.governanceChecklist.map((g) => (
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
            content: <EvidencePanel themes={framework.riskThemes} />,
          },
          {
            id: "benchmarks",
            label: "Benchmarks",
            icon: ListChecks,
            content: <BenchmarksPanel />,
          },
        ]}
      />

      <NextSteps
        items={[
          { title: "Map AML typologies to controls", body: "See which typologies apply to your firm and the detection controls.", href: "/typology-iq", icon: Scale },
          { title: "Browse the Controls Library", body: "Controls grouped by risk theme, mapped to real enforcement.", href: "/controls", icon: Layers },
          { title: "Check KYC requirements", body: "What to collect by entity type and jurisdiction, each cited.", href: "/kyc-requirements", icon: ClipboardCheck },
        ]}
      />
    </div>
  );
}

export default function MaturityResultsPage() {
  return (
    <ToolFrame>
      <main className="flex-1">
        <Suspense fallback={<div className="text-center py-20 text-text-muted">Loading results...</div>}>
          <MaturityResults />
        </Suspense>
      </main>
      </ToolFrame>
  );
}
