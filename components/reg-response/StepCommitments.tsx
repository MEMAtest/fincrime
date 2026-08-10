"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatIsoDate } from "@/lib/format/date";
import {
  REG_COMMITMENT_STATUS_LABEL,
  type ActionDTO,
  type PersonDTO,
  type RegCommitmentDTO,
  type RegCommitmentStatus,
} from "./types";

const STATUSES: RegCommitmentStatus[] = ["open", "in_progress", "met", "missed", "withdrawn"];

export interface NewCommitmentPayload {
  description: string;
  dueDate?: string;
  ownerPersonId?: string;
  note?: string;
}

export interface CommitmentPatch {
  description?: string;
  dueDate?: string | null;
  ownerPersonId?: string | null;
  status?: RegCommitmentStatus;
  note?: string | null;
}

interface StepCommitmentsProps {
  commitments: RegCommitmentDTO[];
  people: PersonDTO[];
  actions: ActionDTO[];
  readOnly: boolean;
  onAdd: (payload: NewCommitmentPayload) => Promise<{ ok: true } | { ok: false; message: string }>;
  onSave: (commitmentId: string, patch: CommitmentPatch) => Promise<{ ok: true } | { ok: false; message: string }>;
}

function fmtDate(iso: string | null): string {
  return formatIsoDate(iso, { fallback: "No due date", style: "long" });
}

const ACTION_STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "danger"> = {
  open: "default",
  in_progress: "warning",
  done: "success",
  cancelled: "danger",
};

/**
 * Step 5: commitments made to the regulator. A commitment with a due date
 * creates a tracked action server-side (see createRegCommitment in
 * lib/repo/reg-requests.ts) - that is the mechanic this whole module exists
 * for, so it is made explicit here: the "creates a tracked action" note and
 * the linked action's live status are both shown next to every commitment
 * with a due date. Marking a commitment 'met' closes its action in the same
 * server transaction; a commitment without a due date has no action to show.
 */
export default function StepCommitments({ commitments, people, actions, readOnly, onAdd, onSave }: StepCommitmentsProps) {
  const [draft, setDraft] = useState({ description: "", dueDate: "", ownerPersonId: "", note: "" });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const actionById = useMemo(() => new Map(actions.map((a) => [a.id, a])), [actions]);

  async function submitAdd() {
    if (!draft.description.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      const result = await onAdd({
        description: draft.description.trim(),
        dueDate: draft.dueDate || undefined,
        ownerPersonId: draft.ownerPersonId || undefined,
        note: draft.note.trim() || undefined,
      });
      if (result.ok) {
        setDraft({ description: "", dueDate: "", ownerPersonId: "", note: "" });
      } else {
        setAddError(result.message);
      }
    } finally {
      setAdding(false);
    }
  }

  async function commit(commitmentId: string, patch: CommitmentPatch) {
    setSavingId(commitmentId);
    setErrorById((prev) => ({ ...prev, [commitmentId]: "" }));
    try {
      const result = await onSave(commitmentId, patch);
      if (!result.ok) setErrorById((prev) => ({ ...prev, [commitmentId]: result.message }));
    } finally {
      setSavingId((id) => (id === commitmentId ? null : id));
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Commitments</h2>
        <p className="text-sm text-text-muted">
          Record every promise made in this response. A commitment with a due date becomes a tracked action
          automatically, so it shows up as live, overdue work rather than a forgotten line in a document.
        </p>
      </div>

      {!readOnly && (
        <div className="glass-card rounded-xl p-4 space-y-3">
          <label className="text-xs font-medium text-ink-soft">Add a commitment</label>
          <Input
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="e.g. Implement enhanced screening thresholds for correspondent banking"
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              type="date"
              label="Due date (optional - creates a tracked action)"
              value={draft.dueDate}
              onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-soft">Owner (optional)</label>
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
          </div>
          <Input
            label="Note (optional)"
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
          />
          {addError && <p className="text-xs text-red-500">{addError}</p>}
          <Button size="sm" onClick={() => void submitAdd()} disabled={adding || !draft.description.trim()}>
            <Plus className="h-3.5 w-3.5" /> Add commitment
          </Button>
        </div>
      )}

      {commitments.length === 0 ? (
        <p className="text-sm text-text-muted">No commitments recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {commitments.map((c) => {
            const action = c.action_id ? actionById.get(c.action_id) : undefined;
            const commitField = (patch: CommitmentPatch) => void commit(c.id, patch);
            return (
              <div key={c.id} className="glass-card rounded-xl p-4 space-y-3">
                <Input
                  key={`${c.id}-description`}
                  label="Description"
                  defaultValue={c.description}
                  disabled={readOnly}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== c.description) commitField({ description: v });
                  }}
                />

                <div className="grid sm:grid-cols-2 gap-3">
                  <Input
                    key={`${c.id}-dueDate`}
                    type="date"
                    label="Due date (creates a tracked action)"
                    defaultValue={c.due_date ? c.due_date.slice(0, 10) : ""}
                    disabled={readOnly}
                    onBlur={(e) => {
                      const v = e.target.value || null;
                      const current = c.due_date ? c.due_date.slice(0, 10) : null;
                      if (v !== current) commitField({ dueDate: v });
                    }}
                  />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-ink-soft">Owner</label>
                    <select
                      key={`${c.id}-owner-${c.owner_person_id ?? "none"}`}
                      defaultValue={c.owner_person_id ?? ""}
                      disabled={readOnly}
                      onChange={(e) => commitField({ ownerPersonId: e.target.value || null })}
                      className="px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-60"
                    >
                      <option value="">Unassigned</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <Input
                  key={`${c.id}-note`}
                  label="Note (optional)"
                  defaultValue={c.note ?? ""}
                  disabled={readOnly}
                  onBlur={(e) => {
                    const v = e.target.value.trim() || null;
                    if (v !== c.note) commitField({ note: v });
                  }}
                />

                <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <span>Due: {fmtDate(c.due_date)}</span>
                  <span>&middot;</span>
                  <span>Owner: {c.owner_person_id ? personById.get(c.owner_person_id)?.name ?? "Unknown" : "Unassigned"}</span>
                  {c.due_date && (
                    <>
                      <span>&middot;</span>
                      {action ? (
                        <span className="inline-flex items-center gap-1.5">
                          Tracked action:
                          <Badge variant={ACTION_STATUS_VARIANT[action.status] ?? "default"}>{action.status.replace(/_/g, " ")}</Badge>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-500">
                          <AlertTriangle className="h-3 w-3" /> No tracked action found
                        </span>
                      )}
                    </>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-ink-soft">Status</label>
                  <div className="flex flex-wrap gap-2">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={readOnly}
                        onClick={() => void commit(c.id, { status: s })}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                          c.status === s ? "border-accent bg-accent/5 text-accent" : "border-line-2 bg-surface text-foreground hover:border-accent/40"
                        }`}
                      >
                        {REG_COMMITMENT_STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                  {c.status === "open" || c.status === "in_progress" ? (
                    <p className="text-xs text-text-muted">Marking this &quot;Met&quot; closes its tracked action, if it has one.</p>
                  ) : null}
                </div>

                {savingId === c.id && <p className="text-xs text-text-muted">Saving...</p>}
                {errorById[c.id] && <p className="text-xs text-red-500">{errorById[c.id]}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
