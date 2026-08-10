"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Plus, Trash2, UserPlus } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import PDFExportButton from "@/components/shared/PDFExportButton";
import { ENTITY_LABEL, JURISDICTION_LABEL } from "@/data/kyc/types";
import {
  READINESS_GAP_LABEL,
  READINESS_STATUS_LABEL,
  RISK_LEVEL_LABEL,
  type ActionDTO,
  type ConditionDTO,
  type DecisionDTO,
  type EvidenceDTO,
  type PersonDTO,
  type PersonRole,
  type ReadinessAssessmentDTO,
  type ReadinessExportPayload,
  type ReadinessObligationDTO,
  type ReadinessSummaryDTO,
  type WorkspaceControlDTO,
} from "./types";

export type ApprovalReason = "already_final" | "wrong_status" | "not_locally_approved" | "unresolved_blockers" | "no_obligations" | "other";
export type ApprovalOutcome = { ok: true } | { ok: false; reason: ApprovalReason; message: string };

export interface DecisionPayload {
  decidedByPersonId: string;
  rationale?: string;
  conditions?: { description: string; dueDate?: string | null; ownerPersonId?: string | null }[];
}

interface ConditionDraft {
  key: string;
  description: string;
  dueDate: string;
  ownerPersonId: string;
}

let tempIdCounter = 0;
function makeTempKey(): string {
  tempIdCounter += 1;
  return `tmp-${tempIdCounter}-${Date.now()}`;
}

const PERSON_ROLES: PersonRole[] = ["approver", "reviewer", "owner"];

