"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, Suspense } from "react";
import Link from "next/link";
import {
  Target, Database, SlidersHorizontal, Cpu, GitBranch, BarChart3,
  ClipboardCheck, ArrowLeft, Layers, Scale, ShieldCheck,
} from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import ResultCard from "@/components/results/ResultCard";
import ResultsGrid from "@/components/results/ResultsGrid";
import ResultTabs from "@/components/results/ResultTabs";
import EvidencePanel from "@/components/results/EvidencePanel";
import BenchmarksPanel from "@/components/results/BenchmarksPanel";
import BenchmarkStrip from "@/components/results/BenchmarkStrip";
import SourceBadge from "@/components/shared/SourceBadge";
import Badge from "@/components/ui/Badge";
import PDFExportButton from "@/components/shared/PDFExportButton";
import NarrativeCard from "@/components/results/NarrativeCard";
import KeyTerms from "@/components/shared/KeyTerms";
import HowItWorks from "@/components/shared/HowItWorks";
import NextSteps from "@/components/shared/NextSteps";
import { useNarrative } from "@/lib/useNarrative";
import { allScreeningControls } from "@/data/screening";
import { totalEnforcementCases, enforcementBenchmarks } from "@/lib/enforcement/select";
import { getBestScreeningMatch } from "@/data/scoring/screening-scoring";
import { SCREENING_CATEGORY_LABEL, SCREENING_TRIGGER_LABEL } from "@/data/screening/types";
import { FIRM_TYPE_LABEL } from "@/data/typologies/labels";
import type { ScreeningCategory, ScreeningTrigger } from "@/data/screening/types";
import type { FirmType, SourceOrg } from "@/data/typologies/types";

