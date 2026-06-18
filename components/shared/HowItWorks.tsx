"use client";

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";

interface Step {
  title: string;
  body: string;
}
interface Provenance {
  label: string;
  value: string;
}

/**
 * Collapsible "how this works" explainer: the deterministic method, how AI is
 * layered on, and a data-provenance block. Reusable across every tool (each
 * passes its own steps/weights/provenance).
 */
export default function HowItWorks({
  title = "How this works",
  steps,
  provenance,
  lastUpdated,
  defaultOpen = false,
}: {
  title?: string;
  steps: Step[];
  provenance?: Provenance[];
  lastUpdated?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-card rounded-2xl mb-8 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-surface-hover transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Info className="h-4 w-4 text-accent" /> {title}
        </span>
        <ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-surface-border pt-4">
          {steps.map((s, i) => (
            <div key={i}>
              <p className="text-sm font-medium text-foreground">{s.title}</p>
              <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{s.body}</p>
            </div>
          ))}
          {provenance && provenance.length > 0 && (
            <div className="pt-2 border-t border-surface-border">
              <p className="text-[11px] uppercase tracking-wider text-text-muted mb-1.5">Data provenance</p>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
                {provenance.map((p) => (
                  <div key={p.label} className="flex justify-between gap-3 text-xs">
                    <dt className="text-text-muted">{p.label}</dt>
                    <dd className="text-foreground text-right">{p.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {lastUpdated && (
            <p className="text-[11px] text-text-muted/70">Enforcement data last refreshed {lastUpdated}.</p>
          )}
        </div>
      )}
    </div>
  );
}