/** Maps a 409 `reason` from submit/approve-local/approve-global/reject to a specific, actionable message - read the machine-readable reason, never substring-match the prose. */
function reasonMessage(action: "submit" | "approve_local" | "approve_global" | "reject", reason: ApprovalReason): string {
  if (reason === "no_obligations") return "Generate the obligation register in step 2 before submitting for review.";
  if (reason === "unresolved_blockers") return "Resolve every launch blocker to a \"Fully met\" gap in step 4 before approving.";
  if (reason === "not_locally_approved") return "This assessment must be approved locally before it can be approved globally.";
  if (reason === "already_final") return "This assessment is already approved, rejected, or cancelled and cannot be changed further.";
  if (reason === "wrong_status") {
    if (action === "submit") return "Only a draft assessment can be submitted for review.";
    if (action === "approve_local") return "Only an assessment in review can be approved locally.";
    return "This assessment is not in the right status for that action.";
  }
  return "Could not complete that action. Please try again.";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "Not set";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

interface StepApprovalProps {
  assessment: ReadinessAssessmentDTO;
  obligations: ReadinessObligationDTO[];
  summary: ReadinessSummaryDTO;
  decisions: DecisionDTO[];
  conditions: ConditionDTO[];
  actions: ActionDTO[];
  evidence: EvidenceDTO[];
  controls: WorkspaceControlDTO[];
  people: PersonDTO[];
  productName: string | null;
  onCreatePerson: (input: { name: string; role: PersonRole; email?: string }) => Promise<PersonDTO | null>;
  onSubmit: () => Promise<ApprovalOutcome>;
  onApproveLocal: (payload: DecisionPayload) => Promise<ApprovalOutcome>;
  onApproveGlobal: (payload: DecisionPayload) => Promise<ApprovalOutcome>;
  onReject: (payload: DecisionPayload) => Promise<ApprovalOutcome>;
}

/**
 * Step 6: a readiness checklist derived from the exact rules the server
 * enforces (obligations generated? unresolved blockers? locally approved
 * yet?), so the 409s from submit/approve-local/approve-global are never a
 * surprise - mirrors components/incidents/StepClosure.tsx's approach.
 * Submit for review has no approver of its own (the API takes no body);
 * approve-local, approve-global and reject each take an approver, an
 * optional rationale and optional conditions. Once approved_global or
 * rejected, everything below is read-only: the on-screen launch-readiness
 * pack and its PDF export.
 */
export default function StepApproval({
  assessment,
  obligations,
  summary,
  decisions,
  conditions,
  actions,
  evidence,
  controls,
  people,
  productName,
  onCreatePerson,
  onSubmit,
  onApproveLocal,
  onApproveGlobal,
  onReject,
}: StepApprovalProps) {
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const controlById = useMemo(() => new Map(controls.map((c) => [c.id, c])), [controls]);

  const isFinal = assessment.status === "approved_global" || assessment.status === "rejected" || assessment.status === "cancelled";
  const hasObligations = obligations.length > 0;
  const unresolvedBlockers = obligations.filter((o) => o.blocker && o.gap !== "full");
  const isLocallyApproved = assessment.status === "approved_local" || assessment.status === "approved_global";

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [pendingAction, setPendingAction] = useState<"approve_local" | "approve_global" | "reject" | null>(null);
  const [decidedByPersonId, setDecidedByPersonId] = useState("");
  const [rationale, setRationale] = useState("");
  const [conditionDrafts, setConditionDrafts] = useState<ConditionDraft[]>([]);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddRole, setQuickAddRole] = useState<PersonRole>("approver");
  const [quickAddBusy, setQuickAddBusy] = useState(false);

  const addCondition = () => setConditionDrafts((prev) => [...prev, { key: makeTempKey(), description: "", dueDate: "", ownerPersonId: "" }]);

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

  async function doSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await onSubmit();
      if (!result.ok) setSubmitError(reasonMessage("submit", result.reason));
    } finally {
      setSubmitting(false);
    }
  }

  async function doDecide() {
    if (!pendingAction || !decidedByPersonId) return;
    setDecisionBusy(true);
    setDecisionError(null);
    try {
      const payload: DecisionPayload = {
        decidedByPersonId,
        rationale: rationale.trim() || undefined,
        conditions: conditionDrafts
          .filter((c) => c.description.trim())
          .map((c) => ({ description: c.description.trim(), dueDate: c.dueDate || null, ownerPersonId: c.ownerPersonId || null })),
      };
      const fn = pendingAction === "approve_local" ? onApproveLocal : pendingAction === "approve_global" ? onApproveGlobal : onReject;
      const result = await fn(payload);
      if (!result.ok) {
        setDecisionError(reasonMessage(pendingAction, result.reason));
        return;
      }
      setPendingAction(null);
      setDecidedByPersonId("");
      setRationale("");
      setConditionDrafts([]);
    } finally {
      setDecisionBusy(false);
    }
  }

  const exportPayload: ReadinessExportPayload = useMemo(
    () => ({
      title: assessment.title,
      entityType: ENTITY_LABEL[assessment.entity_type] ?? assessment.entity_type,
      jurisdiction: JURISDICTION_LABEL[assessment.jurisdiction] ?? assessment.jurisdiction,
      riskLevel: RISK_LEVEL_LABEL[assessment.risk_level] ?? assessment.risk_level,
      status: assessment.status,
      targetLaunchDate: assessment.target_launch_date,
      productName: productName ?? assessment.product_note,
      ownerName: assessment.owner_person_id ? personById.get(assessment.owner_person_id)?.name ?? null : null,
      summary,
      obligations: obligations.map((o) => ({
        category: o.category,
        title: o.title,
        ruleSummary: o.rule_summary,
        controlName: o.workspace_control_id ? controlById.get(o.workspace_control_id)?.name ?? null : null,
        gap: o.gap,
        blocker: o.blocker,
        ownerName: o.owner_person_id ? personById.get(o.owner_person_id)?.name ?? null : null,
        dueDate: o.due_date,
        legalBasis: o.legal_basis,
      })),
      evidence: evidence.map((e) => ({ title: e.title, type: e.type, description: e.description, linkUrl: e.link_url })),
      actions: actions.map((a) => ({
        title: a.title,
        ownerName: a.owner_person_id ? personById.get(a.owner_person_id)?.name ?? null : null,
        dueDate: a.due_date,
        priority: a.priority,
        status: a.status,
      })),
      conditions: conditions.map((c) => ({
        description: c.description,
        dueDate: c.due_date,
        ownerName: c.owner_person_id ? personById.get(c.owner_person_id)?.name ?? null : null,
      })),
      decisions: labelDecisions(decisions).map((d) => ({
        outcome: d.decision.outcome === "reject" ? "reject" : "approve",
        level: d.level,
        decidedByName: personById.get(d.decision.decided_by_person_id)?.name ?? "Unknown",
        decidedAt: d.decision.decided_at,
        rationale: d.decision.rationale,
      })),
    }),
    [assessment, summary, obligations, evidence, actions, conditions, decisions, controlById, personById, productName]
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Approval</h2>
        <p className="text-sm text-text-muted">
          Submit for review, then approve locally and globally. Both approvals refuse while a launch blocker is
          unresolved.
        </p>
      </div>

      {!isFinal && (
        <div className="glass-card rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Readiness checklist</p>
          <div className="space-y-2 text-sm">
            <ChecklistRow
              ok={hasObligations}
              label={hasObligations ? `${obligations.length} obligation${obligations.length === 1 ? "" : "s"} generated` : "No obligations generated yet"}
            />
            <ChecklistRow
              ok={unresolvedBlockers.length === 0}
              label={
                unresolvedBlockers.length === 0
                  ? "No unresolved launch blockers"
                  : `${unresolvedBlockers.length} unresolved launch blocker${unresolvedBlockers.length === 1 ? "" : "s"}`
              }
            />
            <ChecklistRow
              ok={isLocallyApproved}
              label={isLocallyApproved ? "Approved locally" : "Not yet approved locally"}
            />
          </div>
        </div>
      )}

      {!isFinal && assessment.status === "draft" && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Submit for review</h3>
          <p className="text-xs text-text-muted">Moves this assessment from draft into review. No approver is needed for this step.</p>
          {submitError && (
            <div className="flex items-start gap-2 text-sm text-red-500">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {submitError}
            </div>
          )}
          <Button onClick={doSubmit} disabled={submitting || !hasObligations}>
            {submitting ? "Submitting..." : "Submit for review"}
          </Button>
          {!hasObligations && <p className="text-xs text-text-muted">Generate the obligation register in step 2 first.</p>}
        </div>
      )}

      {!isFinal && (assessment.status === "in_review" || assessment.status === "approved_local") && (
        <div className="glass-card rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">Record a decision</h3>
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setPendingAction(assessment.status === "in_review" ? "approve_local" : "approve_global")}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  pendingAction === "approve_local" || pendingAction === "approve_global"
                    ? "border-accent bg-accent/5 text-accent"
                    : "border-line-2 bg-surface text-foreground hover:border-accent/40"
                }`}
              >
                {assessment.status === "in_review" ? "Approve locally" : "Approve globally"}
              </button>
              <button
                type="button"
                onClick={() => setPendingAction("reject")}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  pendingAction === "reject" ? "border-red-400 bg-red-500/5 text-red-500" : "border-line-2 bg-surface text-foreground hover:border-red-400/40"
                }`}
              >
                Reject
              </button>
            </div>
          </div>

          {pendingAction && (
            <div className="space-y-4">
              {pendingAction !== "reject" && unresolvedBlockers.length > 0 && (
                <div className="flex items-start gap-2 text-sm text-red-500">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  {reasonMessage(pendingAction, "unresolved_blockers")}
                </div>
              )}

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
                <label className="text-[11px] uppercase tracking-wider text-text-muted">Rationale (optional)</label>
                <textarea
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  rows={2}
                  className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] uppercase tracking-wider text-text-muted">Conditions (optional)</label>
                  <button
                    type="button"
                    onClick={addCondition}
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {conditionDrafts.map((c) => (
                    <div key={c.key} className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/10">
                      <input
                        value={c.description}
                        onChange={(e) => setConditionDrafts((prev) => prev.map((x) => (x.key === c.key ? { ...x, description: e.target.value } : x)))}
                        placeholder="Condition description"
                        className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                      />
                      <input
                        type="date"
                        value={c.dueDate}
                        onChange={(e) => setConditionDrafts((prev) => prev.map((x) => (x.key === c.key ? { ...x, dueDate: e.target.value } : x)))}
                        className="px-2.5 py-1.5 rounded-lg border border-line-2 bg-surface text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                      />
                      <select
                        value={c.ownerPersonId}
                        onChange={(e) => setConditionDrafts((prev) => prev.map((x) => (x.key === c.key ? { ...x, ownerPersonId: e.target.value } : x)))}
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
                        onClick={() => setConditionDrafts((prev) => prev.filter((x) => x.key !== c.key))}
                        aria-label="Remove condition"
                        className="text-text-muted hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {decisionError && <p className="text-sm text-red-500">{decisionError}</p>}

              <Button disabled={!decidedByPersonId || decisionBusy} onClick={doDecide}>
                {decisionBusy ? "Recording..." : pendingAction === "reject" ? "Record rejection" : "Record approval"}
              </Button>
            </div>
          )}
        </div>
      )}

      {decisions.length > 0 && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Decision history</h3>
          <div className="space-y-2">
            {labelDecisions(decisions).map(({ decision, level }) => (
              <div key={decision.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/10 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant={decision.outcome === "reject" ? "danger" : "success"}>
                    {level === "local" ? "Local approval" : level === "global" ? "Global approval" : "Rejection"}
                  </Badge>
                  <span className="text-foreground">{personById.get(decision.decided_by_person_id)?.name ?? "Unknown"}</span>
                </div>
                <span className="text-xs text-text-muted shrink-0">{fmtDate(decision.decided_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isFinal && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">
              {assessment.status === "rejected" ? "Assessment rejected" : "Assessment approved globally"}
            </h3>
          </div>
          <p className="text-sm text-text-muted">Status: {READINESS_STATUS_LABEL[assessment.status]}. This record is now read-only.</p>
        </div>
      )}

      {/* Launch-readiness pack */}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-4 border-t border-white/10">
        <h3 className="text-lg font-semibold text-foreground">Launch-readiness pack</h3>
        <PDFExportButton module="readiness" assessmentData={{ ...exportPayload }} />
      </div>

      <section className="glass-card rounded-xl p-5">
        <h4 className="text-sm font-semibold text-foreground mb-3">Summary</h4>
        <div className="grid sm:grid-cols-2 gap-2 text-sm text-text-muted">
          <p>Entity type: <span className="text-foreground">{ENTITY_LABEL[assessment.entity_type] ?? assessment.entity_type}</span></p>
          <p>Jurisdiction: <span className="text-foreground">{JURISDICTION_LABEL[assessment.jurisdiction] ?? assessment.jurisdiction}</span></p>
          <p>Risk level: <span className="text-foreground">{RISK_LEVEL_LABEL[assessment.risk_level]}</span></p>
          <p>Status: <span className="text-foreground">{READINESS_STATUS_LABEL[assessment.status]}</span></p>
          <p>Target launch: <span className="text-foreground">{fmtDate(assessment.target_launch_date)}</span></p>
          <p>Coverage: <span className="text-foreground">{summary.coveragePct}% fully met ({summary.byGap.full} of {summary.total})</span></p>
        </div>
      </section>

      {unresolvedBlockers.length > 0 && (
        <section className="glass-card rounded-xl p-5 border border-red-400/30">
          <h4 className="text-sm font-semibold text-foreground mb-2">Unresolved blockers ({unresolvedBlockers.length})</h4>
          <ul className="space-y-1 text-sm text-foreground">
            {unresolvedBlockers.map((o) => (
              <li key={o.id} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" /> {o.title} <span className="text-xs text-text-muted">({READINESS_GAP_LABEL[o.gap]})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="glass-card rounded-xl p-5">
        <h4 className="text-sm font-semibold text-foreground mb-2">Obligation register ({obligations.length})</h4>
        {obligations.length === 0 ? (
          <p className="text-sm text-text-muted">No obligations recorded.</p>
        ) : (
          <div className="space-y-1.5">
            {obligations.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5 last:border-0 text-xs text-text-muted">
                <span className="text-foreground truncate">{o.title}</span>
                <span className="shrink-0">{READINESS_GAP_LABEL[o.gap]}{o.blocker ? " · blocker" : ""}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass-card rounded-xl p-5">
        <h4 className="text-sm font-semibold text-foreground mb-2">Evidence ({evidence.length})</h4>
        {evidence.length === 0 ? (
          <p className="text-sm text-text-muted">No evidence recorded.</p>
        ) : (
          <div className="space-y-1">
            {evidence.map((e) => (
              <p key={e.id} className="text-xs text-text-muted">
                {e.title} ({e.type.replace(/_/g, " ")})
              </p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ChecklistRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="h-4 w-4 text-accent shrink-0" /> : <Circle className="h-4 w-4 text-text-muted shrink-0" />}
      <span className={ok ? "text-foreground" : "text-text-muted"}>{label}</span>
    </div>
  );
}

/**
 * Labels each decision as a local approval, global approval, or rejection.
 * The readiness_assessment decision rows carry no "level" column of their
 * own (see lib/repo/readiness.ts's runApproval), so this infers it the same
 * way the server enforces the sequence: sorted chronologically, the first
 * 'approve' outcome is the local approval and any subsequent one is the
 * global approval; any 'reject' outcome is a rejection.
 */
function labelDecisions(decisions: DecisionDTO[]): { decision: DecisionDTO; level: "local" | "global" | "rejection" }[] {
  const sorted = [...decisions].sort((a, b) => new Date(a.decided_at).getTime() - new Date(b.decided_at).getTime());
  let approveSeen = 0;
  return sorted.map((decision) => {
    if (decision.outcome === "reject") return { decision, level: "rejection" as const };
    approveSeen += 1;
    return { decision, level: (approveSeen === 1 ? "local" : "global") as "local" | "global" };
  });
}
