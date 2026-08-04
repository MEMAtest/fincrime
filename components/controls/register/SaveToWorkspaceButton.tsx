"use client";

import { useState } from "react";
import Link from "next/link";
import { CloudUpload, Check, AlertTriangle, Loader2 } from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import type { Control, ControlOverride } from "@/data/controls/types";

type SaveState = "idle" | "saving" | "done";

interface SaveSummary {
  ok: number;
  fail: number;
}

/**
 * Persists the in-session Control Builder register into the anonymous
 * workspace: one POST /api/workspace/controls per control (instantiate-from-
 * library shape), carrying whichever user-edited overrides map onto
 * workspace_controls fields (threshold, status, effectiveness rating,
 * operating frequency, last/next test date, product applicability, system).
 * The register itself is untouched - this only copies it.
 */
export default function SaveToWorkspaceButton({
  controls,
  overrides,
}: {
  controls: Control[];
  overrides: Record<string, ControlOverride>;
}) {
  const { wsFetch } = useWorkspace();
  const [state, setState] = useState<SaveState>("idle");
  const [summary, setSummary] = useState<SaveSummary | null>(null);

  // The register's review-date fields are free text. Only an unambiguous
  // YYYY-MM-DD survives into the workspace's DATE/TIMESTAMPTZ columns; other
  // formats (e.g. "1/9/2026", "Q3 2026") are dropped rather than risking a
  // silently wrong date or a failed row.
  const isoDate = (value: string | undefined): string | undefined => {
    const trimmed = value?.trim();
    return trimmed && /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
  };

  const save = async () => {
    if (!controls.length || state === "saving") return;
    setState("saving");
    setSummary(null);

    const results = await Promise.allSettled(
      controls.map((c) => {
        const o = overrides[c.slug] ?? {};
        const effectivenessRating = o.overallRating ?? o.operatingEffectiveness ?? o.designEffectiveness ?? o.rating;
        const lastTestedAt = isoDate(o.lastReviewed ?? o.lastReview);
        const body: Record<string, unknown> = {
          controlSlug: c.slug,
          threshold: o.threshold,
          status: o.status,
          effectivenessRating,
          operatingFrequency: o.frequency,
          lastTestedAt,
          nextTestDue: isoDate(o.nextReview),
          productApplicability: o.products,
          systems: o.system ? [o.system] : undefined,
        };
        return wsFetch("/api/workspace/controls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then((res) => {
          if (!res.ok) throw new Error(`Failed to save ${c.name}`);
        });
      })
    );

    const ok = results.filter((r) => r.status === "fulfilled").length;
    setState("done");
    setSummary({ ok, fail: results.length - ok });
  };

  return (
    <div className="inline-flex items-center gap-2.5">
      <button
        type="button"
        onClick={save}
        disabled={state === "saving" || controls.length === 0}
        title="Save this register's controls to your workspace"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-foreground border border-white/10 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
        Save to workspace
      </button>
      {state === "done" && summary && (
        summary.fail > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-500">
            <AlertTriangle className="h-3.5 w-3.5" /> Saved {summary.ok} of {summary.ok + summary.fail}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-accent">
            <Check className="h-3.5 w-3.5" /> Saved {summary.ok} to workspace ·{" "}
            <Link href="/workspace" className="underline hover:no-underline">View workspace</Link>
          </span>
        )
      )}
    </div>
  );
}
