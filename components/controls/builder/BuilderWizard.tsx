"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Check, ChevronDown, ChevronRight, Search, Plus, Lightbulb,
  Gauge, BookOpen, Link2, History, Scale, ShieldCheck, X,
} from "lucide-react";
import { StatusSelect, isOverrideSet } from "@/components/controls/ControlBits";
import { allControls, CONTROL_CATEGORY_ORDER, CONTROL_CATEGORY_LABEL, controlsForThemes } from "@/data/controls";
import { caseSlug } from "@/lib/enforcement/case-slug";
import { fmtGbp, countCasesForThemes, totalPenaltiesForThemes, findEnforcementCase } from "@/lib/enforcement/select";
import type { Control, ControlOverride, ControlStatus } from "@/data/controls/types";
import type { SourceOrg, RiskTheme } from "@/data/typologies/types";

const STEPS = ["Scope", "Objective", "Procedure", "Evidence", "Testing", "Ownership", "Approval"] as const;
type Step = (typeof STEPS)[number];

const OBJECTIVES = [
  "Prevent Money Laundering (AML)", "Prevent Terrorist Financing (CFT)", "Know Your Customer (KYC)",
  "Sanctions Compliance", "Consumer Protection", "Fraud Prevention", "Market Integrity",
];

const THEME_OBJECTIVE: Partial<Record<RiskTheme, string>> = {
  money_laundering: "Prevent Money Laundering (AML)",
  terrorist_financing: "Prevent Terrorist Financing (CFT)",
  sanctions_evasion: "Sanctions Compliance",
  fraud: "Fraud Prevention",
};

const ORG_REGION: Record<SourceOrg, string> = {
  FATF: "INTL", Wolfsberg: "INTL", FCA: "UK", JMLSG: "UK", OFSI: "UK", MLR: "UK",
  FinCEN: "US", EU: "EU", BaFin: "EU", ACPR: "EU", AMF: "EU", MAS: "SG", HKMA: "HK", SFC: "HK",
};

const label = "text-[11px] uppercase tracking-wider text-text-muted";
const inputCls = "w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-surface-border text-sm text-foreground focus:outline-none focus:border-accent";

