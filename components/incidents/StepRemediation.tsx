"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { PriorityBadge } from "@/components/controls/ControlBits";
import type { ActionDTO, ActionPriority, PersonDTO } from "./types";

export interface NewActionPayload {
  title: string;
  ownerPersonId?: string;
  dueDate?: string;
  priority: ActionPriority;
}

interface StepRemediationProps {
  actions: ActionDTO[];
  people: PersonDTO[];
  readOnly: boolean;
  onAdd: (payload: NewActionPayload) => Promise<boolean>;
  onMarkDone: (actionId: string) => Promise<boolean>;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Step 5: remediation actions raised against this incident - the changes made to the control(s) in response to it - with an explicit warning that the incident cannot be closed while any of them is still open. */
export default function StepRemediation({ actions, people, readOnly, onAdd, onMarkDone }: StepRemediationProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [ownerPersonId, setOwnerPersonId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<ActionPriority>("medium");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const openActions = actions.filter((a) => a.status !== "done" && a.status !== "cancelled");

  const submitAdd = async () => {
    if (!title.trim()) {
      setAddError("Title is required.");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const ok = await onAdd({
        title: title.trim(),
        ownerPersonId: ownerPersonId || undefined,
        dueDate: dueDate || undefined,
        priority,
      });
      if (ok) {
        setTitle("");
        setOwnerPersonId("");
        setDueDate("");
        setPriority("medium");
        setShowAdd(false);
      } else {
        setAddError("Could not add that action. Please try again.");
      }
    } finally {
      setAdding(false);
    }
  };

  const markDone = async (id: string) => {
    setCompletingId(id);
    try {
      await onMarkDone(id);
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Remediation</h2>
        <p className="text-sm text-text-muted">
          The changes made to the control(s) in response to this incident. This is the step that proves the loop
          closed: an incident occurred, and remediation changed something as a result.
        </p>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          This incident cannot be closed while any remediation action below is still open or in progress
          {openActions.length > 0 && (
            <>
              {" "}
              - <strong>{openActions.length}</strong> currently {openActions.length === 1 ? "is" : "are"}.
            </>
          )}
          .
        </span>
      </div>

      {!readOnly && (
        <div>
          {!showAdd ? (
            <Button size="sm" variant="secondary" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" /> Add remediation action
            </Button>
          ) : (
            <div className="glass-card rounded-xl p-4 space-y-3">
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-ink-soft">Owner</label>
                  <select
                    value={ownerPersonId}
                    onChange={(e) => setOwnerPersonId(e.target.value)}
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
                <Input type="date" label="Due date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-ink-soft">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as ActionPriority)}
                    className="px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              {addError && <p className="text-xs text-red-500">{addError}</p>}
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={submitAdd} disabled={adding}>
                  {adding ? "Adding..." : "Add action"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setAddError(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {actions.length === 0 && <p className="text-sm text-text-muted">No remediation actions recorded.</p>}
        {actions.map((a) => {
          const done = a.status === "done" || a.status === "cancelled";
          const owner = people.find((p) => p.id === a.owner_person_id);
          return (
            <div key={a.id} className="glass-card rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm ${done ? "text-text-muted line-through" : "text-foreground"}`}>{a.title}</span>
                  <PriorityBadge priority={a.priority} />
                  <Badge variant={done ? "success" : "warning"}>{a.status.replace(/_/g, " ")}</Badge>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  {owner?.name ?? "Unassigned"} &middot; {fmtDate(a.due_date)}
                </p>
              </div>
              {!readOnly && !done && (
                <button
                  type="button"
                  onClick={() => void markDone(a.id)}
                  disabled={completingId === a.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line-2 text-xs text-foreground hover:border-accent/40 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> {completingId === a.id ? "Saving..." : "Mark done"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
