"use client";

import { useState } from "react";
import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import {
  FINDING_SEVERITY_LABEL,
  type ControlTestFindingDTO,
  type FindingSeverity,
  type PersonDTO,
} from "./types";

const SEVERITY_BADGE: Record<FindingSeverity, "default" | "warning" | "danger"> = {
  low: "default",
  medium: "warning",
  high: "danger",
};

export interface NewFindingPayload {
  description: string;
  severity: FindingSeverity;
  sampleRef?: string;
  createAction: boolean;
  ownerPersonId?: string;
  dueDate?: string;
}

export interface EditFindingPayload {
  description: string;
  severity: FindingSeverity;
  sampleRef: string | null;
}

interface StepFindingsProps {
  findings: ControlTestFindingDTO[];
  people: PersonDTO[];
  readOnly: boolean;
  onAdd: (payload: NewFindingPayload) => Promise<boolean>;
  onEdit: (findingId: string, payload: EditFindingPayload) => Promise<boolean>;
  onDelete: (findingId: string) => Promise<boolean>;
}

const emptyDraft = { description: "", severity: "low" as FindingSeverity, sampleRef: "", createAction: false, ownerPersonId: "", dueDate: "" };

/** Step 3: add/edit/delete findings, with an explicit warning that any HIGH severity finding forces the whole test to fail and the control to weak, regardless of the pass rate. */
export default function StepFindings({ findings, people, readOnly, onAdd, onEdit, onDelete }: StepFindingsProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ description: "", severity: "low" as FindingSeverity, sampleRef: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const startEdit = (f: ControlTestFindingDTO) => {
    setEditingId(f.id);
    setEditDraft({ description: f.description, severity: f.severity, sampleRef: f.sample_ref ?? "" });
  };

  const submitAdd = async () => {
    if (!draft.description.trim()) {
      setAddError("Description is required.");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const ok = await onAdd({
        description: draft.description.trim(),
        severity: draft.severity,
        sampleRef: draft.sampleRef.trim() || undefined,
        createAction: draft.createAction,
        ownerPersonId: draft.createAction ? draft.ownerPersonId || undefined : undefined,
        dueDate: draft.createAction ? draft.dueDate || undefined : undefined,
      });
      if (ok) {
        setDraft(emptyDraft);
        setShowAdd(false);
      } else {
        setAddError("Could not add that finding. Please try again.");
      }
    } finally {
      setAdding(false);
    }
  };

  const submitEdit = async (id: string) => {
    if (!editDraft.description.trim()) return;
    setSaving(true);
    try {
      const ok = await onEdit(id, {
        description: editDraft.description.trim(),
        severity: editDraft.severity,
        sampleRef: editDraft.sampleRef.trim() || null,
      });
      if (ok) setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  const hasHigh = findings.some((f) => f.severity === "high");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Findings</h2>
        <p className="text-sm text-text-muted">
          Record any issues the test uncovered. Optionally raise a follow-up action for each one.
        </p>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-sm text-red-500">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Any HIGH severity finding forces the whole test to fail and the control to be rated weak, no matter how
          good the pass rate is. Use HIGH only for issues that mean the control cannot be relied on.
        </span>
      </div>

      {hasHigh && (
        <p className="text-xs text-red-500 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" /> This test currently has at least one HIGH severity finding.
        </p>
      )}

      {!readOnly && (
        <div>
          {!showAdd ? (
            <Button size="sm" variant="secondary" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" /> Add finding
            </Button>
          ) : (
            <div className="glass-card rounded-xl p-4 space-y-3">
              <Input
                label="Description"
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-ink-soft">Severity</label>
                  <select
                    value={draft.severity}
                    onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value as FindingSeverity }))}
                    className="px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  >
                    {(Object.keys(FINDING_SEVERITY_LABEL) as FindingSeverity[]).map((s) => (
                      <option key={s} value={s}>
                        {FINDING_SEVERITY_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Sample reference (optional)"
                  value={draft.sampleRef}
                  onChange={(e) => setDraft((d) => ({ ...d, sampleRef: e.target.value }))}
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.createAction}
                  onChange={(e) => setDraft((d) => ({ ...d, createAction: e.target.checked }))}
                  className="h-4 w-4 rounded border-line-2 text-accent focus:ring-accent/30"
                />
                <span className="text-sm font-medium text-foreground">Create a follow-up action for this finding</span>
              </label>

              {draft.createAction && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-ink-soft">Owner</label>
                    <select
                      value={draft.ownerPersonId}
                      onChange={(e) => setDraft((d) => ({ ...d, ownerPersonId: e.target.value }))}
                      className="px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                    >
                      <option value="">Unassigned</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input
                    type="date"
                    label="Due date"
                    value={draft.dueDate}
                    onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
                  />
                </div>
              )}

              {addError && <p className="text-xs text-red-500">{addError}</p>}
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={submitAdd} disabled={adding}>
                  {adding ? "Adding..." : "Add finding"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setDraft(emptyDraft); setAddError(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {findings.length === 0 && <p className="text-sm text-text-muted">No findings recorded.</p>}
        {findings.map((f) => (
          <div key={f.id} className="glass-card rounded-xl p-4">
            {editingId === f.id ? (
              <div className="space-y-3">
                <Input
                  label="Description"
                  value={editDraft.description}
                  onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                />
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-ink-soft">Severity</label>
                    <select
                      value={editDraft.severity}
                      onChange={(e) => setEditDraft((d) => ({ ...d, severity: e.target.value as FindingSeverity }))}
                      className="px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                    >
                      {(Object.keys(FINDING_SEVERITY_LABEL) as FindingSeverity[]).map((s) => (
                        <option key={s} value={s}>
                          {FINDING_SEVERITY_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label="Sample reference"
                    value={editDraft.sampleRef}
                    onChange={(e) => setEditDraft((d) => ({ ...d, sampleRef: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => submitEdit(f.id)} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={SEVERITY_BADGE[f.severity]}>{FINDING_SEVERITY_LABEL[f.severity]}</Badge>
                    {f.action_id && <Badge>Action raised</Badge>}
                  </div>
                  <p className="text-sm text-foreground mt-1.5">{f.description}</p>
                  {f.sample_ref && <p className="text-xs text-text-muted mt-0.5">Sample: {f.sample_ref}</p>}
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(f)}
                      aria-label="Edit finding"
                      className="p-1.5 text-text-muted hover:text-accent cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(f.id)}
                      disabled={deletingId === f.id}
                      aria-label="Delete finding"
                      className="p-1.5 text-text-muted hover:text-red-500 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