function ScreeningResults() {
  const searchParams = useSearchParams();

  const answers = useMemo(() => {
    const rawFirm = searchParams.get("firmType") ?? "";
    return {
      // Validate firmType against the enum so a stale/hand-edited deep link can't
      // push junk into the scorer or the narrative API.
      firmType: (rawFirm in FIRM_TYPE_LABEL ? rawFirm : "") as FirmType,
      category: searchParams.get("category") as ScreeningCategory,
      trigger: searchParams.get("trigger") as ScreeningTrigger,
    };
  }, [searchParams]);

  const result = useMemo(() => {
    if (!answers.firmType || !answers.category || !answers.trigger) return null;
    return getBestScreeningMatch(answers);
  }, [answers]);

  const { narrative, loading: narrativeLoading } = useNarrative(
    "/api/screening/narrative",
    result
      ? {
          controlTitle: result.control.title,
          controlObjective: result.control.controlObjective,
          category: answers.category,
          firmType: answers.firmType,
          trigger: answers.trigger,
          score: result.score,
        }
      : null
  );

  if (!result) {
    return (
      <div className="text-center py-20">
        <p className="text-text-muted">Missing parameters. Please complete the wizard first.</p>
        <Link href="/screening-control-designer" className="text-accent mt-4 inline-block">Start over</Link>
      </div>
    );
  }

  const { control, score } = result;
  const priorityVariant = (p: string) =>
    p === "critical" ? ("danger" as const) : p === "high" ? ("warning" as const) : p === "medium" ? ("info" as const) : ("default" as const);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <Link href="/screening-control-designer" className="flex items-center gap-1.5 text-sm text-text-muted hover:text-accent transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to wizard
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={`/control-builder?control=${control.slug}${answers.firmType ? `&firmType=${answers.firmType}` : ""}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Add to register
          </Link>
          <PDFExportButton module="screening_controls" assessmentData={{ ...answers, narrative }} />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-xs font-medium">
          {SCREENING_CATEGORY_LABEL[answers.category]}
        </span>
        <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-surface border border-surface-border text-xs font-medium text-foreground">
          {SCREENING_TRIGGER_LABEL[answers.trigger]}
        </span>
      </div>

      <div className="glass-card rounded-2xl p-8 mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Recommended control · Score {score}/100</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{control.title}</h1>
            <p className="text-text-muted text-sm max-w-2xl leading-relaxed">{control.description}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {control.sources.map((s) => (
                <SourceBadge key={`${s.org}-${s.reference}`} source={s.org as SourceOrg} reference={s.reference} url={s.url} title={s.title} />
              ))}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-5xl font-bold gradient-text">{score}</div>
            <p className="text-xs text-text-muted mt-1">/100 match</p>
          </div>
        </div>
      </div>

      {/* How it works (collapsed) */}
      <HowItWorks
        title="How the Screening Control Designer works"
        steps={[
          { title: "Deterministic match", body: "Your screening type, firm type and trigger select the best-fit control by a fixed weighted score. The same inputs always give the same result; no AI is involved." },
          { title: "Cited configuration", body: "The matching configuration, detection logic and workflow map to authoritative sources (OFSI, JMLSG, FCA, Wolfsberg). Open any source badge to read and copy the reference." },
          { title: "AI-assisted summary", body: "Screening Intelligence is written by an AI model from your selections; it explains the recommended control and does not add new facts. It is not legal advice." },
          { title: "Real enforcement", body: "The Evidence tab maps the risk to real FCA enforcement cases, including the controls that would have caught each failure." },
        ]}
        provenance={[
          { label: "Screening controls", value: `${allScreeningControls.length} controls` },
          { label: "Enforcement cases", value: `${totalEnforcementCases} FCA fines` },
          { label: "Scoring", value: "Deterministic, weighted" },
          { label: "Frameworks", value: "OFSI, JMLSG, FCA, Wolfsberg" },
        ]}
        lastUpdated={enforcementBenchmarks.generatedAt}
      />

      <BenchmarkStrip />

      <KeyTerms terms={["sanctions screening", "PEP", "EDD", "red-flag indicator"]} />

      {/* Screening Intelligence (AI-assisted, distinguished from cited fact) */}
      <NarrativeCard heading="Screening Intelligence" narrative={narrative} loading={narrativeLoading} />

      <ResultTabs
        tabs={[
          {
            id: "controls",
            label: "Controls",
            icon: Layers,
            content: (
              <ResultsGrid>
                <ResultCard title="Control Objective" icon={Target} className="md:col-span-2" index={0}>
                  <p className="leading-relaxed">{control.controlObjective}</p>
                </ResultCard>

                <ResultCard title="Data Inputs" icon={Database} index={1}>
                  <ul className="space-y-2">
                    {control.dataInputs.map((d) => (
                      <li key={d} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </ResultCard>

                <ResultCard title="Matching Configuration" icon={SlidersHorizontal} index={2}>
                  <div className="space-y-3">
                    {control.matchingConfig.map((m) => (
                      <div key={m.aspect} className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-slate-800 text-sm">{m.aspect}</span>
                          {m.source && <span className="text-xs text-accent">{m.source}</span>}
                        </div>
                        <p className="text-xs text-slate-500">{m.guidance}</p>
                      </div>
                    ))}
                  </div>
                </ResultCard>

                <ResultCard title="Detection Logic" icon={Cpu} index={3}>
                  <div className="space-y-3">
                    {control.detectionLogic.map((r) => (
                      <div key={r.id} className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs text-slate-400">{r.id}</span>
                          <Badge variant={priorityVariant(r.priority)}>{r.priority}</Badge>
                        </div>
                        <p className="font-medium text-slate-800 text-sm mb-1">{r.name}</p>
                        <p className="text-xs text-slate-500">{r.logic}</p>
                        {r.threshold && <p className="text-xs text-accent mt-1">Threshold: {r.threshold}</p>}
                      </div>
                    ))}
                  </div>
                </ResultCard>

                <ResultCard title="Escalation Workflow" icon={GitBranch} index={4}>
                  <div className="space-y-3">
                    {control.escalationWorkflow.map((w) => (
                      <div key={w.step} className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold shrink-0">{w.step}</div>
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{w.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{w.description}</p>
                          <div className="flex gap-3 mt-1">
                            {w.sla && <span className="text-xs text-accent">SLA: {w.sla}</span>}
                            <span className="text-xs text-slate-400">{w.owner}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ResultCard>

                <ResultCard title="Effectiveness Metrics" icon={BarChart3} index={5}>
                  <div className="space-y-3">
                    {control.metrics.map((m) => (
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

                <ResultCard title="Governance Checklist" icon={ClipboardCheck} className="md:col-span-2" index={6}>
                  <div className="space-y-2">
                    {control.governanceChecklist.map((g) => (
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
            content: <EvidencePanel themes={control.riskThemes} />,
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
          {
            title: "Add this control to your register",
            body: `Open ${control.title} in the Control Builder, set thresholds and owners, then export.`,
            href: `/control-builder?control=${control.slug}${answers.firmType ? `&firmType=${answers.firmType}` : ""}`,
            icon: ShieldCheck,
          },
          { title: "Map AML typologies to controls", body: "See which typologies apply to your firm and the detection controls.", href: "/typology-iq", icon: Scale },
          { title: "Browse the Controls Library", body: "Controls grouped by risk theme, mapped to real enforcement.", href: "/controls", icon: Layers },
          { title: "Check KYC requirements", body: "What to collect by entity type and jurisdiction, each cited.", href: "/kyc-requirements", icon: ClipboardCheck },
        ]}
      />
    </div>
  );
}

export default function ScreeningResultsPage() {
  return (
    <ToolFrame>
      <main className="flex-1">
        <Suspense fallback={<div className="text-center py-20 text-text-muted">Loading results...</div>}>
          <ScreeningResults />
        </Suspense>
      </main>
      </ToolFrame>
  );
}
