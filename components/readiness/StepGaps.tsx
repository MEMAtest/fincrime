"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, FileText, Plus } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { PrioritySelect } from "@/components/controls/ControlBits";
import {
  READINESS_GAP_LABEL,
  type ActionPriority,
  type EvidenceDTO,
  type PersonDTO,
  type ReadinessObligationDTO,
} from "./types";

export interface ObligationGapPatch {
  blocker?: boolean;
  ownerPersonId?: string | null;
  dueDate?: string | null;
}

export interface NewObligationActionPayload {
  title: string;
  ownerPersonId?: string;
  dueDate?: string;
  priority?: ActionPriority;
}

export interface NewObligationEvidencePayload {
  type: string;
  title: string;
  description?: string;
  linkUrl?: string;
}

interface StepGapsProps {
  obligations: ReadinessObligationDTO[];
  people: PersonDTO[];
  readOnly: boolean;
  onSave: (obligationId: string, patch: ObligationGapPatch) => Promise<{ ok: true } | { ok: false; message: string }>;
  onAddAction: (obligationId: string, payload: NewObligationActionPayload) => Promise<boolean>;
  onLoadEvidence: (obligationId: string) => Promise<EvidenceDTO[]>;
  onAddEvidence: (obligationId: string, payload: NewObligationEvidencePayload) => Promise<boolean>;
}

function toDateInput(v: string | null): string {
  if (!v) return "";
  return v.slice(0, 10);
}

/**
 * Step 4: the blocker view. Marking an obligation a launch blocker while its
 * gap is not 'full' is exactly what refuses approve-local/approve-global on
 * the server (see approveLocal/approveGlobal in lib/repo/readiness.ts), so
 * the unresolved-blockers panel at the top of this step surfaces precisely
 * that set. Each obligation can also take an owner, a due date, a follow-up
 * action, and obligation-scoped evidence.
 */
