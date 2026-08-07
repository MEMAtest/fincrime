"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, UserPlus, CheckCircle2 } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { PriorityBadge, PrioritySelect } from "@/components/controls/ControlBits";
import type {
  ActionPriority,
  ConditionDTO,
  ControlChangeDTO,
  DecisionDTO,
  DecisionOutcome,
  PersonDTO,
  PersonRole,
  ActionDTO,
} from "./types";

const OUTCOME_LABEL: Record<DecisionOutcome, string> = {
  approve: "Approve",
  approve_with_conditions: "Approve with conditions",
  reject: "Reject",
};

const OUTCOME_BADGE_VARIANT: Record<DecisionOutcome, "success" | "warning" | "danger"> = {
  approve: "success",
  approve_with_conditions: "warning",
  reject: "danger",
};

const PERSON_ROLES: PersonRole[] = ["approver", "reviewer", "owner"];

interface ConditionDraft {
  key: string;
  description: string;
  dueDate: string;
  ownerPersonId: string;
}

interface ActionDraft {
  key: string;
  title: string;
  ownerPersonId: string;
  dueDate: string;
  priority: ActionPriority;
}

let tempIdCounter = 0;
function makeTempKey(): string {
  tempIdCounter += 1;
  return `tmp-${tempIdCounter}-${Date.now()}`;
}

export interface ChangeDecisionPayload {
  outcome: DecisionOutcome;
  rationale?: string;
  decidedByPersonId: string;
  conditions?: { description: string; dueDate?: string | null; ownerPersonId?: string | null }[];
  actions?: { title: string; ownerPersonId?: string | null; dueDate?: string | null; priority?: ActionPriority }[];
}

interface DecisionRecord {
  decision: DecisionDTO | null;
  conditions: ConditionDTO[];
  actions: ActionDTO[];
}

interface StepApprovalProps {
  change: ControlChangeDTO;
  people: PersonDTO[];
  decisionData: DecisionRecord;
  onSavePilot: (pilot: boolean, pilotNotes: string | null) => Promise<void>;
  onCreatePerson: (input: { name: string; role: PersonRole; email?: string }) => Promise<PersonDTO | null>;
  onRecordDecision: (payload: ChangeDecisionPayload) => Promise<boolean>;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Step 5: pilot settings, an approver-signed decision (approve / approve with conditions / reject), conditions and follow-up actions. Mirrors components/pra/StepDecision.tsx. */
export default function StepApproval({
  change,
  people,
  decisionData,
  onSavePilot,
  onCreatePerson,
  onRecordDecision,
}: StepApprovalProps) {
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const [pilot, setPilot] = useState(change.pilot);
  const [pilotNotes, setPilotNotes] = useState(change.pilot_notes ?? "");
  const [savingPilot, setSavingPilot] = useState(false);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddRole, setQuickAddRole] = useState<PersonRole>("approver");
  const [quickAddBusy, setQuickAddBusy] = useState(false);

  const [decidedByPersonId, setDecidedByPersonId] = useState("");
  const [outcome, setOutcome] = useState<DecisionOutcome | "">("");
  const [rationale, setRationale] = useState("");
  const [conditions, setConditions] = useState<ConditionDraft[]>([]);
  const [actions, setActions] = useState<ActionDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const addCondition = () => setConditions((prev) => [...prev, { key: makeTempKey(), description: "", dueDate: "", ownerPersonId: "" }]);
  const addAction = () => setActions((prev) => [...prev, { key: makeTempKey(), title: "", ownerPersonId: "", dueDate: "", priority: "medium" }]);

  const savePilot = async () => {
    setSavingPilot(true);
    try {
      await onSavePilot(pilot, pilotNotes.trim() || null);
    } finally {
      setSavingPilot(false);
    }
  };

  const submitQuickAdd = async () => {
    const name = quickAddName.trim();
    if (!name) return;
    setQuickAddBusy(true);
    try {
      const person = await onCreatePerson({ name, role: quickAddRole });
      if (person) {
        setDecidedByPersonId(person.id);
        setQuickAddName("");
        setQuickAddOpen(false);
      }
    } finally {
      setQuickAddBusy(false);
    }
  };

