"use client";

import { useState } from "react";
import {
  ShieldCheck, ScanSearch, Wrench, X, ChevronDown, Scale, ThumbsUp, ThumbsDown, Pencil,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import SourceBadge from "@/components/shared/SourceBadge";
import GlossaryText from "@/components/shared/GlossaryText";
import { CONTROL_CATEGORY_LABEL, CONTROL_TYPE_LABEL } from "@/data/controls";
import type { Control, ControlOverride } from "@/data/controls/types";
import type { SourceOrg } from "@/data/typologies/types";

const TYPE_ICON = { preventive: ShieldCheck, detective: ScanSearch, corrective: Wrench } as const;
const typeVariant = (t: Control["controlType"]) =>
  t === "preventive" ? ("info" as const) : t === "detective" ? ("warning" as const) : ("default" as const);

/** Build the default override (catalogue values prefilled so the user edits from real starting points). */
export function defaultOverride(c: Control): ControlOverride {
  return {
    threshold: c.defaultThreshold,
    firstLineOwner: c.firstLineOwner,
    secondLineOwner: c.secondLineOwner,
    system: c.suggestedSystems.join("; "),
    reviewCadence: c.reviewCadence,
    notes: "",
  };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-text-muted">{label}</span>
      {hint && <span className="block text-[11px] text-text-muted/70 mb-1">{hint}</span>}
      {children}
    </label>
  );
}

const inputCls =
  "w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-surface-border text-sm text-foreground focus:outline-none focus:border-accent";

export default function EditableControlCard({
  control: c,
  override,
  onChange,
  onRemove,
}: {
  control: Control;
  override: ControlOverride;
  onChange: (next: ControlOverride) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const TypeIcon = TYPE_ICON[c.controlType];
  const set = (k: keyof ControlOverride, v: string) => onChange({ ...override, [k]: v });

  return (
    <div className="glass-card rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant={typeVariant(c.controlType)} className="gap-1">
              <TypeIcon className="h-3 w-3" /> {CONTROL_TYPE_LABEL[c.controlType]}
            </Badge>
            <span className="text-[10px] uppercase tracking-wider text-text-muted">{CONTROL_CATEGORY_LABEL[c.category]}</span>
          </div>
          <h3 className="text-base font-semibold text-foreground leading-tight">{c.name}</h3>
        </div>
        <button onClick={onRemove} aria-label={`Remove ${c.name}`} className="shrink-0 text-text-muted hover:text-risk-high transition-colors p-1">
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="text-sm text-text-muted leading-relaxed mt-2">{c.plainSummary}</p>

      {/* What good looks like */}
      <div className="mt-3 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-500 flex items-center gap-1.5 mb-1.5">
          <ThumbsUp className="h-3.5 w-3.5" /> What good looks like
        </p>
        <ul className="space-y-1">
          {c.whatGoodLooksLike.map((g, i) => (
            <li key={i} className="text-xs text-text-muted flex gap-1.5">
              <span className="mt-1.5 h-1 w-1 rounded-full bg-emerald-400 shrink-0" /> <span>{g}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Editable fields */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Threshold" hint="Your trigger. Adjust to your firm; the rationale is below.">
            <textarea rows={2} className={inputCls} value={override.threshold ?? ""} onChange={(e) => set("threshold", e.target.value)} />
          </Field>
        </div>
        <Field label="First-line owner">
          <input className={inputCls} value={override.firstLineOwner ?? ""} onChange={(e) => set("firstLineOwner", e.target.value)} />
        </Field>
        <Field label="Second-line owner">
          <input className={inputCls} value={override.secondLineOwner ?? ""} onChange={(e) => set("secondLineOwner", e.target.value)} />
        </Field>
        <Field label="System / tooling">
          <input className={inputCls} value={override.system ?? ""} onChange={(e) => set("system", e.target.value)} />
        </Field>
        <Field label="Review cadence">
          <input className={inputCls} value={override.reviewCadence ?? ""} onChange={(e) => set("reviewCadence", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Firm notes" hint="Anything specific to your firm: scope, exceptions, dependencies.">
            <textarea rows={2} className={inputCls} placeholder="Optional" value={override.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
      </div>

      {/* Enforcement precedent */}
      {c.enforcementRefs.length > 0 && (
        <p className="mt-3 text-xs text-text-muted flex items-start gap-1.5">
          <Scale className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
          <span>Addresses failings in: {c.enforcementRefs.map((r) => `${r.firm} (${r.year})`).join(", ")}.</span>
        </p>
      )}

      {/* Full spec (expandable) */}
      <button onClick={() => setOpen((o) => !o)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent">
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} /> {open ? "Hide" : "Show"} full specification
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t border-surface-border space-y-3 text-sm">
          <Spec label="Objective"><GlossaryText>{c.objective}</GlossaryText></Spec>
          <Spec label="Rule / logic"><GlossaryText>{c.ruleLogic}</GlossaryText></Spec>
          <Spec label="Why this threshold">{c.thresholdRationale}</Spec>
          <Spec label="Lookback window">{c.lookbackWindow}</Spec>
          <Spec label="Tuning">{c.tuningNotes}</Spec>
          <Spec label="Escalation">{c.escalation}</Spec>
          <Spec label="SLA">{c.sla}</Spec>
          <div>
            <SpecLabel>Strong vs weak</SpecLabel>
            <div className="grid sm:grid-cols-2 gap-2 mt-1">
              <div className="rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15 p-2.5">
                <p className="text-[11px] font-semibold text-emerald-500 flex items-center gap-1 mb-1"><ThumbsUp className="h-3 w-3" /> Strong</p>
                <p className="text-xs text-text-muted leading-relaxed">{c.strongVsWeak.strong}</p>
              </div>
              <div className="rounded-lg bg-risk-high/[0.06] border border-risk-high/15 p-2.5">
                <p className="text-[11px] font-semibold text-risk-high flex items-center gap-1 mb-1"><ThumbsDown className="h-3 w-3" /> Weak</p>
                <p className="text-xs text-text-muted leading-relaxed">{c.strongVsWeak.weak}</p>
              </div>
            </div>
          </div>
          <Spec label="Data inputs">{c.dataInputs.join("; ")}</Spec>
          <div>
            <SpecLabel>Test plan</SpecLabel>
            <ol className="mt-1 space-y-1 list-decimal list-inside">
              {c.testPlan.map((t, i) => <li key={i} className="text-xs text-text-muted leading-relaxed">{t}</li>)}
            </ol>
          </div>
          <div>
            <SpecLabel>Metrics</SpecLabel>
            <div className="mt-1 space-y-1">
              {c.metrics.map((m) => (
                <div key={m.name} className="text-xs flex justify-between gap-3 py-1 border-b border-surface-border last:border-0">
                  <span className="text-foreground">{m.name} <span className="text-text-muted">{m.description}</span></span>
                  <span className="font-mono text-accent shrink-0">{m.target}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SpecLabel>Sources</SpecLabel>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {c.sources.map((s) => (
                <SourceBadge key={`${s.org}-${s.reference}`} source={s.org as SourceOrg} reference={s.reference} url={s.url} title={s.title} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SpecLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground flex items-center gap-1"><Pencil className="h-3 w-3 text-accent" /> {children}</p>;
}
function Spec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <SpecLabel>{label}</SpecLabel>
      <p className="text-xs text-text-muted leading-relaxed mt-0.5">{children}</p>
    </div>
  );
}
