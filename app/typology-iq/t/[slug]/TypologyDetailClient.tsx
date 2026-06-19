"use client";

import Link from "next/link";
import { Target, Database, Cpu, GitBranch, BarChart3, ClipboardCheck, BookOpen, Scale, Layers, Link2 } from "lucide-react";
import ResultCard from "@/components/results/ResultCard";
import ResultsGrid from "@/components/results/ResultsGrid";
import ResultTabs from "@/components/results/ResultTabs";
import EvidencePanel from "@/components/results/EvidencePanel";
import SourceBadge from "@/components/shared/SourceBadge";
import KeyTerms from "@/components/shared/KeyTerms";
import NextSteps from "@/components/shared/NextSteps";
import Badge from "@/components/ui/Badge";
import RiskThemeIcon, { THEME_CONFIG } from "@/components/icons/RiskThemeIcon";
import { allTypologies } from "@/data/typologies";
import { FIRM_TYPE_LABEL, PRODUCT_LABEL, CUSTOMER_LABEL } from "@/data/typologies/labels";
import type { Typology, SourceOrg } from "@/data/typologies/types";

const priorityVariant = (p: string) =>
  p === "critical" ? ("danger" as const) : p === "high" ? ("warning" as const) : p === "medium" ? ("info" as const) : ("default" as const);

function Chips({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-text-muted">{label}</span>
      {values.map((v) => (
        <span key={v} className="inline-flex items-center px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.03] text-[11px] text-foreground">
          {v}
        </span>
      ))}
    </div>
  );
}

export default function TypologyDetailClient({ typology }: { typology: Typology }) {
  const cfg = THEME_CONFIG[typology.riskTheme];
  const related = allTypologies
    .filter((t) => t.riskTheme === typology.riskTheme && t.slug !== typology.slug)
    .slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Link href="/typology-iq/list" className="flex items-center gap-1.5 text-sm text-text-muted hover:text-accent transition-colors">
          <Layers className="h-4 w-4" /> All typologies
        </Link>
      </div>

      <div className="glass-card rounded-2xl p-8 mb-8">
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            <RiskThemeIcon riskTheme={typology.riskTheme} size="md" animated={false} />
          </div>
          <div className="min-w-0">
            <span className="inline-block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: cfg.primary }}>
              {cfg.label}
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{typology.title}</h1>
            <p className="text-text-muted text-sm max-w-3xl leading-relaxed">{typology.description}</p>
          </div>
        </div>
        <div className="mt-5 pt-5 border-t border-white/10 space-y-2">
          <Chips label="Firm types" values={typology.applicableFirmTypes.map((f) => FIRM_TYPE_LABEL[f] ?? f)} />
          <Chips label="Products" values={typology.applicableProducts.map((p) => PRODUCT_LABEL[p] ?? p)} />
          <Chips label="Customers" values={typology.applicableCustomerTypes.map((c) => CUSTOMER_LABEL[c] ?? c)} />
        </div>
      </div>

      <KeyTerms terms={["typology", "transaction monitoring", "SAR", "EDD", "red-flag indicator"]} />

      <ResultTabs
        tabs={[
          {
            id: "overview",
            label: "Overview",
            icon: Target,
            content: (
              <ResultsGrid>
                <ResultCard title="What it is" icon={BookOpen} className="md:col-span-2" index={0}>
                  <p className="leading-relaxed">{typology.description}</p>
                </ResultCard>
                <ResultCard title="Control objective" icon={Target} className="md:col-span-2" index={1}>
                  <p className="leading-relaxed">{typology.controlObjective}</p>
                </ResultCard>
                <ResultCard title="Data required" icon={Database} className="md:col-span-2" index={2}>
                  <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                    {typology.dataRequired.map((d) => (
                      <li key={d} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </ResultCard>
              </ResultsGrid>
            ),
          },
          {
            id: "detection",
            label: "Red flags & detection",
            icon: Cpu,
            content: (
              <ResultsGrid>
                <ResultCard title="Detection logic" icon={Cpu} className="md:col-span-2" index={0}>
                  <div className="space-y-3">
                    {typology.detectionLogic.map((r) => (
                      <div key={r.id} className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs text-slate-400">{r.id}</span>
                          <Badge variant={priorityVariant(r.priority)}>{r.priority}</Badge>
                        </div>
                        <p className="font-medium text-slate-800 text-sm mb-1">{r.name}</p>
                        <p className="text-xs text-slate-500">{r.logic}</p>
                        {r.threshold ? <p className="text-xs text-accent mt-1">Threshold: {r.threshold}</p> : null}
                      </div>
                    ))}
                  </div>
                </ResultCard>
              </ResultsGrid>
            ),
          },
          {
            id: "workflow",
            label: "Workflow & governance",
            icon: GitBranch,
            content: (
              <ResultsGrid>
                <ResultCard title="Investigation workflow" icon={GitBranch} className="md:col-span-2" index={0}>
                  <div className="space-y-3">
                    {typology.workflowSteps.map((w) => (
                      <div key={w.step} className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold shrink-0">{w.step}</div>
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{w.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{w.description}</p>
                          <div className="flex gap-3 mt-1">
                            {w.sla ? <span className="text-xs text-accent">SLA: {w.sla}</span> : null}
                            <span className="text-xs text-slate-400">{w.responsible}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ResultCard>
                <ResultCard title="Effectiveness metrics" icon={BarChart3} index={1}>
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
                <ResultCard title="Governance checklist" icon={ClipboardCheck} index={2}>
                  <div className="space-y-2">
                    {typology.governanceChecklist.map((g) => (
                      <div key={g.id} className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-0">
                        <ClipboardCheck className="h-4 w-4 text-accent mt-0.5 shrink-0" />
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
            label: "Evidence & sources",
            icon: Scale,
            content: (
              <div className="space-y-8">
                <EvidencePanel themes={[typology.riskTheme]} typology={typology} />
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="h-5 w-5 text-emerald-500" />
                    <h3 className="text-lg font-semibold text-foreground">Primary sources for this typology</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {typology.sources.map((s) => (
                      <SourceBadge key={`${s.org}-${s.reference}`} source={s.org as SourceOrg} reference={s.reference} url={s.url} title={s.title} />
                    ))}
                  </div>
                </section>
              </div>
            ),
          },
        ]}
      />

      {related.length > 0 && (
        <div className="mt-10">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-accent" /> Related typologies ({cfg.label})
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {related.map((t) => (
              <Link key={t.slug} href={`/typology-iq/t/${t.slug}`} className="glass-card rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition-colors">
                <div className="shrink-0">
                  <RiskThemeIcon riskTheme={t.riskTheme} size="sm" animated={false} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                  <p className="text-xs text-text-muted line-clamp-2 mt-0.5">{t.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <NextSteps
        items={[
          { title: "Run this in TypologyIQ", body: "Score your firm against this and related typologies and build the controls.", href: `/typology-iq?riskThemes=${typology.riskTheme}`, icon: Scale },
          { title: "Browse the catalogue", body: "All financial crime typologies, filterable by risk theme.", href: "/typology-iq/list", icon: Layers },
          { title: "See the controls", body: "Detection rules, workflows and governance grouped by risk theme.", href: "/controls", icon: ClipboardCheck },
        ]}
      />
    </div>
  );
}
