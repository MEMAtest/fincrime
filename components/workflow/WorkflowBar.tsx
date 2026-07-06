"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ArrowRight } from "lucide-react";
import { STAGES, stageForPath, nextStage } from "@/data/workflow";

/**
 * A slim, persistent stage spine shown only on the workflow tool routes. It tells
 * the user which of the four stages they are in (Profile -> Risks -> Build ->
 * Govern), lets them jump between stages, and points to the next one. It sits
 * above each tool's own in-tool step indicator (stage level vs step level).
 * Returns null on marketing/reference routes.
 */
export default function WorkflowBar() {
  const pathname = usePathname();
  const current = stageForPath(pathname);
  if (!current) return null;
  const next = nextStage(current);

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
                  href={s.primary}
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

        {/* Next-stage affordance (a clear CTA pill, not a faint link) */}
        {next ? (
          <Link href={next.primary} className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-accent text-white px-3 py-1.5 text-xs font-medium hover:bg-accent-hover transition-colors whitespace-nowrap">
            Next: {next.short} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <Link href="/control-builder" className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-accent text-white px-3 py-1.5 text-xs font-medium hover:bg-accent-hover transition-colors whitespace-nowrap">
            Export your register <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
