"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, ArrowRight } from "lucide-react";
import { STAGES, stageForPath, nextStage } from "@/data/workflow";
import { FIRM_TYPE_LABEL } from "@/data/typologies/labels";

export default function WorkflowBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = stageForPath(pathname);
  if (!current) return null;
  const next = nextStage(current);

  // Carry firmType + riskThemes forward to avoid re-entering context on each stage.
  function withContext(base: string): string {
    const firmType = searchParams.get("firmType") ?? searchParams.get("type");
    const riskThemes = searchParams.get("riskThemes");
    if (!firmType && !riskThemes) return base;
    const p = new URLSearchParams();
    if (firmType) p.set("firmType", firmType);
    if (riskThemes) p.set("riskThemes", riskThemes);
    return `${base}?${p.toString()}`;
  }

  const firmType = searchParams.get("firmType") ?? searchParams.get("type");
  const carryLabel = firmType
    ? (FIRM_TYPE_LABEL as Record<string, string>)[firmType] ?? firmType
    : null;

  return (
    <div className="border-b border-surface-border bg-surface/70 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3">
        {/* Desktop stepper */}
        <nav aria-label="Workflow stages" className="hidden md:flex items-center gap-1.5 min-w-0">
          {STAGES.map((s, i) => {
            const done = s.n < current.n;
            const isCur = s.id === current.id;
            return (
              <div key={s.id} className="flex items-center gap-1.5">
                <Link
                  href={withContext(s.primary)}
                  aria-current={isCur ? "step" : undefined}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-colors ${
                    isCur
                      ? "bg-accent/15 text-accent font-medium"
                      : done
                        ? "text-foreground hover:text-accent"
                        : "text-text-muted hover:text-foreground"
                  }`}
                >
                  <span
                    className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                      done ? "bg-accent text-white" : isCur ? "border-2 border-accent text-accent" : "border border-line-2 text-text-muted"
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" /> : s.n}
                  </span>
                  {s.short}
                </Link>
                {i < STAGES.length - 1 && <span className="w-5 h-px bg-white/10" />}
              </div>
            );
          })}
        </nav>

        {/* Mobile compact */}
        <div className="md:hidden text-xs text-text-muted min-w-0 truncate">
          <span className="text-accent font-medium">Stage {current.n}/4</span> · {current.label}
        </div>

        {/* Next-stage CTA — carries context forward */}
        <div className="shrink-0 flex items-center gap-2">
          {carryLabel && (
            <span className="hidden sm:inline text-[11px] text-text-muted whitespace-nowrap">
              carrying: <span className="text-foreground font-medium">{carryLabel}</span>
            </span>
          )}
          {next ? (
            <Link
              href={withContext(next.primary)}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent text-white px-3 py-1.5 text-xs font-medium hover:bg-accent-hover transition-colors whitespace-nowrap"
            >
              Next: {next.short} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <Link
              href={withContext("/control-builder")}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent text-white px-3 py-1.5 text-xs font-medium hover:bg-accent-hover transition-colors whitespace-nowrap"
            >
              Export your register <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
