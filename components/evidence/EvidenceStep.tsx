"use client";

import { useRef, useState } from "react";
import { FileText, Plus, Paperclip, Download, X, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import type { EvidenceDTO } from "@/components/pra/types";

export interface NewEvidencePayload {
  type: string;
  title: string;
  description?: string;
  linkUrl?: string;
  evidenceDate?: string;
}

interface EvidenceStepProps {
  /** Per-journey copy: what this evidence list is for (control-testing/incidents/readiness each word this slightly differently). */
  description: string;
  evidenceTypes: string[];
  defaultType: string;
  evidence: EvidenceDTO[];
  loading?: boolean;
  readOnly: boolean;
  onAdd: (payload: NewEvidencePayload) => Promise<boolean>;
  /** Called after a file is attached or removed, so the parent's evidence state stays in sync (this component never owns the list itself). */
  onEvidenceUpdated: (updated: EvidenceDTO) => void;
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Shared evidence step used by control-testing, incidents and readiness
 * (their StepEvidence.tsx components were three near-identical copies -
 * differing only in evidenceTypes/defaultType/description - now
 * consolidated here so file-attach support exists in exactly one place).
 * Regulatory response's evidence display works differently (StepApproval.tsx
 * shows workspace-level evidence LINKED via StepSubstantiation, rather than
 * creating subject-scoped evidence rows itself), so it is not folded into
 * this component - it reads file metadata directly off EvidenceDTO instead.
 */
export default function EvidenceStep({
  description,
  evidenceTypes,
  defaultType,
  evidence,
  loading,
  readOnly,
  onAdd,
  onEvidenceUpdated,
}: EvidenceStepProps) {
  const { wsFetch } = useWorkspace();
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ type: defaultType, title: "", description: "", linkUrl: "", evidenceDate: "" });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileBusyId, setFileBusyId] = useState<string | null>(null);
  const [fileErrorById, setFileErrorById] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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
        setDraft({ type: defaultType, title: "", description: "", linkUrl: "", evidenceDate: "" });
        setShowAdd(false);
      } else {
        setError("Could not add that evidence. Please try again.");
      }
    } finally {
      setAdding(false);
    }
  };

  const uploadFile = async (evidenceId: string, file: File) => {
    setFileBusyId(evidenceId);
    setFileErrorById((prev) => ({ ...prev, [evidenceId]: "" }));
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await wsFetch(`/api/evidence/${evidenceId}/file`, { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFileErrorById((prev) => ({
          ...prev,
          [evidenceId]: typeof data?.error === "string" ? data.error : "Could not upload that file.",
        }));
        return;
      }
      if (data?.evidence) onEvidenceUpdated(data.evidence);
    } catch {
      setFileErrorById((prev) => ({ ...prev, [evidenceId]: "Could not upload that file. Please try again." }));
    } finally {
      setFileBusyId(null);
    }
  };

  const removeFile = async (evidenceId: string) => {
    setFileBusyId(evidenceId);
    setFileErrorById((prev) => ({ ...prev, [evidenceId]: "" }));
    try {
      const res = await wsFetch(`/api/evidence/${evidenceId}/file`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFileErrorById((prev) => ({
          ...prev,
          [evidenceId]: typeof data?.error === "string" ? data.error : "Could not remove that file.",
        }));
        return;
      }
      if (data?.evidence) onEvidenceUpdated(data.evidence);
    } catch {
      setFileErrorById((prev) => ({ ...prev, [evidenceId]: "Could not remove that file. Please try again." }));
    } finally {
      setFileBusyId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Evidence</h2>
        <p className="text-sm text-text-muted">{description}</p>
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
                  {evidenceTypes.map((t) => (
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
            <p className="text-xs text-text-muted">
              A file can be attached once this evidence item is saved (the row below it gets an &quot;Attach file&quot; control).
            </p>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-text-muted">Loading evidence...</p>
        ) : evidence.length === 0 ? (
          <p className="text-sm text-text-muted">No evidence recorded yet.</p>
        ) : (
          <div className="space-y-1.5">
            {evidence.map((e) => {
              const busy = fileBusyId === e.id;
              const rowError = fileErrorById[e.id];
              return (
                <div key={e.id} className="rounded-lg bg-white/[0.02] border border-white/10 text-sm">
                  <div className="flex items-center justify-between gap-2 p-2.5">
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

                  <div className="flex items-center gap-2 px-2.5 pb-2.5 flex-wrap">
                    {e.file_url ? (
                      <>
                        <a
                          href={e.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                        >
                          <Download className="h-3 w-3" /> {e.file_name}
                          {e.file_size_bytes !== null && (
                            <span className="text-text-muted">({formatFileSize(e.file_size_bytes)})</span>
                          )}
                        </a>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => void removeFile(e.id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-red-500 cursor-pointer disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />} Remove file
                          </button>
                        )}
                      </>
                    ) : (
                      !readOnly && (
                        <>
                          <input
                            ref={(el) => {
                              fileInputRefs.current[e.id] = el;
                            }}
                            type="file"
                            className="hidden"
                            onChange={(ev) => {
                              const file = ev.target.files?.[0];
                              ev.target.value = "";
                              if (file) void uploadFile(e.id, file);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRefs.current[e.id]?.click()}
                            disabled={busy}
                            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline cursor-pointer disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />} Attach file
                          </button>
                        </>
                      )
                    )}
                    {rowError && <span className="text-xs text-red-500">{rowError}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
