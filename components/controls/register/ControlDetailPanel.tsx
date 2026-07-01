"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { X, FileText, BookOpen, History, FlaskConical, Scale, Check, Pencil } from "lucide-react";
import SourceBadge from "@/components/shared/SourceBadge";
import { StatusBadge, PriorityBadge, StatusSelect, PrioritySelect, isOverrideSet } from "@/components/controls/ControlBits";
import { CONTROL_CATEGORY_LABEL, defaultPriority, evidenceCount } from "@/data/controls";
import { caseSlug } from "@/lib/enforcement/case-slug";
import { fmtGbp, findEnforcementCase } from "@/lib/enforcement/select";
import type { Control, ControlOverride, ControlStatus, ControlPriority } from "@/data/controls/types";
import type { SourceOrg } from "@/data/typologies/types";

const OVERRIDE_LABELS: Partial<Record<keyof ControlOverride, string>> = {
  status: "Status", priority: "Priority", owner: "Owner", lastReview: "Last review", nextReview: "Next review",
  threshold: "Threshold", firstLineOwner: "First-line owner", secondLineOwner: "Second-line owner",
  system: "System", notes: "Notes", rating: "Rating", maturityLevel: "Maturity", description: "Description",
  designEffectiveness: "Design effectiveness", operatingEffectiveness: "Operating effectiveness", overallRating: "Overall rating",
};

type Tab = "overview" | "evidence" | "history" | "testing";

