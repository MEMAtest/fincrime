"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import {
  AlertTriangle, Users, Database, ClipboardCheck, FileText,
  ArrowLeft, Sparkles, ShieldAlert, CheckCircle, XCircle, Layers, Scale, BarChart3,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ResultCard from "@/components/results/ResultCard";
import ResultsGrid from "@/components/results/ResultsGrid";
import ResultTabs from "@/components/results/ResultTabs";
import EvidencePanel from "@/components/results/EvidencePanel";
import BenchmarksPanel from "@/components/results/BenchmarksPanel";
import BenchmarkStrip from "@/components/results/BenchmarkStrip";
import RiskRatingBadge from "@/components/shared/RiskRatingBadge";
import SourceBadge from "@/components/shared/SourceBadge";
import Badge from "@/components/ui/Badge";
import PDFExportButton from "@/components/shared/PDFExportButton";
import AiDisclosure from "@/components/shared/AiDisclosure";
import HowItWorks from "@/components/shared/HowItWorks";
import NextSteps from "@/components/shared/NextSteps";
import GlossaryTerm from "@/components/shared/GlossaryTerm";
import { totalEnforcementCases, enforcementBenchmarks } from "@/lib/enforcement/select";
import { scorePartnerRisk } from "@/data/scoring/partner-scoring";
import type { Actor, ControlOwnership, SourceOrg } from "@/data/partner-flows/types";
import type { RiskTheme } from "@/data/typologies/types";

// Partner payment flows carry these core financial-crime exposures
const PARTNER_THEMES: RiskTheme[] = ["money_laundering", "sanctions_evasion", "fraud"];

const actorLabels: Record<Actor, string> = {
  your_firm: "Your Firm",
  partner: "Partner",
  correspondent_bank: "Correspondent Bank",
  beneficiary_bank: "Beneficiary Bank",
  end_customer: "End Customer",
  platform_operator: "Platform Operator",
  fx_provider: "FX Provider",
};

