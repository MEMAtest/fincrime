"use client";

import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { EvidenceDTO } from "./types";

const EVIDENCE_TYPES = ["policy_reference", "sign_off", "sample_data", "screenshot", "correspondence", "regulatory_guidance", "other"];

export interface NewEvidencePayload {
  type: string;
  title: string;
  description?: string;
  linkUrl?: string;
  evidenceDate?: string;
}

interface StepEvidenceProps {
  evidence: EvidenceDTO[];
  readOnly: boolean;
  onAdd: (payload: NewEvidencePayload) => Promise<boolean>;
}

/** Step 5: assessment-level evidence, separate from the obligation-scoped evidence attached in step 4. Same shape as components/incidents/StepEvidence.tsx. */
export default function StepEvidence({ evidence, readOnly, onAdd }: StepEvidenceProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ type: "policy_reference", title: "", description: "", linkUrl: "", evidenceDate: "" });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!draft.title.trim()) {
      setError("Title is required.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const ok = await onAdd({
        type: draft.type,
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        linkUrl: draft.linkUrl.trim() || undefined,
        evidenceDate: draft.evidenceDate || undefined,
      });
      if (ok) {
        setDraft({ type: "policy_reference", title: "", description: "", linkUrl: "", evidenceDate: "" });
        setShowAdd(false);
      } else {
        setError("Could not add that evidence. Please try again.");
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Evidence</h2>
        <p className="text-sm text-text-muted">
          Attach the working papers, policies or sign-offs that support this readiness assessment as a whole. Use the
          Gaps step for evidence tied to a specific obligation.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent" /> Evidence ({evidence.length})
          </h3>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setShowAdd((o) => !o)}
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline cursor-pointer"
            >
              <Plus className="h-3 w-3" /> Add evidence
            </button>
          )}
        </div>

        {showAdd && !readOnly && (
          <div className="glass-card rounded-xl p-4 mb-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ink-soft">Type</label>
                <select
                  value={draft.type}
                  onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                >
                  {EVIDENCE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <Input label="Title" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
            </div>
            <Input
              label="Description (optional)"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Link URL (optional)"
                value={draft.linkUrl}
                onChange={(e) => setDraft((d) => ({ ...d, linkUrl: e.target.value }))}
              />
              <Input
                type="date"
                label="Evidence date (optional)"
                value={draft.evidenceDate}
                onChange={(e) => setDraft((d) => ({ ...d, evidenceDate: e.target.value }))}
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <Button size="sm" onClick={submit} disabled={adding}>
              {adding ? "Adding..." : "Add evidence"}
            </Button>
          </div>
        )}

        {evidence.length === 0 ? (
          <p className="text-sm text-text-muted">No evidence recorded yet.</p>
        ) : (
          <div className="space-y-1.5">
            {evidence.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/10 text-sm">
                <div className="min-w-0">
                  <span className="text-foreground">{e.title}</span>
                  {e.description && <span className="text-xs text-text-muted ml-2">{e.description}</span>}
                  {e.link_url && (
                    <a href={e.link_url} target="_blank" rel="noreferrer" className="text-xs text-accent ml-2 hover:underline">
                      link
                    </a>
                  )}
                </div>
                <span className="text-xs text-text-muted shrink-0">{e.type.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
