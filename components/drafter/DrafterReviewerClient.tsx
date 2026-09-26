"use client";

import { useState } from "react";
import ToolFrame from "@/components/layout/ToolFrame";
import Badge from "@/components/ui/Badge";
import { drafterFetch } from "./drafterFetch";
import ModelStatusBanner from "./ModelStatusBanner";

interface LintIssue {
  rule: string;
  severity: string;
  message: string;
}

interface JudgeCriterionResult {
  quote: string;
  pass: boolean;
  reason: string;
  suggestedRewrite: string | null;
}

interface JudgeOutput {
  criteria?: Record<string, JudgeCriterionResult>;
  overall?: "pass" | "fail";
  error?: string;
  invalid?: boolean;
}

interface ReviewerResponse {
  lint: LintIssue[];
  judge: JudgeOutput | null;
  judgeDisabledReason?: string;
  status: string;
}

/**
 * Paste-in reviewer (SPEC.md "Reviewer": "The reviewer also runs on text
 * pasted in by the user"). Stateless - lint + judge only, nothing saved.
 */
export default function DrafterReviewerClient() {
  const [controlText, setControlText] = useState("");
  const [rationale, setRationale] = useState("");
  const [sectionTitle, setSectionTitle] = useState("");
  const [result, setResult] = useState<ReviewerResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    const r = await drafterFetch<ReviewerResponse>("/api/drafter/reviewer", {
      method: "POST",
      body: JSON.stringify({ controlText, rationale, sectionTitle }),
    });
    if (r.ok && "lint" in r.data) setResult(r.data);
    else setError("error" in r.data ? r.data.error ?? "Review failed" : "Review failed");
    setBusy(false);
  };

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/drafter" }, { label: "PRA Drafter", href: "/drafter" }, { label: "Reviewer" }]}>
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Paste-in reviewer</h1>
            <p className="text-sm text-text-muted">Paste control text, its rationale and the section it targets to get the same lint + judge review a drafted enhancement gets. Nothing here is saved.</p>
          </div>

          <ModelStatusBanner />

          <div className="glass-card rounded-2xl p-6 space-y-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-text-muted">Section</span>
              <input className="border rounded px-2 py-1" value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} placeholder="e.g. 2.2 Customer Due Diligence (CDD) - Onboarding - Legal Person" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-text-muted">Control enhancement</span>
              <textarea className="border rounded px-2 py-1" rows={4} value={controlText} onChange={(e) => setControlText(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-text-muted">Rationale</span>
              <textarea className="border rounded px-2 py-1" rows={3} value={rationale} onChange={(e) => setRationale(e.target.value)} />
            </label>
            <button className="px-4 py-2 rounded bg-accent text-white text-sm disabled:opacity-50" disabled={busy || !controlText.trim()} onClick={run}>
              {busy ? "Reviewing..." : "Review"}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {result && (
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <Badge>{result.status.replace(/_/g, " ")}</Badge>

              <div>
                <h2 className="text-sm font-semibold mb-1">Code lint</h2>
                {result.lint.length === 0 ? (
                  <p className="text-sm text-text-muted">No lint issues.</p>
                ) : (
                  <ul className="text-xs space-y-0.5">
                    {result.lint.map((issue, i) => (
                      <li key={i} className={issue.severity === "critical" ? "text-red-600" : "text-amber-700"}>
                        {issue.severity}: {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h2 className="text-sm font-semibold mb-1">Judge</h2>
                {result.judgeDisabledReason && (
                  <p className="text-xs text-text-muted">Automated review is switched off until a model provider is configured.</p>
                )}
                {result.judge?.error && <p className="text-xs text-red-600">{result.judge.error}</p>}
                {result.judge?.criteria &&
                  Object.entries(result.judge.criteria).map(([key, c]) => (
                    <div key={key} className="text-xs border-t border-border pt-2 first:border-t-0 first:pt-0">
                      <p>
                        <Badge variant={c.pass ? "success" : "danger"}>{c.pass ? "pass" : "fail"}</Badge> <span className="font-medium">{key.replace(/_/g, " ")}</span>
                      </p>
                      <p className="text-text-muted italic">&quot;{c.quote}&quot;</p>
                      <p>{c.reason}</p>
                      {!c.pass && c.suggestedRewrite && <p className="text-text-muted">Suggested: {c.suggestedRewrite}</p>}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </ToolFrame>
  );
}