export default function StepGaps({ obligations, people, readOnly, onSave, onAddAction, onLoadEvidence, onAddEvidence }: StepGapsProps) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [evidenceById, setEvidenceById] = useState<Record<string, EvidenceDTO[]>>({});
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  const [actionTitle, setActionTitle] = useState("");
  const [actionOwner, setActionOwner] = useState("");
  const [actionDue, setActionDue] = useState("");
  const [actionPriority, setActionPriority] = useState<ActionPriority>("medium");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [evType, setEvType] = useState("policy_reference");
  const [evTitle, setEvTitle] = useState("");
  const [evLink, setEvLink] = useState("");
  const [evBusy, setEvBusy] = useState(false);
  const [evError, setEvError] = useState<string | null>(null);

  const unresolvedBlockers = obligations.filter((o) => o.blocker && o.gap !== "full");

  async function commit(obligationId: string, patch: ObligationGapPatch) {
    setSavingId(obligationId);
    setErrorById((prev) => ({ ...prev, [obligationId]: "" }));
    try {
      const result = await onSave(obligationId, patch);
      if (!result.ok) setErrorById((prev) => ({ ...prev, [obligationId]: result.message }));
    } finally {
      setSavingId((id) => (id === obligationId ? null : id));
    }
  }

  async function toggleExpand(obligationId: string) {
    const next = expandedId === obligationId ? null : obligationId;
    setExpandedId(next);
    setActionMessage(null);
    setEvError(null);
    if (next && !evidenceById[next]) {
      setEvidenceLoading(true);
      try {
        const list = await onLoadEvidence(next);
        setEvidenceById((prev) => ({ ...prev, [next]: list }));
      } finally {
        setEvidenceLoading(false);
      }
    }
  }

  async function submitAction(obligationId: string) {
    if (!actionTitle.trim()) return;
    setActionBusy(true);
    setActionMessage(null);
    try {
      const ok = await onAddAction(obligationId, {
        title: actionTitle.trim(),
        ownerPersonId: actionOwner || undefined,
        dueDate: actionDue || undefined,
        priority: actionPriority,
      });
      setActionMessage(ok ? "Action added." : "Could not add that action. Please try again.");
      if (ok) {
        setActionTitle("");
        setActionOwner("");
        setActionDue("");
        setActionPriority("medium");
      }
    } finally {
      setActionBusy(false);
    }
  }

  async function submitEvidence(obligationId: string) {
    if (!evTitle.trim()) return;
    setEvBusy(true);
    setEvError(null);
    try {
      const ok = await onAddEvidence(obligationId, { type: evType, title: evTitle.trim(), linkUrl: evLink.trim() || undefined });
      if (!ok) {
        setEvError("Could not add that evidence. Please try again.");
        return;
      }
      const list = await onLoadEvidence(obligationId);
      setEvidenceById((prev) => ({ ...prev, [obligationId]: list }));
      setEvTitle("");
      setEvLink("");
    } finally {
      setEvBusy(false);
    }
  }

  if (obligations.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-1">Gaps</h2>
          <p className="text-sm text-text-muted">Generate the obligation register first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Gaps</h2>
        <p className="text-sm text-text-muted">
          Mark the obligations that must be resolved before launch, assign an owner and due date, and evidence the
          work.
        </p>
      </div>

      {unresolvedBlockers.length > 0 ? (
        <div className="glass-card rounded-xl p-5 border border-red-400/30 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <p className="text-sm font-semibold text-foreground">
              {unresolvedBlockers.length} unresolved launch blocker{unresolvedBlockers.length === 1 ? "" : "s"}
            </p>
          </div>
          <p className="text-xs text-text-muted">
            These will refuse local and global approval until each is resolved to a &quot;Fully met&quot; gap.
          </p>
          <ul className="text-sm text-foreground space-y-1 pt-1">
            {unresolvedBlockers.map((o) => (
              <li key={o.id} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                {o.title}
                <span className="text-xs text-text-muted">({READINESS_GAP_LABEL[o.gap]})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="glass-card rounded-xl p-4 text-sm text-text-muted">No unresolved launch blockers right now.</div>
      )}

      <div className="space-y-3">
        {obligations.map((o) => {
          const isUnresolved = o.blocker && o.gap !== "full";
          const expanded = expandedId === o.id;
          return (
            <div key={o.id} className={`glass-card rounded-xl p-4 space-y-3 ${isUnresolved ? "border border-red-400/30" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={o.blocker}
                      disabled={readOnly}
                      onChange={(e) => void commit(o.id, { blocker: e.target.checked })}
                      className="h-4 w-4 rounded border-line-2 text-accent focus:ring-accent/30"
                    />
                    <span className="text-sm font-medium text-foreground">{o.title}</span>
                  </label>
                  <p className="text-xs text-text-muted mt-0.5 ml-6">Launch blocker &middot; gap: {READINESS_GAP_LABEL[o.gap]}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleExpand(o.id)}
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline cursor-pointer shrink-0"
                >
                  {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  Action &amp; evidence
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 pl-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-ink-soft">Owner</label>
                  <select
                    key={`${o.id}-owner`}
                    defaultValue={o.owner_person_id ?? ""}
                    disabled={readOnly}
                    onChange={(e) => void commit(o.id, { ownerPersonId: e.target.value || null })}
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
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-ink-soft">Due date</label>
                  <input
                    key={`${o.id}-due`}
                    type="date"
                    defaultValue={toDateInput(o.due_date)}
                    disabled={readOnly}
                    onBlur={(e) => {
                      const v = e.target.value || null;
                      if (v !== toDateInput(o.due_date) || (v === "" && o.due_date)) void commit(o.id, { dueDate: v });
                    }}
                    className="px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-60"
                  />
                </div>
              </div>

              {savingId === o.id && <p className="text-xs text-text-muted pl-6">Saving...</p>}
              {errorById[o.id] && <p className="text-xs text-red-500 pl-6">{errorById[o.id]}</p>}

              {expanded && (
                <div className="pl-6 pt-2 border-t border-white/10 space-y-4">
                  {!readOnly && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Raise a follow-up action</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={actionTitle}
                          onChange={(e) => setActionTitle(e.target.value)}
                          placeholder="Action title"
                          className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                        />
                        <input
                          type="date"
                          value={actionDue}
                          onChange={(e) => setActionDue(e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                        />
                        <select
                          value={actionOwner}
                          onChange={(e) => setActionOwner(e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                        >
                          <option value="">Owner...</option>
                          {people.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <PrioritySelect value={actionPriority} onChange={setActionPriority} />
                        <Button size="sm" onClick={() => void submitAction(o.id)} disabled={actionBusy || !actionTitle.trim()}>
                          <Plus className="h-3.5 w-3.5" /> Add
                        </Button>
                      </div>
                      {actionMessage && <p className="text-xs text-text-muted">{actionMessage}</p>}
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" /> Evidence
                    </p>
                    {evidenceLoading && !evidenceById[o.id] ? (
                      <p className="text-xs text-text-muted">Loading...</p>
                    ) : (evidenceById[o.id]?.length ?? 0) === 0 ? (
                      <p className="text-xs text-text-muted">No evidence recorded yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {evidenceById[o.id]!.map((e) => (
                          <div key={e.id} className="text-xs text-text-muted">
                            {e.title} ({e.type.replace(/_/g, " ")})
                          </div>
                        ))}
                      </div>
                    )}
                    {!readOnly && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Input value={evTitle} onChange={(e) => setEvTitle(e.target.value)} placeholder="Evidence title" className="text-xs" />
                        <Input value={evLink} onChange={(e) => setEvLink(e.target.value)} placeholder="Link URL (optional)" className="text-xs" />
                        <select
                          value={evType}
                          onChange={(e) => setEvType(e.target.value)}
                          className="px-2.5 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                        >
                          <option value="policy_reference">Policy reference</option>
                          <option value="sign_off">Sign-off</option>
                          <option value="screenshot">Screenshot</option>
                          <option value="sample_data">Sample data</option>
                          <option value="correspondence">Correspondence</option>
                          <option value="other">Other</option>
                        </select>
                        <Button size="sm" variant="secondary" onClick={() => void submitEvidence(o.id)} disabled={evBusy || !evTitle.trim()}>
                          <Plus className="h-3.5 w-3.5" /> Add
                        </Button>
                      </div>
                    )}
                    {evError && <p className="text-xs text-red-500">{evError}</p>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