  const canSubmit =
    Boolean(outcome) &&
    Boolean(decidedByPersonId) &&
    !(outcome === "approve_with_conditions" && conditions.filter((c) => c.description.trim()).length === 0);

  const submitDecision = async () => {
    if (!outcome || !canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: ChangeDecisionPayload = {
        outcome,
        rationale: rationale.trim() || undefined,
        decidedByPersonId,
        conditions: conditions
          .filter((c) => c.description.trim())
          .map((c) => ({ description: c.description.trim(), dueDate: c.dueDate || null, ownerPersonId: c.ownerPersonId || null })),
        actions: actions
          .filter((a) => a.title.trim())
          .map((a) => ({ title: a.title.trim(), ownerPersonId: a.ownerPersonId || null, dueDate: a.dueDate || null, priority: a.priority })),
      };
      const ok = await onRecordDecision(payload);
      if (!ok) setSubmitError("Could not record the decision. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const decision = decisionData.decision;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Approval</h2>
        <p className="text-sm text-text-muted">
          Optionally pilot the change first, then record the approver&apos;s decision with any conditions and
          follow-up actions.
        </p>
      </div>

      <div className="glass-card rounded-xl p-4 space-y-3">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={pilot}
            onChange={(e) => setPilot(e.target.checked)}
            className="h-4 w-4 rounded border-line-2 text-accent focus:ring-accent/30"
          />
          <span className="text-sm font-medium text-foreground">Run this as a pilot before full rollout</span>
        </label>
        {pilot && (
          <textarea
            value={pilotNotes}
            onChange={(e) => setPilotNotes(e.target.value)}
            rows={2}
            placeholder="Pilot scope: population, duration, success criteria..."
            className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
          />
        )}
        <Button size="sm" variant="secondary" onClick={savePilot} disabled={savingPilot}>
          {savingPilot ? "Saving..." : "Save pilot settings"}
        </Button>
      </div>

      {decision ? (
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <CheckCircle2 className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Decision recorded</h3>
            <Badge variant={OUTCOME_BADGE_VARIANT[decision.outcome]}>{OUTCOME_LABEL[decision.outcome]}</Badge>
          </div>
          <p className="text-sm text-text-muted">
            By {personById.get(decision.decided_by_person_id)?.name ?? "Unknown"} on {fmtDate(decision.decided_at)}
          </p>
          {decision.rationale && <p className="text-sm text-foreground">{decision.rationale}</p>}

          {decisionData.conditions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Conditions ({decisionData.conditions.length})
              </p>
              <div className="space-y-1.5">
                {decisionData.conditions.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/10 text-sm">
                    <span className="text-foreground">{c.description}</span>
                    <span className="text-xs text-text-muted shrink-0">
                      {fmtDate(c.due_date)} &middot; {personById.get(c.owner_person_id ?? "")?.name ?? "Unassigned"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {decisionData.actions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Follow-up actions ({decisionData.actions.length})
              </p>
              <div className="space-y-1.5">
                {decisionData.actions.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/10 text-sm">
                    <span className="text-foreground">{a.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-text-muted">
                        {fmtDate(a.due_date)} &middot; {personById.get(a.owner_person_id ?? "")?.name ?? "Unassigned"}
                      </span>
                      <PriorityBadge priority={a.priority} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-5 space-y-5">
          <h3 className="text-sm font-semibold text-foreground">Record a decision</h3>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-text-muted">Approver</label>
            <div className="flex items-center gap-2 mt-1.5">
              <select
                value={decidedByPersonId}
                onChange={(e) => setDecidedByPersonId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              >
                <option value="">Select a person...</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setQuickAddOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line-2 text-xs text-foreground hover:border-accent/40 cursor-pointer shrink-0"
              >
                <UserPlus className="h-3.5 w-3.5" /> New
              </button>
            </div>
            {quickAddOpen && (
              <div className="mt-2 p-3 rounded-lg bg-white/[0.02] border border-white/10 flex flex-wrap items-center gap-2">
                <input
                  value={quickAddName}
                  onChange={(e) => setQuickAddName(e.target.value)}
                  placeholder="Name"
                  className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                />
                <select
                  value={quickAddRole}
                  onChange={(e) => setQuickAddRole(e.target.value as PersonRole)}
                  className="px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                >
                  {PERSON_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={submitQuickAdd}
                  disabled={quickAddBusy || !quickAddName.trim()}
                  className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium disabled:opacity-50 cursor-pointer"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-text-muted">Outcome</label>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              {(Object.keys(OUTCOME_LABEL) as DecisionOutcome[]).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOutcome(o)}
                  className={`px-3 py-2.5 rounded-lg border text-sm text-center transition-colors cursor-pointer ${
                    outcome === o
                      ? "border-accent bg-accent/5 text-accent font-medium"
                      : "border-line-2 bg-surface text-foreground hover:border-accent/40"
                  }`}
                >
                  {OUTCOME_LABEL[o]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-text-muted">Decision rationale (optional)</label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={2}
              className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
            />
          </div>

          {outcome === "approve_with_conditions" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] uppercase tracking-wider text-text-muted">Conditions</label>
                <button
                  type="button"
                  onClick={addCondition}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline cursor-pointer"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {conditions.map((c) => (
                  <div key={c.key} className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/10">
                    <input
                      value={c.description}
                      onChange={(e) => setConditions((prev) => prev.map((x) => (x.key === c.key ? { ...x, description: e.target.value } : x)))}
                      placeholder="Condition description"
                      className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                    />
                    <input
                      type="date"
                      value={c.dueDate}
                      onChange={(e) => setConditions((prev) => prev.map((x) => (x.key === c.key ? { ...x, dueDate: e.target.value } : x)))}
                      className="px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                    />
                    <select
                      value={c.ownerPersonId}
                      onChange={(e) => setConditions((prev) => prev.map((x) => (x.key === c.key ? { ...x, ownerPersonId: e.target.value } : x)))}
                      className="px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                    >
                      <option value="">Owner...</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setConditions((prev) => prev.filter((x) => x.key !== c.key))}
                      aria-label="Remove condition"
                      className="text-text-muted hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {conditions.length === 0 && <p className="text-xs text-text-muted">At least one condition is required for this outcome.</p>}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] uppercase tracking-wider text-text-muted">Follow-up actions (optional)</label>
              <button
                type="button"
                onClick={addAction}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {actions.map((a) => (
                <div key={a.key} className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/10">
                  <input
                    value={a.title}
                    onChange={(e) => setActions((prev) => prev.map((x) => (x.key === a.key ? { ...x, title: e.target.value } : x)))}
                    placeholder="Action title"
                    className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  />
                  <input
                    type="date"
                    value={a.dueDate}
                    onChange={(e) => setActions((prev) => prev.map((x) => (x.key === a.key ? { ...x, dueDate: e.target.value } : x)))}
                    className="px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  />
                  <select
                    value={a.ownerPersonId}
                    onChange={(e) => setActions((prev) => prev.map((x) => (x.key === a.key ? { ...x, ownerPersonId: e.target.value } : x)))}
                    className="px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  >
                    <option value="">Owner...</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <PrioritySelect
                    value={a.priority}
                    onChange={(p) => setActions((prev) => prev.map((x) => (x.key === a.key ? { ...x, priority: p } : x)))}
                  />
                  <button
                    type="button"
                    onClick={() => setActions((prev) => prev.filter((x) => x.key !== a.key))}
                    aria-label="Remove action"
                    className="text-text-muted hover:text-red-500 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {submitError && <p className="text-sm text-red-500">{submitError}</p>}

          <Button disabled={!canSubmit || submitting} onClick={submitDecision}>
            {submitting ? "Recording..." : "Record decision"}
          </Button>
        </div>
      )}
    </div>
  );
}