export default function BuilderWizard({
  control: c,
  override,
  setOverride,
  resetOverride,
  tested,
  onToggleTest,
  registerSlugs,
  onSelectControl,
  onAddToRegister,
  onBackToRegister,
  onAdd,
}: {
  control: Control;
  override: ControlOverride;
  setOverride: (patch: Partial<ControlOverride>) => void;
  resetOverride: () => void;
  tested: number[];
  onToggleTest: (idx: number) => void;
  registerSlugs: string[];
  onSelectControl: (slug: string) => void;
  onAddToRegister: () => void;
  onBackToRegister: () => void;
  onAdd: () => void;
}) {
  const [step, setStep] = useState<Step>("Scope");
  const [libTab, setLibTab] = useState<"categories" | "mine">("categories");
  const [libSearch, setLibSearch] = useState("");
  const [openCats, setOpenCats] = useState<Set<string>>(new Set([c.category]));
  const [moreSug, setMoreSug] = useState(false);

  const stepIdx = STEPS.indexOf(step);
  const status: ControlStatus = override.status ?? "not_started";
  const controlId = `CTL-${String(c.id).padStart(3, "0")}`;

  const derivedObjectives = useMemo(() => {
    const set = new Set<string>();
    for (const t of c.riskThemes) { const o = THEME_OBJECTIVE[t]; if (o) set.add(o); }
    set.add("Know Your Customer (KYC)");
    return [...set];
  }, [c.riskThemes]);
  const objectives = override.objectives ?? derivedObjectives;

  const registerSet = useMemo(() => new Set(registerSlugs), [registerSlugs]);
  const libGroups = useMemo(() => {
    const q = libSearch.trim().toLowerCase();
    const base = libTab === "mine" ? allControls.filter((x) => registerSet.has(x.slug)) : allControls;
    return CONTROL_CATEGORY_ORDER.map((cat) => ({
      cat,
      items: base.filter((x) => x.category === cat && (!q || x.name.toLowerCase().includes(q))),
    })).filter((g) => g.items.length > 0);
  }, [libTab, libSearch, registerSet]);

  const inRegister = registerSet.has(c.slug);
  const cases = useMemo(() => c.enforcementRefs.map((r) => findEnforcementCase(r.firm, r.year)).filter(Boolean) as NonNullable<ReturnType<typeof findEnforcementCase>>[], [c.enforcementRefs]);
  const linked = useMemo(() => controlsForThemes(c.riskThemes).filter((x) => x.slug !== c.slug).slice(0, 3), [c.riskThemes, c.slug]);
  const changed = (Object.keys(override) as (keyof ControlOverride)[]).filter((k) => isOverrideSet(override[k]));
  const benchTotal = useMemo(() => totalPenaltiesForThemes(c.riskThemes), [c.riskThemes]);
  const benchCount = useMemo(() => countCasesForThemes(c.riskThemes), [c.riskThemes]);

  const toggleCat = (cat: string) => setOpenCats((s) => { const n = new Set(s); if (n.has(cat)) n.delete(cat); else n.add(cat); return n; });
  const toggleObjective = (o: string) => {
    const next = objectives.includes(o) ? objectives.filter((x) => x !== o) : [...objectives, o];
    setOverride({ objectives: next });
  };

  return (
    <div className="px-4 sm:px-6 py-6">
      {/* Wizard header */}
      <button onClick={onBackToRegister} className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-foreground transition-colors mb-3"><ArrowLeft className="h-4 w-4" /> Back to Control Register</button>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground leading-tight">{c.name}</h1>
            <StatusSelect value={status} onChange={(s) => setOverride({ status: s })} />
          </div>
          <p className="text-sm text-text-muted mt-1">Category: {CONTROL_CATEGORY_LABEL[c.category]} · ID: {controlId}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {inRegister ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-xs text-text-muted"><Check className="h-3.5 w-3.5 text-accent" /> In your register, kept this session</span>
              <button onClick={onBackToRegister} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors">Save control</button>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">Previewing from the library</span>
              <button onClick={onAddToRegister} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors"><Plus className="h-4 w-4" /> Add to register</button>
            </>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="glass-card rounded-2xl px-4 py-3 mb-5 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {STEPS.map((s, i) => {
            const done = i < stepIdx;
            const isCur = s === step;
            return (
              <div key={s} className="flex items-center">
                <button onClick={() => setStep(s)} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${isCur ? "text-accent font-medium" : done ? "text-foreground hover:text-accent" : "text-text-muted hover:text-foreground"}`}>
                  <span className={`h-6 w-6 rounded-full grid place-items-center text-xs font-semibold ${done ? "bg-accent text-white" : isCur ? "border-2 border-accent text-accent" : "border border-surface-border text-text-muted"}`}>{done ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
                  {s}
                </button>
                {i < STEPS.length - 1 && <span className="w-6 h-px bg-surface-border mx-0.5" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3-column */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_300px] gap-5">
        {/* LEFT: Control Library */}
        <aside className="glass-card rounded-2xl p-3 self-start hidden lg:block">
          <p className="text-sm font-semibold text-foreground px-1">Control Library</p>
          <p className="text-xs text-text-muted px-1 mb-2">Browse templates and building blocks.</p>
          <div className="flex gap-1 mb-2 border-b border-surface-border">
            {(["categories", "mine"] as const).map((t) => (
              <button key={t} onClick={() => setLibTab(t)} className={`px-2.5 py-1.5 text-xs font-medium border-b-2 -mb-px ${libTab === t ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-foreground"}`}>{t === "categories" ? "Categories" : "My Library"}</button>
            ))}
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
            <input value={libSearch} onChange={(e) => setLibSearch(e.target.value)} placeholder="Search controls..." className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-white/5 border border-surface-border text-xs text-foreground focus:outline-none focus:border-accent" />
          </div>
          <div className="space-y-0.5 max-h-[420px] overflow-y-auto">
            {libGroups.length === 0 && <p className="text-xs text-text-muted px-1 py-2">No customised controls yet this session.</p>}
            {libGroups.map((g) => {
              const open = openCats.has(g.cat) || !!libSearch;
              return (
                <div key={g.cat}>
                  <button onClick={() => toggleCat(g.cat)} className="w-full flex items-center justify-between gap-1 px-1.5 py-1.5 rounded-lg hover:bg-surface-hover">
                    <span className="flex items-center gap-1 text-xs font-semibold text-foreground">{open ? <ChevronDown className="h-3.5 w-3.5 text-text-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-text-muted" />}{CONTROL_CATEGORY_LABEL[g.cat]}</span>
                    <span className="text-[11px] text-text-muted tabular-nums">{g.items.length}</span>
                  </button>
                  {open && (
                    <div className="pl-2">
                      {g.items.map((x) => (
                        <button key={x.slug} onClick={() => onSelectControl(x.slug)} className={`w-full text-left px-2 py-1.5 rounded-lg text-xs truncate transition-colors ${x.slug === c.slug ? "bg-accent/12 text-accent font-medium" : "text-text-muted hover:bg-surface-hover hover:text-foreground"}`}>{x.name}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={onAdd} className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-surface-border text-xs text-text-muted hover:text-accent hover:border-accent/40 transition-colors"><Plus className="h-3.5 w-3.5" /> Add control</button>
        </aside>

        {/* MIDDLE: step form */}
        <div className="min-w-0 glass-card rounded-2xl p-5 sm:p-6">
          {step === "Scope" && <ScopeStep c={c} controlId={controlId} override={override} setOverride={setOverride} status={status} objectives={objectives} toggleObjective={toggleObjective} />}
          {step === "Objective" && <ObjectiveStep c={c} />}
          {step === "Procedure" && <ProcedureStep c={c} override={override} setOverride={setOverride} />}
          {step === "Evidence" && <EvidenceStep c={c} cases={cases} />}
          {step === "Testing" && <TestingStep c={c} tested={tested} onToggleTest={onToggleTest} />}
          {step === "Ownership" && <OwnershipStep c={c} override={override} setOverride={setOverride} />}
          {step === "Approval" && <ApprovalStep c={c} status={status} setOverride={setOverride} />}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-surface-border">
            <button onClick={() => { if (window.confirm("Reset this control to its catalogue defaults? This clears every edit you have made to it across all steps.")) resetOverride(); }} className="text-sm text-text-muted hover:text-risk-high transition-colors">Reset control</button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-muted">Step {stepIdx + 1} of {STEPS.length}</span>
              {stepIdx < STEPS.length - 1 ? (
                <button onClick={() => setStep(STEPS[stepIdx + 1])} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors">Next: {STEPS[stepIdx + 1]} <ChevronRight className="h-4 w-4" /></button>
              ) : (
                <button onClick={onBackToRegister} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors">Finish <Check className="h-4 w-4" /></button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: side rail */}
        <aside className="space-y-4 self-start hidden xl:block">
          {/* Tuning guidance (static, from the control catalogue) */}
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2"><Lightbulb className="h-4 w-4 text-accent" /><span className="text-sm font-semibold text-foreground">Tuning guidance</span></div>
            <div className="rounded-xl border border-accent/20 bg-accent/[0.05] p-3">
              <p className="text-xs text-text-muted leading-relaxed">{c.tuningNotes}</p>
              <button
                onClick={() => { const cur = override.notes ?? ""; if (!cur.includes(c.tuningNotes)) setOverride({ notes: cur ? `${cur}\n${c.tuningNotes}` : c.tuningNotes }); }}
                className="mt-2 text-xs font-medium text-accent hover:underline"
              >Add to your notes</button>
            </div>
            {c.whatGoodLooksLike.length > 0 && (
              <button onClick={() => setMoreSug((v) => !v)} className="mt-2 text-xs text-accent hover:underline">{moreSug ? "Hide" : "What good looks like"} ({c.whatGoodLooksLike.length})</button>
            )}
            {moreSug && (
              <ul className="mt-2 space-y-1.5">
                {c.whatGoodLooksLike.map((g, i) => <li key={i} className="text-xs text-text-muted flex gap-1.5"><Check className="h-3 w-3 text-accent mt-0.5 shrink-0" />{g}</li>)}
              </ul>
            )}
          </div>

          {/* Benchmark Guidance */}
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-1"><Gauge className="h-4 w-4 text-accent" /><span className="text-sm font-semibold text-foreground">Benchmark Guidance</span></div>
            <p className="text-xs text-text-muted mb-2">Enforcement exposure across this control&apos;s risk themes.</p>
            <div className="flex items-end justify-between">
              <span className="text-lg font-bold text-foreground tabular-nums">{fmtGbp(benchTotal)}</span>
              <span className="text-xs text-text-muted">{benchCount} case{benchCount === 1 ? "" : "s"}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-2"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, benchCount * 8)}%` }} /></div>
          </div>

          {/* Regulatory References */}
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2"><BookOpen className="h-4 w-4 text-accent" /><span className="text-sm font-semibold text-foreground">Regulatory References ({c.sources.length})</span></div>
            <div className="space-y-1.5">
              {c.sources.slice(0, 4).map((s) => (
                <div key={`${s.org}-${s.reference}`} className="flex items-center gap-2 text-xs">
                  <span className="text-foreground truncate flex-1">{s.org} {s.reference}</span>
                  <span className="text-[9px] font-semibold text-text-muted border border-surface-border rounded px-1 py-0.5 shrink-0">{ORG_REGION[s.org] ?? "REF"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Linked Controls */}
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2"><Link2 className="h-4 w-4 text-accent" /><span className="text-sm font-semibold text-foreground">Linked Controls ({linked.length})</span></div>
            <div className="space-y-1.5">
              {linked.map((x) => (
                <button key={x.slug} onClick={() => onSelectControl(x.slug)} className="w-full text-left text-xs text-text-muted hover:text-accent transition-colors truncate flex items-center gap-1">{x.name}<ChevronRight className="h-3 w-3 shrink-0" /></button>
              ))}
              {linked.length === 0 && <p className="text-xs text-text-muted">No linked controls.</p>}
            </div>
          </div>

          {/* Recent Changes */}
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2"><History className="h-4 w-4 text-accent" /><span className="text-sm font-semibold text-foreground">Recent Changes</span></div>
            {changed.length ? (
              <ul className="space-y-1">{changed.slice(0, 5).map((k) => <li key={k} className="text-xs text-text-muted flex items-center gap-1.5"><Check className="h-3 w-3 text-accent shrink-0" /> {String(k)}</li>)}</ul>
            ) : <p className="text-xs text-text-muted">No changes yet this session.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ── Steps ─────────────────────────────────────────────── */

function ScopeStep({ c, controlId, override, setOverride, status, objectives, toggleObjective }: {
  c: Control; controlId: string; override: ControlOverride; setOverride: (p: Partial<ControlOverride>) => void;
  status: ControlStatus; objectives: string[]; toggleObjective: (o: string) => void;
}) {
  const description = override.description ?? c.plainSummary;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Control Overview</h2>
        <p className="text-sm text-text-muted">Define the scope and context of this control.</p>
        <div className="grid sm:grid-cols-4 gap-4 mt-3">
          <label className="block"><span className={label}>Control ID</span><input readOnly value={controlId} className={`${inputCls} opacity-70`} /></label>
          <div><span className={label}>Status</span><div className="mt-1"><StatusSelect value={status} onChange={(s) => setOverride({ status: s })} /></div></div>
          <label className="block"><span className={label}>Version</span><input value={override.version ?? "1.0"} onChange={(e) => setOverride({ version: e.target.value })} className={inputCls} /></label>
          <label className="block"><span className={label}>Effective Date</span><input value={override.effectiveDate ?? ""} onChange={(e) => setOverride({ effectiveDate: e.target.value })} placeholder="e.g. 20 May 2025" className={inputCls} /></label>
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold text-foreground">Scope</h3>
        <p className="text-sm text-text-muted">Define where and to whom this control applies.</p>
        <div className="grid sm:grid-cols-2 gap-4 mt-3">
          <label className="block"><span className={label}>Business Area / Function</span><input value={override.businessArea ?? ""} onChange={(e) => setOverride({ businessArea: e.target.value })} placeholder="e.g. Onboarding, Client Lifecycle" className={inputCls} /></label>
          <label className="block"><span className={label}>Geography / Jurisdiction</span><input value={override.geography ?? ""} onChange={(e) => setOverride({ geography: e.target.value })} placeholder="e.g. All Jurisdictions" className={inputCls} /></label>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <TagInput label="In Scope" values={override.inScope ?? []} onChange={(v) => setOverride({ inScope: v })} placeholder="Add scope item" />
          <TagInput label="Out of Scope (optional)" values={override.outOfScope ?? []} onChange={(v) => setOverride({ outOfScope: v })} placeholder="Add exclusion" />
          <TagInput label="Customer Types" values={override.customerTypes ?? []} onChange={(v) => setOverride({ customerTypes: v })} placeholder="Add customer type" />
          <TagInput label="Products / Services" values={override.products ?? []} onChange={(v) => setOverride({ products: v })} placeholder="Add product" />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Control Description</h3>
          <span className="text-xs text-text-muted tabular-nums">{description.length} / 2000</span>
        </div>
        <textarea rows={4} maxLength={2000} value={description} onChange={(e) => setOverride({ description: e.target.value })} className={inputCls} />
      </div>

      <div>
        <h3 className="text-base font-semibold text-foreground">Regulatory Objective Alignment</h3>
        <p className="text-sm text-text-muted mb-2">Select the regulatory objectives this control supports.</p>
        <div className="flex flex-wrap gap-2">
          {OBJECTIVES.map((o) => {
            const on = objectives.includes(o);
            return (
              <button key={o} onClick={() => toggleObjective(o)} className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${on ? "bg-accent/12 text-accent border-accent/30" : "text-text-muted border-surface-border hover:text-foreground"}`}>
                {on && <Check className="h-3 w-3" />}{o}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ObjectiveStep({ c }: { c: Control }) {
  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-semibold text-foreground">Control Objective</h2><p className="text-sm text-text-muted">What this control is designed to achieve.</p></div>
      <p className="text-sm text-foreground leading-relaxed">{c.objective}</p>
      <div>
        <p className={label}>What good looks like</p>
        <ul className="mt-2 space-y-1.5">{c.whatGoodLooksLike.map((g, i) => <li key={i} className="flex items-start gap-2 text-sm text-text-muted"><ShieldCheck className="h-4 w-4 text-accent mt-0.5 shrink-0" />{g}</li>)}</ul>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-accent/30 bg-accent/[0.05] p-3"><p className="text-xs font-semibold text-accent mb-1">Strong</p><p className="text-xs text-text-muted leading-relaxed">{c.strongVsWeak.strong}</p></div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.05] p-3"><p className="text-xs font-semibold text-red-600 mb-1">Weak</p><p className="text-xs text-text-muted leading-relaxed">{c.strongVsWeak.weak}</p></div>
      </div>
    </div>
  );
}

function ProcedureStep({ c, override, setOverride }: { c: Control; override: ControlOverride; setOverride: (p: Partial<ControlOverride>) => void }) {
  const threshold = override.threshold ?? c.defaultThreshold;
  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-semibold text-foreground">Procedure</h2><p className="text-sm text-text-muted">The rule, threshold and how it operates.</p></div>
      <div><p className={label}>Rule / logic</p><p className="text-sm text-foreground leading-relaxed mt-1">{c.ruleLogic}</p></div>
      <label className="block"><span className={label}>Threshold</span><span className="block text-[11px] text-text-muted/70 mb-1">{c.thresholdRationale}</span><textarea rows={2} value={threshold} onChange={(e) => setOverride({ threshold: e.target.value })} className={inputCls} /></label>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><p className={label}>Lookback window</p><p className="text-sm text-text-muted mt-1">{c.lookbackWindow}</p></div>
        <div><p className={label}>Escalation</p><p className="text-sm text-text-muted mt-1">{c.escalation}</p></div>
        <div><p className={label}>SLA</p><p className="text-sm text-text-muted mt-1">{c.sla}</p></div>
        <div><p className={label}>Data inputs</p><p className="text-sm text-text-muted mt-1">{c.dataInputs.join("; ")}</p></div>
      </div>
      <label className="block"><span className={label}>Firm notes (tuning, scope, exceptions)</span><textarea rows={2} value={override.notes ?? ""} onChange={(e) => setOverride({ notes: e.target.value })} placeholder={`Your tuning decisions for this control. Recommended: ${c.tuningNotes}`} className={inputCls} /></label>
    </div>
  );
}

function EvidenceStep({ c, cases }: { c: Control; cases: NonNullable<ReturnType<typeof findEnforcementCase>>[] }) {
  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-semibold text-foreground">Evidence</h2><p className="text-sm text-text-muted">Cited standards and the enforcement precedent this control addresses.</p></div>
      <section>
        <div className="flex items-center gap-2 mb-2"><Scale className="h-4 w-4 text-accent" /><h4 className="text-sm font-semibold text-foreground">Enforcement precedent</h4></div>
        {cases.length ? (
          <div className="grid sm:grid-cols-2 gap-3">{cases.map((ec) => (
            <Link key={`${ec.firm}-${ec.year}`} href={`/enforcement/${caseSlug(ec.firm, ec.year)}`} className="glass-card rounded-xl p-3 card-hover flex items-start justify-between gap-2">
              <span className="min-w-0"><span className="block text-sm font-medium text-foreground leading-tight truncate">{ec.firm}</span><span className="text-xs text-text-muted">{ec.regulator} · {ec.year}</span></span>
              <span className="text-sm font-bold text-accent shrink-0">{fmtGbp(ec.amountGbp)}</span>
            </Link>
          ))}</div>
        ) : <p className="text-sm text-text-muted">No enforcement case is mapped to this control yet.</p>}
      </section>
      <section>
        <div className="flex items-center gap-2 mb-2"><BookOpen className="h-4 w-4 text-accent" /><h4 className="text-sm font-semibold text-foreground">Cited sources</h4></div>
        <ul className="space-y-1.5">{c.sources.map((s) => <li key={`${s.org}-${s.reference}`} className="text-sm text-text-muted"><span className="font-medium text-foreground">{s.org} {s.reference}</span>: {s.title}</li>)}</ul>
      </section>
    </div>
  );
}

function TestingStep({ c, tested, onToggleTest }: { c: Control; tested: number[]; onToggleTest: (i: number) => void }) {
  return (
    <div className="space-y-4">
      <div><h2 className="text-lg font-semibold text-foreground">Testing</h2><p className="text-sm text-text-muted">Mark each authored test step as evidenced. Tracked this session.</p></div>
      <ol className="space-y-2">{c.testPlan.map((step, i) => {
        const done = tested.includes(i);
        return (
          <li key={i}><button onClick={() => onToggleTest(i)} className={`w-full text-left flex items-start gap-2.5 rounded-lg border p-3 transition-colors ${done ? "border-accent/40 bg-accent/[0.06]" : "border-surface-border hover:bg-surface-hover"}`}>
            <span className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${done ? "border-accent bg-accent text-white" : "border-surface-border"}`}>{done && <Check className="h-3 w-3" />}</span>
            <span className={`text-sm ${done ? "text-text-muted line-through" : "text-foreground"}`}>{step}</span>
          </button></li>
        );
      })}</ol>
      <p className="text-xs text-text-muted">{tested.length} of {c.testPlan.length} steps tested.</p>
    </div>
  );
}

function OwnershipStep({ c, override, setOverride }: { c: Control; override: ControlOverride; setOverride: (p: Partial<ControlOverride>) => void }) {
  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-semibold text-foreground">Ownership</h2><p className="text-sm text-text-muted">Who owns, runs and reviews this control.</p></div>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block"><span className={label}>Accountable owner</span><input value={override.owner ?? ""} onChange={(e) => setOverride({ owner: e.target.value })} placeholder="Unassigned" className={inputCls} /></label>
        <label className="block"><span className={label}>First-line owner</span><input value={override.firstLineOwner ?? c.firstLineOwner} onChange={(e) => setOverride({ firstLineOwner: e.target.value })} className={inputCls} /></label>
        <label className="block"><span className={label}>Second-line owner</span><input value={override.secondLineOwner ?? c.secondLineOwner} onChange={(e) => setOverride({ secondLineOwner: e.target.value })} className={inputCls} /></label>
        <label className="block"><span className={label}>System / tooling</span><input value={override.system ?? c.suggestedSystems.join("; ")} onChange={(e) => setOverride({ system: e.target.value })} className={inputCls} /></label>
        <label className="block"><span className={label}>Review frequency</span><input value={override.frequency ?? c.reviewCadence} onChange={(e) => setOverride({ frequency: e.target.value })} className={inputCls} /></label>
        <label className="block"><span className={label}>Last reviewed</span><input value={override.lastReview ?? ""} onChange={(e) => setOverride({ lastReview: e.target.value })} placeholder="Not set" className={inputCls} /></label>
      </div>
    </div>
  );
}

function ApprovalStep({ c, status, setOverride }: { c: Control; status: ControlStatus; setOverride: (p: Partial<ControlOverride>) => void }) {
  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-semibold text-foreground">Approval</h2><p className="text-sm text-text-muted">Confirm the control status for the register and export.</p></div>
      <div className="rounded-xl border border-surface-border p-4">
        <p className="text-sm text-foreground font-medium mb-1">{c.name}</p>
        <p className="text-xs text-text-muted mb-3">{c.plainSummary}</p>
        <div className="flex items-center gap-3">
          <span className={label}>Set status</span>
          <StatusSelect value={status} onChange={(s) => setOverride({ status: s })} />
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 text-center">
        {[["Sources", String(c.sources.length)], ["Test steps", String(c.testPlan.length)], ["Enforcement refs", String(c.enforcementRefs.length)]].map(([k, v]) => (
          <div key={k} className="glass-card rounded-xl p-3"><div className="text-xl font-bold text-foreground tabular-nums">{v}</div><div className="text-[11px] text-text-muted">{k}</div></div>
        ))}
      </div>
      <p className="text-xs text-text-muted">Mark as Implemented once design and operating effectiveness are evidenced. This is captured in your session and the exported register.</p>
    </div>
  );
}

/* ── TagInput ──────────────────────────────────────────── */

function TagInput({ label: lbl, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  // Commit only on Enter or the explicit + button, never on blur, so navigating
  // away (Next, remove a tag, click elsewhere) does not add half-typed text.
  const add = () => { const v = draft.trim(); if (v && !values.includes(v)) onChange([...values, v]); setDraft(""); };
  return (
    <div>
      <span className={label}>{lbl}</span>
      <div className="mt-1 flex flex-wrap gap-1.5 rounded-lg bg-white/5 border border-surface-border p-2 min-h-[38px]">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent/12 text-accent text-xs font-medium">{v}<button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`}><X className="h-3 w-3" /></button></span>
        ))}
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={values.length === 0 ? placeholder : "Type and press Enter"} className="flex-1 min-w-[80px] bg-transparent text-sm text-foreground focus:outline-none" />
        {draft.trim() && <button type="button" onClick={add} aria-label="Add" className="text-accent text-xs font-medium px-1">Add</button>}
      </div>
    </div>
  );
}
