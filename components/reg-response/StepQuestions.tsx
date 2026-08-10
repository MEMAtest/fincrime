"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { REG_QUESTION_STATUS_LABEL, type RegQuestionDTO } from "./types";

export interface QuestionPatch {
  question?: string;
}

interface StepQuestionsProps {
  questions: RegQuestionDTO[];
  readOnly: boolean;
  onAdd: (question: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  onSave: (questionId: string, patch: QuestionPatch) => Promise<{ ok: true } | { ok: false; message: string }>;
  onDelete: (questionId: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  onReorder: (orderedQuestionIds: string[]) => Promise<{ ok: true } | { ok: false; message: string }>;
}

/**
 * Step 2: the question list itself - add, edit, delete and reorder (via
 * up/down buttons calling the reorder endpoint with the full ordered id
 * list, which is less fragile than drag-and-drop and does not need one).
 * Position is server-owned (POST always appends, PATCH never accepts
 * position) - this step is the only place ordering changes, and it always
 * sends the complete set of ids per reorderRegQuestions's contract.
 */
export default function StepQuestions({ questions, readOnly, onAdd, onSave, onDelete, onReorder }: StepQuestionsProps) {
  const [newQuestion, setNewQuestion] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [reordering, setReordering] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sorted = [...questions].sort((a, b) => a.position - b.position);

  async function submitAdd() {
    const q = newQuestion.trim();
    if (!q) return;
    setAdding(true);
    setAddError(null);
    try {
      const result = await onAdd(q);
      if (result.ok) setNewQuestion("");
      else setAddError(result.message);
    } finally {
      setAdding(false);
    }
  }

  async function commit(questionId: string, patch: QuestionPatch) {
    setSavingId(questionId);
    setErrorById((prev) => ({ ...prev, [questionId]: "" }));
    try {
      const result = await onSave(questionId, patch);
      if (!result.ok) setErrorById((prev) => ({ ...prev, [questionId]: result.message }));
    } finally {
      setSavingId((id) => (id === questionId ? null : id));
    }
  }

  async function remove(questionId: string) {
    setDeletingId(questionId);
    try {
      await onDelete(questionId);
    } finally {
      setDeletingId((id) => (id === questionId ? null : id));
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sorted.length) return;
    const ids = sorted.map((q) => q.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setReordering(true);
    setReorderError(null);
    try {
      const result = await onReorder(ids);
      if (!result.ok) setReorderError(result.message);
    } finally {
      setReordering(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Questions</h2>
        <p className="text-sm text-text-muted">
          Break the request down into the individual questions the regulator is asking. Answer, substantiate and
          reorder them over the next steps.
        </p>
      </div>

      {!readOnly && (
        <div className="glass-card rounded-xl p-4 space-y-3">
          <label className="text-xs font-medium text-ink-soft">Add a question</label>
          <div className="flex flex-wrap items-start gap-2">
            <textarea
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              rows={2}
              placeholder="e.g. Describe your transaction monitoring thresholds for high-risk customers."
              className="flex-1 min-w-[240px] px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
            />
            <Button size="sm" onClick={() => void submitAdd()} disabled={adding || !newQuestion.trim()}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          {addError && <p className="text-xs text-red-500">{addError}</p>}
        </div>
      )}

      {reorderError && <p className="text-xs text-red-500">{reorderError}</p>}

      {sorted.length === 0 ? (
        <p className="text-sm text-text-muted">No questions logged yet.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((q, index) => (
            <div key={q.id} className="glass-card rounded-xl p-4 space-y-2">
              <div className="flex items-start gap-3">
                <span className="text-xs font-semibold text-text-muted mt-2.5 shrink-0">#{index + 1}</span>
                <textarea
                  key={`${q.id}-question`}
                  defaultValue={q.question}
                  disabled={readOnly}
                  rows={2}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== q.question) void commit(q.id, { question: v });
                  }}
                  className="flex-1 px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors disabled:opacity-60"
                />
                <div className="flex flex-col gap-1 shrink-0">
                  {!readOnly && (
                    <>
                      <button
                        type="button"
                        aria-label="Move up"
                        disabled={index === 0 || reordering}
                        onClick={() => void move(index, -1)}
                        className="p-1.5 text-text-muted hover:text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        disabled={index === sorted.length - 1 || reordering}
                        onClick={() => void move(index, 1)}
                        className="p-1.5 text-text-muted hover:text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete question"
                        disabled={deletingId === q.id}
                        onClick={() => void remove(q.id)}
                        className="p-1.5 text-text-muted hover:text-red-500 cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 pl-7">
                <Badge variant={q.status === "reviewed" ? "success" : q.status === "drafted" ? "warning" : "default"}>
                  {REG_QUESTION_STATUS_LABEL[q.status]}
                </Badge>
                {q.links.length > 0 && (
                  <span className="text-xs text-text-muted">
                    {q.links.length} substantiating link{q.links.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              {savingId === q.id && <p className="text-xs text-text-muted pl-7">Saving...</p>}
              {errorById[q.id] && <p className="text-xs text-red-500 pl-7">{errorById[q.id]}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
