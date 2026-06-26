"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Wrench, Plus, Check, Layers, ScanSearch, Scale, ListChecks } from "lucide-react";
import { THEME_CONFIG } from "@/components/icons/RiskThemeIcon";
import { RISK_THEME_LABEL } from "@/data/typologies/labels";
import PDFExportButton from "@/components/shared/PDFExportButton";
import KeyTerms from "@/components/shared/KeyTerms";
import EditableControlCard, { defaultOverride } from "@/components/controls/EditableControlCard";
import {
  allControls, getControlBySlug, CONTROL_CATEGORY_ORDER, CONTROL_CATEGORY_LABEL,
} from "@/data/controls";
import { allTypologies } from "@/data/typologies";
import type { ControlOverride } from "@/data/controls/types";
import type { RiskTheme } from "@/data/typologies/types";

const ALL_THEMES: RiskTheme[] = [
  "money_laundering", "fraud", "sanctions_evasion", "terrorist_financing",
  "bribery_corruption", "proliferation_financing", "tax_evasion",
];
const TOTAL_TYPOLOGIES = allTypologies.length;

export default function ControlBuilderClient({
  initialSlugs,
  contextLabel,
}: {
  initialSlugs: string[];
  contextLabel?: string;
}) {
  const [selected, setSelected] = useState<string[]>(initialSlugs);
  const [overrides, setOverrides] = useState<Record<string, ControlOverride>>(() => {
    const o: Record<string, ControlOverride> = {};
    for (const slug of initialSlugs) {
      const c = getControlBySlug(slug);
      if (c) o[slug] = defaultOverride(c);
    }
    return o;
  });
  const [showAdd, setShowAdd] = useState(initialSlugs.length === 0);

  const add = (slug: string) => {
    if (selected.includes(slug)) return;
    const c = getControlBySlug(slug);
    if (!c) return;
    setSelected((s) => [...s, slug]);
    setOverrides((o) => ({ ...o, [slug]: defaultOverride(c) }));
  };
  const remove = (slug: string) => {
    setSelected((s) => s.filter((x) => x !== slug));
    setOverrides((o) => { const n = { ...o }; delete n[slug]; return n; });
  };

  const selectedControls = selected.map(getControlBySlug).filter(Boolean) as NonNullable<ReturnType<typeof getControlBySlug>>[];

  const coverage = useMemo(() => {
    const themes = new Set<RiskTheme>();
    const typ = new Set<string>();
    for (const c of selectedControls) {
      c.riskThemes.forEach((t) => themes.add(t));
      c.typologySlugs.forEach((s) => typ.add(s));
    }
    return { themes, typCount: typ.size };
  }, [selectedControls]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-wider text-accent font-medium mb-1">Control Builder</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Build a defensible control register</h1>
        <p className="text-text-muted text-sm max-w-3xl mt-2 leading-relaxed">
          Adapt each control to your firm: set your thresholds, owners and systems, with guidance on what good
          looks like. Add the controls you need, then export the whole register as one committee-ready pack.
          Nothing is saved to a server; your edits live in this session and flow into the export.
        </p>
        {contextLabel && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-text-muted glass-card rounded-full px-3 py-1.5">
            <Scale className="h-3.5 w-3.5 text-accent" /> {contextLabel}
          </p>
        )}
      </div>

      <KeyTerms terms={["control", "transaction monitoring", "EDD", "SAR", "threshold"]} />

      {/* Register summary + coverage + export */}
      <div className="glass-card rounded-2xl p-5 mb-8">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-accent" />
            <h2 className="text-base font-semibold text-foreground">
              Your register <span className="text-text-muted font-normal">({selected.length} control{selected.length === 1 ? "" : "s"})</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAdd((s) => !s)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg glass-card text-sm text-text-muted hover:text-foreground transition-colors">
              <Plus className="h-4 w-4" /> Add controls
            </button>
            {selected.length > 0 && (
              <PDFExportButton
                module="control_register"
                assessmentData={{ controlSlugs: selected, overrides, context: contextLabel }}
                formats={["pdf"]}
              />
            )}
          </div>
        </div>

        {/* Coverage map */}
        <div>
          <p className="text-[11px] uppercase tracking-wider text-text-muted mb-2">Risk coverage</p>
          <div className="flex flex-wrap gap-2">
            {ALL_THEMES.map((t) => {
              const cfg = THEME_CONFIG[t];
              const covered = coverage.themes.has(t);
              return (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border"
                  style={covered
                    ? { backgroundColor: `${cfg.glow}1f`, color: cfg.primary, borderColor: `${cfg.glow}40` }
                    : { color: "var(--text-muted)", borderColor: "var(--surface-border)", opacity: 0.5 }}
                >
                  {covered ? <Check className="h-3 w-3" /> : <span className="h-3 w-3 inline-block" />}
                  {RISK_THEME_LABEL[t]}
                </span>
              );
            })}
          </div>
          <p className="text-xs text-text-muted mt-2">
            Covers <span className="text-foreground font-medium">{coverage.themes.size} of 7</span> risk themes and addresses{" "}
            <span className="text-foreground font-medium">{coverage.typCount} of {TOTAL_TYPOLOGIES}</span> typologies.
            {coverage.themes.size < 7 && selected.length > 0 ? " Add controls to close the remaining gaps." : ""}
          </p>
        </div>
      </div>

      {/* Add controls panel */}
      {showAdd && (
        <div className="glass-card rounded-2xl p-5 mb-8">
          <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2"><Layers className="h-5 w-5 text-accent" /> Control catalogue</h2>
          <div className="space-y-5">
            {CONTROL_CATEGORY_ORDER.map((cat) => {
              const inCat = allControls.filter((c) => c.category === cat);
              return (
                <div key={cat}>
                  <p className="text-[11px] uppercase tracking-wider text-text-muted mb-2">{CONTROL_CATEGORY_LABEL[cat]}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {inCat.map((c) => {
                      const on = selected.includes(c.slug);
                      return (
                        <button
                          key={c.slug}
                          onClick={() => (on ? remove(c.slug) : add(c.slug))}
                          className={`text-left rounded-lg border p-2.5 transition-colors flex items-start gap-2 ${on ? "border-accent bg-accent/[0.06]" : "border-surface-border bg-white/[0.02] hover:bg-white/[0.04]"}`}
                        >
                          <span className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${on ? "border-accent bg-accent text-white" : "border-surface-border"}`}>
                            {on ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3 text-text-muted" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-foreground leading-tight">{c.name}</span>
                            <span className="block text-xs text-text-muted line-clamp-2 mt-0.5">{c.plainSummary}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Editable register */}
      {selectedControls.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center">
          <ScanSearch className="h-8 w-8 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-muted">Your register is empty. Add controls from the catalogue above, or start from an{" "}
            <Link href="/enforcement" className="text-accent hover:underline">enforcement case</Link>.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {selectedControls.map((c) => (
            <EditableControlCard
              key={c.slug}
              control={c}
              override={overrides[c.slug] ?? defaultOverride(c)}
              onChange={(next) => setOverrides((o) => ({ ...o, [c.slug]: next }))}
              onRemove={() => remove(c.slug)}
            />
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="mt-8 flex justify-end">
          <PDFExportButton
            module="control_register"
            assessmentData={{ controlSlugs: selected, overrides, context: contextLabel }}
            formats={["pdf"]}
          />
        </div>
      )}

      <p className="mt-10 text-xs text-text-muted border-t border-surface-border pt-4 flex items-start gap-2">
        <Wrench className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        This builder produces a control specification for design and discussion. It is not legal advice; validate
        thresholds and ownership against your own risk assessment and the cited sources before implementing.
      </p>
    </div>
  );
}
