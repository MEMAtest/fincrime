"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Circle, ListChecks, RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";
import SourceBadge from "@/components/shared/SourceBadge";
import { CATEGORY_ORDER, CATEGORY_TITLE, type CddCategoryKey } from "@/data/kyc/types";
import type { ReadinessObligationDTO } from "./types";

export type GenerateOutcome = { ok: true; created: number; existing: number } | { ok: false; message: string };

interface StepObligationsProps {
  obligations: ReadinessObligationDTO[];
  readOnly: boolean;
  onGenerate: () => Promise<GenerateOutcome>;
}

function isKnownCategory(c: string): c is CddCategoryKey {
  return (CATEGORY_ORDER as string[]).includes(c);
}

/**
 * Step 2: the obligation register. "Generate obligation register" calls
 * POST /api/readiness/[id]/generate, which is idempotent - re-running it
 * never overwrites a control mapping, gap classification, blocker flag,
 * evidence or notes already recorded on an existing obligation (see
 * generateObligations in lib/repo/readiness.ts) - so the button is always
 * safe to press again after the KYC library changes. The register itself is
 * grouped by CATEGORY_ORDER, the same grouping the KYC Matrix uses, with each
 * requirement's rule summary and cited legal basis so users never have to
 * cross-reference the Matrix separately.
 */
export default function StepObligations({ obligations, readOnly, onGenerate }: StepObligationsProps) {
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ created: number; existing: number } | null>(null);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, ReadinessObligationDTO[]>();
    for (const o of obligations) {
      const bucket = byCategory.get(o.category);
      if (bucket) bucket.push(o);
      else byCategory.set(o.category, [o]);
    }
    const knownOrder = CATEGORY_ORDER.filter((c) => byCategory.has(c));
    const unknownOrder = [...byCategory.keys()].filter((c) => !isKnownCategory(c));
    return [...knownOrder, ...unknownOrder].map((c) => ({
      key: c,
      title: isKnownCategory(c) ? CATEGORY_TITLE[c] : c,
      items: (byCategory.get(c) ?? []).sort((a, b) => a.title.localeCompare(b.title)),
    }));
  }, [obligations]);

  const mappedCount = obligations.filter((o) => o.workspace_control_id).length;

  async function doGenerate() {
    setGenerating(true);
    setGenerateError(null);
    try {
      const result = await onGenerate();
      if (!result.ok) {
        setGenerateError(result.message);
        return;
      }
      setLastResult({ created: result.created, existing: result.existing });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Obligations</h2>
        <p className="text-sm text-text-muted">
          Build the obligation register for this entity type and jurisdiction from the KYC library, then map each
          obligation to a control in the next step.
        </p>
      </div>

      <div className="glass-card rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-accent" />
            <p className="text-sm font-semibold text-foreground">
              {obligations.length === 0 ? "No obligations generated yet" : `${obligations.length} obligation${obligations.length === 1 ? "" : "s"} in the register`}
            </p>
          </div>
          {!readOnly && (
            <Button size="sm" variant={obligations.length === 0 ? "primary" : "secondary"} onClick={doGenerate} disabled={generating}>
              <RefreshCw className={`h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
              {generating ? "Generating..." : obligations.length === 0 ? "Generate obligation register" : "Re-run generation"}
            </Button>
          )}
        </div>
        <p className="text-xs text-text-muted">
          Re-running this is always safe: it only adds obligations that are missing from the register. Any control
          mapping, gap classification, blocker flag, evidence or notes you have already recorded is left untouched.
        </p>
        {lastResult && (
          <p className="text-xs text-accent">
            {lastResult.created} added, {lastResult.existing} already present.
          </p>
        )}
        {generateError && <p className="text-xs text-red-500">{generateError}</p>}
        {obligations.length > 0 && (
          <p className="text-xs text-text-muted">
            {mappedCount} of {obligations.length} obligations have a control mapped.
          </p>
        )}
      </div>

      {obligations.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center text-text-muted text-sm">
          Generate the register above to see the obligations for this entity type and jurisdiction.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.key}>
              <h3 className="text-sm font-semibold text-foreground mb-2">{group.title}</h3>
              <div className="space-y-2">
                {group.items.map((o) => (
                  <div key={o.id} className="glass-card rounded-xl p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      {o.workspace_control_id ? (
                        <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="h-4 w-4 text-text-muted shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{o.title}</p>
                        {o.rule_summary && <p className="text-xs text-text-muted mt-0.5">{o.rule_summary}</p>}
                      </div>
                    </div>
                    {o.legal_basis.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        {o.legal_basis.map((s, i) => (
                          <SourceBadge key={`${s.org}-${s.reference}-${i}`} source={s.org} reference={s.reference} url={s.url} title={s.title} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