export default function ControlDetailPanel({
  control: c,
  override,
  setOverride,
  tested,
  onToggleTest,
  onEdit,
  onClose,
}: {
  control: Control;
  override: ControlOverride;
  setOverride: (patch: Partial<ControlOverride>) => void;
  tested: number[];
  onToggleTest: (idx: number) => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");

  const status: ControlStatus = override.status ?? "not_started";
  const priority: ControlPriority = override.priority ?? defaultPriority(c);
  const owner = override.owner ?? "";
  const cases = useMemo(() => c.enforcementRefs.map((r) => findEnforcementCase(r.firm, r.year)).filter(Boolean) as NonNullable<ReturnType<typeof findEnforcementCase>>[], [c.enforcementRefs]);
  const changed = (Object.keys(OVERRIDE_LABELS) as (keyof ControlOverride)[]).filter((k) => isOverrideSet(override[k]));
  const untested = c.testPlan.map((s, i) => ({ s, i })).filter((x) => !tested.includes(x.i));

  const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
    { id: "overview", label: "Overview", icon: FileText },
    { id: "evidence", label: `Evidence (${evidenceCount(c)})`, icon: BookOpen },
    { id: "history", label: "History", icon: History },
    { id: "testing", label: "Testing", icon: FlaskConical },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-5 border-b border-surface-border">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-foreground leading-tight">{c.name}</h3>
          <p className="text-xs text-text-muted mt-0.5">{CONTROL_CATEGORY_LABEL[c.category]}</p>
        </div>
        <button onClick={onClose} aria-label="Close panel" className="rounded-lg p-1.5 text-text-muted hover:text-foreground hover:bg-surface-hover transition-colors shrink-0"><X className="h-4 w-4" /></button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 px-3 border-b border-surface-border overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 px-2.5 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${tab === t.id ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {tab === "overview" && (
          <>
            <section>
              <p className="text-[11px] uppercase tracking-wider text-text-muted mb-1">Summary</p>
              <p className="text-sm text-text-muted leading-relaxed">{override.description ?? c.plainSummary}</p>
            </section>

            <dl className="space-y-2.5">
              <Field label="Category"><span className="text-sm text-foreground">{CONTROL_CATEGORY_LABEL[c.category]}</span></Field>
              <Field label="Priority"><PrioritySelect value={priority} onChange={(p) => setOverride({ priority: p })} /></Field>
              <Field label="Owner"><input value={owner} onChange={(e) => setOverride({ owner: e.target.value })} placeholder="Unassigned" className="w-40 px-2.5 py-1.5 rounded-lg bg-white/5 border border-surface-border text-sm text-foreground focus:outline-none focus:border-accent" /></Field>
              <Field label="Last review"><input value={override.lastReview ?? ""} onChange={(e) => setOverride({ lastReview: e.target.value })} placeholder="Not set" className="w-40 px-2.5 py-1.5 rounded-lg bg-white/5 border border-surface-border text-sm text-foreground focus:outline-none focus:border-accent" /></Field>
              <Field label="Next review"><input value={override.nextReview ?? ""} onChange={(e) => setOverride({ nextReview: e.target.value })} placeholder="Not set" className="w-40 px-2.5 py-1.5 rounded-lg bg-white/5 border border-surface-border text-sm text-foreground focus:outline-none focus:border-accent" /></Field>
              <Field label="Status"><StatusSelect value={status} onChange={(s) => setOverride({ status: s })} /></Field>
            </dl>

            <section>
              <p className="text-sm font-semibold text-foreground mb-2">Reference documents ({c.sources.length})</p>
              <div className="space-y-1.5">
                {c.sources.map((s) => (
                  <div key={`${s.org}-${s.reference}`} className="flex items-center gap-2 text-xs">
                    <FileText className="h-3.5 w-3.5 text-text-muted shrink-0" />
                    <span className="text-foreground truncate">{s.org} {s.reference}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-semibold text-foreground">Testing</p>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${tested.length === c.testPlan.length && c.testPlan.length > 0 ? "text-emerald-600 bg-emerald-50 border border-emerald-200" : "text-slate-500 bg-slate-50 border border-slate-200"}`}>
                  {tested.length === c.testPlan.length && c.testPlan.length > 0 ? "Pass" : "In session"}
                </span>
              </div>
              <p className="text-xs text-text-muted">{tested.length} of {c.testPlan.length} test steps evidenced.</p>
            </section>

            {untested.length > 0 && (
              <section>
                <p className="text-sm font-semibold text-foreground mb-1.5">Suggested next actions</p>
                <ul className="space-y-1.5">
                  {untested.slice(0, 3).map((x) => (
                    <li key={x.i} className="flex items-start gap-2 text-xs text-text-muted">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent shrink-0" /> {x.s}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {tab === "evidence" && (
          <>
            <section>
              <div className="flex items-center gap-2 mb-2"><Scale className="h-4 w-4 text-emerald-500" /><h4 className="text-sm font-semibold text-foreground">Enforcement precedent</h4></div>
              {cases.length ? (
                <div className="space-y-2">
                  {cases.map((ec) => (
                    <Link key={`${ec.firm}-${ec.year}`} href={`/enforcement/${caseSlug(ec.firm, ec.year)}`} className="glass-card rounded-xl p-3 card-hover flex items-start justify-between gap-2">
                      <span className="min-w-0"><span className="block text-sm font-medium text-foreground leading-tight truncate">{ec.firm}</span><span className="text-xs text-text-muted">{ec.regulator} · {ec.year}</span></span>
                      <span className="text-sm font-bold text-emerald-500 shrink-0">{fmtGbp(ec.amountGbp)}</span>
                    </Link>
                  ))}
                </div>
              ) : <p className="text-sm text-text-muted">No enforcement case is mapped to this control yet.</p>}
            </section>
            <section>
              <div className="flex items-center gap-2 mb-2"><BookOpen className="h-4 w-4 text-emerald-500" /><h4 className="text-sm font-semibold text-foreground">Cited sources</h4></div>
              <div className="flex flex-wrap gap-2">
                {c.sources.map((s) => <SourceBadge key={`${s.org}-${s.reference}`} source={s.org as SourceOrg} reference={s.reference} url={s.url} title={s.title} />)}
              </div>
            </section>
          </>
        )}

        {tab === "history" && (
          <section>
            <div className="flex items-center gap-2 mb-2"><History className="h-4 w-4 text-text-muted" /><h4 className="text-sm font-semibold text-foreground">Session changes</h4></div>
            {changed.length ? (
              <ul className="space-y-1.5">
                {changed.map((k) => (
                  <li key={k} className="flex items-center gap-2 text-xs text-text-muted"><Check className="h-3.5 w-3.5 text-accent shrink-0" /> Edited <span className="text-foreground font-medium">{OVERRIDE_LABELS[k]}</span></li>
                ))}
              </ul>
            ) : <p className="text-sm text-text-muted">No changes yet this session. Edits you make to this control appear here.</p>}
          </section>
        )}

        {tab === "testing" && (
          <section>
            <p className="text-sm text-text-muted mb-3">Mark each authored test step as evidenced. Tracked in this session.</p>
            <ol className="space-y-2">
              {c.testPlan.map((step, i) => {
                const done = tested.includes(i);
                return (
                  <li key={i}>
                    <button onClick={() => onToggleTest(i)} className={`w-full text-left flex items-start gap-2.5 rounded-lg border p-3 transition-colors ${done ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-surface-border hover:bg-surface-hover"}`}>
                      <span className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-surface-border"}`}>{done && <Check className="h-3 w-3" />}</span>
                      <span className={`text-sm ${done ? "text-text-muted line-through" : "text-foreground"}`}>{step}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-surface-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <PriorityBadge priority={priority} />
        </div>
        <button onClick={onEdit} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-surface-border text-sm font-medium text-foreground hover:bg-surface-hover transition-colors">
          <Pencil className="h-3.5 w-3.5" /> Edit control
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[13px] text-text-muted shrink-0">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
