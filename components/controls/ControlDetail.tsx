"use client";

import { Sparkles, FileText, Scale, ShieldCheck, FlaskConical, BookOpen, ExternalLink, ArrowUpRight, Check, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import ResultTabs from "@/components/results/ResultTabs";
import SourceBadge from "@/components/shared/SourceBadge";
import GlossaryText from "@/components/shared/GlossaryText";
import RiskThemeIcon, { THEME_CONFIG } from "@/components/icons/RiskThemeIcon";
import { RISK_THEME_LABEL } from "@/data/typologies/labels";
import { RatingSelect, MaturityBar } from "@/components/controls/ControlBits";
import { getTypologyBySlug } from "@/data/typologies";
import { caseSlug } from "@/lib/enforcement/case-slug";
import { fmtGbp, findEnforcementCase } from "@/lib/enforcement/select";
import { lessonFor } from "@/data/enforcement/lessons";
import type { Control, ControlOverride, ControlRating } from "@/data/controls/types";
import type { SourceOrg } from "@/data/typologies/types";

const label = "text-[11px] uppercase tracking-wider text-text-muted";
const input = "w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-surface-border text-sm text-foreground focus:outline-none focus:border-accent";

export default function ControlDetail({
  control: c,
  override,
  onChange,
  onOpenTypology,
  tested,
  onToggleTest,
  readOnly = false,
}: {
  control: Control;
  override: ControlOverride;
  onChange: (next: ControlOverride) => void;
  onOpenTypology?: (slug: string) => void;
  tested: number[];
  onToggleTest: (idx: number) => void;
  readOnly?: boolean;
}) {
  const [showReg, setShowReg] = useState(false);
  const set = (patch: Partial<ControlOverride>) => onChange({ ...override, ...patch });
  const owner = override.firstLineOwner ?? c.firstLineOwner;
  const secondOwner = override.secondLineOwner ?? c.secondLineOwner;
  const frequency = override.frequency ?? c.reviewCadence;
  const threshold = override.threshold ?? c.defaultThreshold;
  const system = override.system ?? c.suggestedSystems.join("; ");
  const maturity = override.maturityLevel ?? 0;
  const design = override.designEffectiveness ?? "not_assessed";
  const operating = override.operatingEffectiveness ?? "not_assessed";
  const overall = override.overallRating ?? "not_assessed";

  const linkedTypologies = c.typologySlugs.map(getTypologyBySlug).filter(Boolean) as NonNullable<ReturnType<typeof getTypologyBySlug>>[];
  const cases = c.enforcementRefs.map((r) => findEnforcementCase(r.firm, r.year)).filter(Boolean) as NonNullable<ReturnType<typeof findEnforcementCase>>[];

  const evidenceTab = (
    <div className="space-y-6">
      <section>
        <div className="flex items-center gap-2 mb-2"><Scale className="h-4 w-4 text-accent" /><h4 className="text-sm font-semibold text-foreground">Enforcement precedent</h4></div>
        {cases.length ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {cases.map((ec) => {
              const lesson = lessonFor(ec.firm, ec.year);
              return (
                <Link key={`${ec.firm}-${ec.year}`} href={`/enforcement/${caseSlug(ec.firm, ec.year)}`} className="glass-card rounded-xl p-3 card-hover block">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-foreground leading-tight line-clamp-2">{ec.firm}</span>
                    <span className="text-sm font-bold text-accent shrink-0 tabular-nums">{fmtGbp(ec.amountGbp)}</span>
                  </div>
                  <span className="text-xs text-text-muted">{ec.regulator} · {ec.year}</span>
                  {lesson && (
                    <p className="text-xs text-text-muted mt-1.5 leading-relaxed line-clamp-2">
                      {lesson.rootCause}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        ) : <p className="text-sm text-text-muted">No enforcement case is mapped to this control yet.</p>}
      </section>
      <section>
        <div className="flex items-center gap-2 mb-2"><BookOpen className="h-4 w-4 text-accent" /><h4 className="text-sm font-semibold text-foreground">Cited sources</h4></div>
        <div className="flex flex-wrap gap-2">
          {c.sources.map((s) => <SourceBadge key={`${s.org}-${s.reference}`} source={s.org as SourceOrg} reference={s.reference} url={s.url} title={s.title} />)}
        </div>
      </section>
    </div>
  );

  const linkedTab = (
    <div className="space-y-2">
      <p className="text-sm text-text-muted mb-1">The financial crime typologies this control mitigates.</p>
      {linkedTypologies.map((t) => {
        const cfg = THEME_CONFIG[t.riskTheme];
        const cls = "w-full text-left glass-card rounded-xl p-3 card-hover flex items-start gap-3";
        const inner = (
          <>
            <RiskThemeIcon riskTheme={t.riskTheme} size="sm" animated={false} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-sm font-medium text-foreground leading-tight">
                <span className="truncate">{t.title}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              </span>
              <span className="inline-block mt-1 text-[10px] uppercase tracking-wider font-medium" style={{ color: cfg.primary }}>{RISK_THEME_LABEL[t.riskTheme]}</span>
            </span>
          </>
        );
        return onOpenTypology
          ? <button key={t.slug} onClick={() => onOpenTypology(t.slug)} className={cls}>{inner}</button>
          : <Link key={t.slug} href={`/typology-iq/t/${t.slug}`} className={cls}>{inner}</Link>;
      })}
      {linkedTypologies.length === 0 && <p className="text-sm text-text-muted">No typologies linked.</p>}
    </div>
  );

  const testingTab = readOnly ? (
    <div>
      <p className="text-sm text-text-muted mb-3">The authored test plan for this control. Open it in the Control Builder to work through and mark each step.</p>
      <ol className="space-y-2">
        {c.testPlan.map((step, i) => (
          <li key={i} className="flex items-start gap-2.5 rounded-lg border border-surface-border p-3">
            <span className="mt-0.5 h-5 w-5 rounded-full bg-accent/10 text-accent flex items-center justify-center text-[11px] font-semibold shrink-0">{i + 1}</span>
            <span className="text-sm text-foreground">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  ) : (
    <div>
      <p className="text-sm text-text-muted mb-3">Work through the test plan and mark each step as tested. Tracked in this session.</p>
      <ol className="space-y-2">
        {c.testPlan.map((step, i) => {
          const done = tested.includes(i);
          return (
            <li key={i}>
              <button onClick={() => onToggleTest(i)} className={`w-full text-left flex items-start gap-2.5 rounded-lg border p-3 transition-colors ${done ? "border-accent/40 bg-accent/[0.06]" : "border-surface-border hover:bg-surface-hover"}`}>
                <span className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${done ? "border-accent bg-accent text-white" : "border-surface-border"}`}>{done && <Check className="h-3 w-3" />}</span>
                <span className={`text-sm ${done ? "text-text-muted line-through" : "text-foreground"}`}>{step}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-text-muted">{tested.length} of {c.testPlan.length} steps tested.</p>
    </div>
  );

  const documentsTab = (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">The supporting artefacts for this control. Attach your own evidence documents; they are captured when you export the register.</p>
      <div className="glass-card rounded-xl p-3 flex items-center gap-3"><FlaskConical className="h-4 w-4 text-accent" /><span className="text-sm text-foreground">Test plan ({c.testPlan.length} steps)</span></div>
      <div className="glass-card rounded-xl p-3 flex items-center gap-3"><BookOpen className="h-4 w-4 text-accent" /><span className="text-sm text-foreground">{c.sources.length} cited sources</span></div>
      <div className="glass-card rounded-xl p-3 flex items-center gap-3"><ExternalLink className="h-4 w-4 text-accent" /><span className="text-sm text-foreground">{cases.length} enforcement precedent{cases.length === 1 ? "" : "s"}</span></div>
    </div>
  );

  const overviewTab = (
    <div className="grid lg:grid-cols-[1fr_300px] gap-6">
      {/* Main */}
      <div className="space-y-5">
        {readOnly ? (
          /* Plain-first read view: plain-English scaffolding up top, the verbatim
             cited/regulatory wording tucked behind an expander (nothing removed). */
          <div className="space-y-5">
            <div>
              <p className={label}>What it is</p>
              <p className="text-sm text-text-muted leading-relaxed mt-1"><GlossaryText>{c.plainSummary}</GlossaryText></p>
            </div>
            <div>
              <p className={label}>What it&apos;s for</p>
              <p className="text-sm text-foreground leading-relaxed mt-1"><GlossaryText>{c.plainObjective ?? c.objective}</GlossaryText></p>
            </div>
            <div>
              <p className={label}>{c.controlType === "detective" ? "How it spots things" : "How it works"}</p>
              <p className="text-sm text-text-muted leading-relaxed mt-1"><GlossaryText>{c.plainHowItWorks ?? c.ruleLogic}</GlossaryText></p>
            </div>
            <div>
              <p className={label}>Why this threshold</p>
              <p className="text-sm text-text-muted leading-relaxed mt-1"><GlossaryText>{c.plainWhyThreshold ?? c.thresholdRationale}</GlossaryText></p>
              <span className="inline-block mt-1.5 text-xs font-mono px-2 py-0.5 rounded bg-accent/10 text-accent">Default: {threshold}</span>
            </div>

            {/* Regulatory detail: the exact cited wording and calibration fields. */}
            <div className="rounded-xl border border-surface-border overflow-hidden">
              <button
                onClick={() => setShowReg((s) => !s)}
                aria-expanded={showReg}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <span className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Scale className="h-4 w-4 text-text-muted" /> Regulatory detail
                </span>
                {showReg ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
              </button>
              {showReg && (
                <div className="px-4 pb-4 space-y-3 border-t border-surface-border pt-3">
                  {([
                    ["Control objective", c.objective],
                    ["Rule logic", c.ruleLogic],
                    ["Threshold rationale", c.thresholdRationale],
                    ["Lookback window", c.lookbackWindow],
                    ["Tuning", c.tuningNotes],
                    ["Escalation", c.escalation],
                    ["SLA", c.sla],
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k}><p className={label}>{k}</p><p className="text-sm text-text-muted leading-relaxed mt-0.5">{v}</p></div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div>
              <p className={label}>What it is</p>
              <p className="text-sm text-text-muted leading-relaxed mt-1"><GlossaryText>{c.plainSummary}</GlossaryText></p>
            </div>
            <div>
              <p className={label}>Control objective</p>
              <p className="text-sm text-foreground leading-relaxed mt-1">{c.plainObjective ?? c.objective}</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <label className="block"><span className={label}>Owner</span>
                <input className={input} value={owner} onChange={(e) => set({ firstLineOwner: e.target.value })} /></label>
              <label className="block"><span className={label}>Frequency</span>
                <input className={input} value={frequency} onChange={(e) => set({ frequency: e.target.value })} /></label>
              <div>
                <span className={label}>Maturity</span>
                <div className="mt-1 flex items-center gap-2">
                  <select value={maturity} onChange={(e) => set({ maturityLevel: Number(e.target.value) })} className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-surface-border text-sm text-foreground focus:outline-none focus:border-accent">
                    <option value={0}>Not set</option>
                    {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>Level {l}</option>)}
                  </select>
                  <MaturityBar level={maturity} />
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div><span className={label}>Design effectiveness</span><div className="mt-1"><RatingSelect value={design} onChange={(r) => set({ designEffectiveness: r })} /></div></div>
              <div><span className={label}>Operating effectiveness</span><div className="mt-1"><RatingSelect value={operating} onChange={(r) => set({ operatingEffectiveness: r })} /></div></div>
              <div><span className={label}>Overall rating</span><div className="mt-1"><RatingSelect value={overall} onChange={(r) => set({ overallRating: r as ControlRating })} /></div></div>
            </div>

            <label className="block"><span className={label}>Threshold</span><span className="block text-[11px] text-text-muted/70 mb-1">{c.thresholdRationale}</span>
              <textarea rows={2} className={input} value={threshold} onChange={(e) => set({ threshold: e.target.value })} /></label>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block"><span className={label}>Second-line owner</span><input className={input} value={secondOwner} onChange={(e) => set({ secondLineOwner: e.target.value })} /></label>
              <label className="block"><span className={label}>System / tooling</span><input className={input} value={system} onChange={(e) => set({ system: e.target.value })} /></label>
              <label className="block"><span className={label}>Last reviewed</span><input className={input} placeholder="e.g. 20 May 2024" value={override.lastReviewed ?? ""} onChange={(e) => set({ lastReviewed: e.target.value })} /></label>
              <label className="block"><span className={label}>Next review</span><input className={input} placeholder="e.g. 20 Aug 2024" value={override.nextReview ?? ""} onChange={(e) => set({ nextReview: e.target.value })} /></label>
            </div>

            <label className="block"><span className={label}>Firm notes</span>
              <textarea rows={2} className={input} placeholder="Scope, exceptions, dependencies" value={override.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} /></label>
          </>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <div className="rounded-xl border border-accent/20 bg-accent/[0.05] p-3">
          <div className="flex items-center gap-1.5 mb-1.5"><Sparkles className="h-3.5 w-3.5 text-accent" /><span className="text-xs font-semibold text-accent">Tuning guidance</span></div>
          <p className="text-xs text-text-muted leading-relaxed">{c.tuningNotes}</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5"><span className={label}>What good looks like</span></div>
          <ul className="space-y-1">
            {c.whatGoodLooksLike.map((g, i) => (
              <li key={i} className="text-xs text-text-muted flex gap-1.5"><ShieldCheck className="h-3 w-3 text-accent mt-0.5 shrink-0" /><span>{g}</span></li>
            ))}
          </ul>
        </div>
        <div>
          <p className={label}>Linked risks</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {c.riskThemes.map((t) => {
              const cfg = THEME_CONFIG[t];
              return <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${cfg.glow}20`, color: cfg.primary }}>{RISK_THEME_LABEL[t]}</span>;
            })}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <ResultTabs
      tabs={[
        { id: "overview", label: "Overview", icon: FileText, content: overviewTab },
        { id: "evidence", label: `Evidence (${c.sources.length + cases.length})`, icon: BookOpen, content: evidenceTab },
        { id: "linked", label: `Linked Risks (${linkedTypologies.length})`, icon: ShieldCheck, content: linkedTab },
        { id: "testing", label: `Testing (${c.testPlan.length})`, icon: FlaskConical, content: testingTab },
        { id: "documents", label: "Documents", icon: ExternalLink, content: documentsTab },
      ]}
    />
  );
}
