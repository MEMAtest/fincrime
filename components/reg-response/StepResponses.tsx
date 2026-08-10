"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { REG_QUESTION_STATUS_LABEL, type RegQuestionDTO, type RegQuestionStatus } from "./types";

const STATUSES: RegQuestionStatus[] = ["unanswered", "drafted", "reviewed"];

export interface ResponsePatch {
  response?: string | null;
  exceptionNote?: string | null;
  status?: RegQuestionStatus;
}

interface StepResponsesProps {
  questions: RegQuestionDTO[];
  readOnly: boolean;
  onSave: (questionId: string, patch: ResponsePatch) => Promise<{ ok: true } | { ok: false; message: string }>;
}

/**
 * Step 3: answer each question. The response is the substantive answer; the
 * exception note is where an honest "we do not do this yet" belongs instead
 * - mixing the two makes a gap read as a claim of compliance, which is
 * exactly what a response pack must never do. The unanswered count here is
 * the same count approveResponse checks server-side (see StepApproval), so
 * it is shown prominently rather than buried in a badge.
 */
export default function StepResponses({ questions, readOnly, onSave }: StepResponsesProps) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  const sorted = [...questions].sort((a, b) => a.position - b.position);
  const unanswered = sorted.filter((q) => q.status === "unanswered");

  async function commit(questionId: string, patch: ResponsePatch) {
    setSavingId(questionId);
    setErrorById((prev) => ({ ...prev, [questionId]: "" }));
    try {
      const result = await onSave(questionId, patch);
      if (!result.ok) setErrorById((prev) => ({ ...prev, [questionId]: result.message }));
    } finally {
      setSavingId((id) => (id === questionId ? null : id));
    }
  }

  if (sorted.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-1">Responses</h2>
          <p className="text-sm text-text-muted">Add questions in the previous step first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Responses</h2>
        <p className="text-sm text-text-muted">
          Answer each question. If something is not yet in place, say so plainly in the exception note rather than in
          the response itself.
        </p>
      </div>

      {unanswered.length > 0 ? (
        <div className="glass-card rounded-xl p-4 border border-red-400/30 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm font-semibold text-foreground">
            {unanswered.length} question{unanswered.length === 1 ? " is" : "s are"} still unanswered
          </p>
          <span className="text-xs text-text-muted ml-auto">This blocks approval.</span>
        </div>
      ) : (
        <div className="glass-card rounded-xl p-4 text-sm text-text-muted">Every question has a status other than unanswered.</div>
      )}

      <div className="space-y-4">
        {sorted.map((q, index) => (
          <div key={q.id} className="glass-card rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">
              #{index + 1}. {q.question}
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-soft">Response</label>
              <textarea
                key={`${q.id}-response`}
                defaultValue={q.response ?? ""}
                disabled={readOnly}
                rows={4}
                placeholder="The substantive answer to this question."
                onBlur={(e) => {
                  const v = e.target.value.trim() || null;
                  if (v !== q.response) void commit(q.id, { response: v });
                }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors disabled:opacity-60"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-soft">Exception note (optional)</label>
              <textarea
                key={`${q.id}-exceptionNote`}
                defaultValue={q.exception_note ?? ""}
                disabled={readOnly}
                rows={2}
                placeholder="An honest &quot;we do not do this yet&quot; belongs here, not in the response above."
                onBlur={(e) => {
                  const v = e.target.value.trim() || null;
                  if (v !== q.exception_note) void commit(q.id, { exceptionNote: v });
                }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors disabled:opacity-60"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-soft">Status</label>
              <div className="flex gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={readOnly}
                    onClick={() => void commit(q.id, { status: s })}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                      q.status === s ? "border-accent bg-accent/5 text-accent" : "border-line-2 bg-surface text-foreground hover:border-accent/40"
                    }`}
                  >
                    {REG_QUESTION_STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>

            {savingId === q.id && <p className="text-xs text-text-muted">Saving...</p>}
            {errorById[q.id] && <p className="text-xs text-red-500">{errorById[q.id]}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