function PartnerResults() {
  const searchParams = useSearchParams();
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);

  const answers = useMemo(() => {
    let controlOverrides: Record<string, ControlOwnership> = {};
    try {
      controlOverrides = JSON.parse(searchParams.get("controlOverrides") || "{}");
    } catch { /* ignore */ }

    return {
      modelType: searchParams.get("modelType") as "embedded" | "correspondent" | "marketplace",
      flowType: searchParams.get("flowType") as "cross_border_payout" | "api_payout" | "swift_payout" | "multi_currency_account" | "platform_payout",
      actors: (searchParams.get("actors") || "").split(",").filter(Boolean) as Actor[],
      controlOverrides,
      dataReceived: (searchParams.get("dataReceived") || "").split(",").filter(Boolean),
    };
  }, [searchParams]);

  const result = useMemo(() => {
    if (!answers.modelType || !answers.flowType) return null;
    return scorePartnerRisk(answers);
  }, [answers]);

  useEffect(() => {
    if (!result) return;
    setNarrativeLoading(true);
    fetch("/api/partner/narrative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        flowTitle: result.flow.title,
        flowDescription: result.flow.description,
        riskScore: result.riskScore,
        riskRating: result.riskRating,
        gapControls: result.gapControls,
        missingDataFields: result.missingDataFields,
        controlSummary: result.controlSummary,
        modelType: answers.modelType,
      }),
    })
      .then((res) => res.json())
      .then((data) => setNarrative(data.narrative || null))
      .catch(() => setNarrative(null))
      .finally(() => setNarrativeLoading(false));
  }, [result, answers.modelType]);

  if (!result) {
    return (
      <div className="text-center py-20">
        <p className="text-text-muted">Missing parameters. Please complete the wizard first.</p>
        <Link href="/partner-control-map" className="text-accent mt-4 inline-block">
          Start over
        </Link>
      </div>
    );
  }

  const { flow, riskScore, riskRating, gapControls, missingDataFields, controlSummary } = result;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/partner-control-map"
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to wizard
        </Link>
        <PDFExportButton
          module="partner_control_map"
          assessmentData={{ ...answers, narrative }}
        />
      </div>

      {/* Summary Banner */}
      <div className="glass-card rounded-2xl p-8 mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
              Partner Flow Assessment
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              {flow.title}
            </h1>
            <p className="text-text-muted text-sm max-w-2xl leading-relaxed mb-4">
              {flow.description}
            </p>
            <div className="flex flex-wrap gap-2">
              {flow.sources.map((s) => (
                <SourceBadge key={s.reference} source={s.org as SourceOrg} reference={s.reference} url={s.url} title={s.title} />
              ))}
            </div>
          </div>
          <div className="text-right shrink-0">
            <RiskRatingBadge level={riskRating} score={riskScore} />
          </div>
        </div>

        {/* Control Distribution */}
        <div className="grid grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="text-center">
            <div className="text-lg font-bold text-accent">{controlSummary.yourFirm}</div>
            <p className="text-xs text-text-muted">Your Firm</p>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-amber-400">{controlSummary.partner}</div>
            <p className="text-xs text-text-muted">Partner</p>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-400">{controlSummary.shared}</div>
            <p className="text-xs text-text-muted">Shared</p>
          </div>
          <div className="text-center">
            <div className={`text-lg font-bold ${controlSummary.gap > 0 ? "text-red-400" : "text-green-400"}`}>
              {controlSummary.gap}
            </div>
            <p className="text-xs text-text-muted">Gaps</p>
          </div>
        </div>
      </div>

      {/* How it works (collapsed) */}
      <HowItWorks
        title="How PartnerControlMap works"
        steps={[
          { title: "Deterministic risk score", body: "The score is computed from your control ownership and data gaps: unowned controls and missing data fields add the most, weighted for flow complexity and the number of actors. No AI is involved." },
          { title: "RACI and governance from the flow", body: "The RACI matrix, pre-launch conditions and governance pack come from the selected flow template, mapped to Wolfsberg, FATF and FCA guidance." },
          { title: "AI-assisted summary", body: "Flow Intelligence is written by an AI model from your configuration; it explains the result and does not add new facts. It is not legal advice." },
          { title: "Real enforcement", body: "The Evidence tab maps these risks to real FCA enforcement cases, including the controls that would have caught each failure." },
        ]}
        provenance={[
          { label: "Partner flows", value: "5 templated flows" },
          { label: "Enforcement cases", value: `${totalEnforcementCases} FCA fines` },
          { label: "Scoring", value: "Deterministic, weighted" },
          { label: "Frameworks", value: "Wolfsberg, FATF, FCA, JMLSG" },
        ]}
        lastUpdated={enforcementBenchmarks.generatedAt}
      />

      <BenchmarkStrip />

      {/* Key terms */}
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
        <span className="font-medium text-foreground">Key terms:</span>
        <GlossaryTerm term="correspondent banking" />
        <GlossaryTerm term="CDD" />
        <GlossaryTerm term="transaction monitoring" />
        <GlossaryTerm term="three lines of defence" />
      </div>

      {/* Flow Intelligence (AI-assisted, distinguished from cited fact) */}
      {(narrativeLoading || narrative) && (
        <div className="rounded-2xl border-l-2 border-accent/40 bg-accent/[0.03] p-6 mb-8">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Sparkles className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Flow Intelligence</h3>
            <AiDisclosure />
          </div>
          {narrativeLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-text-muted">Generating intelligence...</span>
            </div>
          ) : (
            <>
              <p className="text-sm text-text-muted leading-relaxed">{narrative}</p>
              <p className="mt-3 text-[11px] text-text-muted/70">AI-assisted summary of the deterministic result. Not legal advice; verify against the cited sources.</p>
            </>
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
        {/* Card 1: Risk Rating Breakdown */}
        <ResultCard title="Risk Rating Breakdown" icon={ShieldAlert} iconColor="text-red-500" className="md:col-span-2" index={0}>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span>Partner-owned controls</span>
              <span className="font-mono text-amber-600">{controlSummary.partner} x 5 = {controlSummary.partner * 5} pts</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span>Unowned controls (gaps)</span>
              <span className="font-mono text-red-600">{controlSummary.gap} x 10 = {controlSummary.gap * 10} pts</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span>Missing data fields</span>
              <span className="font-mono text-red-600">{missingDataFields.length} x 6 = {missingDataFields.length * 6} pts</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span>Flow complexity ({flow.modelType})</span>
              <span className="font-mono text-slate-600">
                {flow.modelType === "embedded" ? 10 : flow.modelType === "correspondent" ? 15 : 20} pts
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span>Actor count penalty</span>
              <span className="font-mono text-slate-600">{Math.max(0, answers.actors.length - 2)} x 4 = {Math.max(0, answers.actors.length - 2) * 4} pts</span>
            </div>
            <div className="flex items-center justify-between pt-3 mt-2 border-t-2 border-slate-200">
              <span className="font-semibold text-slate-800">Total Risk Score</span>
              <span className="font-mono font-bold text-lg">{riskScore}</span>
            </div>
          </div>
        </ResultCard>

        {/* Card 2: RACI Matrix */}
        <ResultCard title="RACI Matrix" icon={Users} className="md:col-span-2" index={1}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 pr-3 font-semibold text-slate-700">Activity</th>
                  <th className="text-center py-2 px-2 font-semibold text-slate-700">R</th>
                  <th className="text-center py-2 px-2 font-semibold text-slate-700">A</th>
                  <th className="text-center py-2 px-2 font-semibold text-slate-700">C</th>
                  <th className="text-center py-2 px-2 font-semibold text-slate-700">I</th>
                </tr>
              </thead>
              <tbody>
                {flow.raciTemplate.map((entry) => (
                  <tr key={entry.activity} className="border-b border-slate-100">
                    <td className="py-2 pr-3 text-slate-700">{entry.activity}</td>
                    <td className="text-center py-2 px-2">
                      <Badge variant="success">{actorLabels[entry.responsible]?.split(" ")[0] || entry.responsible}</Badge>
                    </td>
                    <td className="text-center py-2 px-2">
                      <Badge variant="info">{actorLabels[entry.accountable]?.split(" ")[0] || entry.accountable}</Badge>
                    </td>
                    <td className="text-center py-2 px-2">
                      {entry.consulted.map((c) => (
                        <Badge key={c} variant="default" className="mr-1">{actorLabels[c]?.split(" ")[0] || c}</Badge>
                      ))}
                    </td>
                    <td className="text-center py-2 px-2">
                      {entry.informed.map((i) => (
                        <Badge key={i} variant="default" className="mr-1">{actorLabels[i]?.split(" ")[0] || i}</Badge>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ResultCard>

        {/* Card 3: Data Gaps */}
        <ResultCard title="Data Gaps" icon={Database} iconColor={missingDataFields.length > 0 ? "text-red-500" : "text-green-500"} index={2}>
          {missingDataFields.length === 0 ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>All required data fields are received from the partner.</span>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-red-600 text-xs font-medium mb-2">
                {missingDataFields.length} required field{missingDataFields.length > 1 ? "s" : ""} missing:
              </p>
              {missingDataFields.map((f) => (
                <div key={f.id} className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                  <span className="text-slate-700">{f.field}</span>
                </div>
              ))}
            </div>
          )}

          {gapControls.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-red-600 text-xs font-medium mb-2">
                {gapControls.length} unowned control{gapControls.length > 1 ? "s" : ""}:
              </p>
              {gapControls.map((g) => (
                <div key={g.id} className="flex items-start gap-2 mt-1">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-slate-700">{g.control}</span>
                    <span className="text-xs text-slate-400 ml-2">{g.category}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ResultCard>

        {/* Card 4: Pre-Launch Conditions */}
        <ResultCard title="Pre-Launch Conditions" icon={ClipboardCheck} index={3}>
          <div className="space-y-2">
            {flow.preLaunchConditions.map((plc) => (
              <div key={plc.id} className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-0">
                <input type="checkbox" className="mt-1 rounded border-slate-300 text-accent focus:ring-accent" readOnly />
                <div>
                  <p className="text-sm text-slate-700">{plc.condition}</p>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-xs text-accent">{plc.category}</span>
                    <span className="text-xs text-slate-400">{plc.evidence}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ResultCard>

        {/* Card 5: Governance Pack */}
        <ResultCard title="Governance Pack" icon={FileText} className="md:col-span-2" index={4}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 font-semibold text-slate-700">Document</th>
                  <th className="text-left py-2 font-semibold text-slate-700">Frequency</th>
                  <th className="text-left py-2 font-semibold text-slate-700">Owner</th>
                </tr>
              </thead>
              <tbody>
                {flow.governancePack.map((gp) => (
                  <tr key={gp.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 text-slate-700">{gp.document}</td>
                    <td className="py-2 text-accent">{gp.frequency}</td>
                    <td className="py-2 text-slate-500">{gp.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ResultCard>
      </ResultsGrid>
              </>
            ),
          },
          {
            id: "evidence",
            label: "Evidence",
            icon: Scale,
            content: <EvidencePanel themes={PARTNER_THEMES} />,
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
          { title: "Map AML typologies to controls", body: "See which typologies apply to your firm and the detection controls.", href: "/typology-iq", icon: Scale },
          { title: "Browse the Controls Library", body: "Controls grouped by risk theme, mapped to real enforcement.", href: "/controls", icon: Layers },
          { title: "Check KYC requirements", body: "What to collect by entity type and jurisdiction, each cited.", href: "/kyc-requirements", icon: ClipboardCheck },
        ]}
      />
    </div>
  );
}

export default function PartnerResultsPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Suspense fallback={<div className="text-center py-20 text-text-muted">Loading results...</div>}>
          <PartnerResults />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
