"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Plus, Trash2, UserPlus } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import PDFExportButton from "@/components/shared/PDFExportButton";
import { formatIsoDate } from "@/lib/format/date";
import {
  REG_COMMITMENT_STATUS_LABEL,
  REG_QUESTION_LINK_TYPE_LABEL,
  REG_QUESTION_STATUS_LABEL,
  REG_REQUEST_STATUS_LABEL,
  type ActionDTO,
  type ConditionDTO,
  type DecisionDTO,
  type EvidenceDTO,
  type PersonDTO,
  type PersonRole,
  type RegCommitmentDTO,
  type RegQuestionDTO,
  type RegRequestDTO,
  type RegResponseExportPayload,
  type RegResponseSummaryDTO,
} from "./types";

export type ApprovalReason =
  | "already_final"
  | "wrong_status"
  | "unanswered_questions"
  | "no_questions"
  | "not_approved"
  | "not_submitted"
  | "open_commitments"
  | "other";
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

/** Maps a 409 `reason` from approve/submit/close/reject to a specific, actionable message - read the machine-readable reason, never substring-match the prose. */
function reasonMessage(action: "approve" | "submit" | "close" | "reject", reason: ApprovalReason): string {
  if (reason === "no_questions") return "Add at least one question in step 2 before approving - an empty request has nothing to sign off.";
  if (reason === "unanswered_questions") return "Answer every question in step 3 before approving - none may be left \"unanswered\".";
  if (reason === "not_approved") return "This request must be approved before it can be marked submitted.";
  if (reason === "not_submitted") return "This request must be marked submitted before it can be closed.";
  if (reason === "open_commitments") return "Every commitment must be met, missed or withdrawn before this request can be closed.";
  if (reason === "already_final") return "This request is already closed or cancelled and cannot be changed further.";
  if (reason === "wrong_status") return "Only a draft, in-progress, or in-review request can be approved.";
  return "Could not complete that action. Please try again.";
}

function fmtDate(iso: string | null): string {
  return formatIsoDate(iso, { fallback: "Not set", style: "long" });
}

interface StepApprovalProps {
  request: RegRequestDTO;
  questions: RegQuestionDTO[];
  commitments: RegCommitmentDTO[];
  summary: RegResponseSummaryDTO;
  decisions: DecisionDTO[];
  conditions: ConditionDTO[];
  actions: ActionDTO[];
  evidence: EvidenceDTO[];
  people: PersonDTO[];
  onCreatePerson: (input: { name: string; role: PersonRole; email?: string }) => Promise<PersonDTO | null>;
  onApprove: (payload: DecisionPayload) => Promise<ApprovalOutcome>;
  onSubmit: () => Promise<ApprovalOutcome>;
  onClose: () => Promise<ApprovalOutcome>;
  onReject: (payload: DecisionPayload) => Promise<ApprovalOutcome>;
}

/**
 * Step 6: a readiness checklist derived from the exact three server guards
 * (approveResponse's unanswered_questions, markSubmitted's not_approved,
 * closeRequest's open_commitments - see lib/repo/reg-requests.ts), so every
 * 409 is anticipated rather than a surprise. Approve records a decision with
 * an approver, optional rationale and optional conditions; submit and close
 * take no body. Reject is available from any non-final status - a reviewer
 * may reject precisely because of an unanswered question. Once closed or
 * cancelled, everything below is read-only: the on-screen response pack and
 * its PDF export.
 */
export default function StepApproval({
  request,
  questions,
  commitments,
  summary,
  decisions,
  conditions,
  actions,
  evidence,
  people,
  onCreatePerson,
  onApprove,
  onSubmit,
  onClose,
  onReject,
}: StepApprovalProps) {
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const isFinal = request.status === "closed" || request.status === "cancelled";
  const unanswered = questions.filter((q) => q.status === "unanswered");
  const isApproved = request.status === "approved" || request.status === "submitted" || request.status === "closed";
  const isSubmitted = request.status === "submitted" || request.status === "closed";
  const openCommitments = commitments.filter((c) => c.status !== "met" && c.status !== "missed" && c.status !== "withdrawn");

  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);
  const [decidedByPersonId, setDecidedByPersonId] = useState("");
  const [rationale, setRationale] = useState("");
  const [conditionDrafts, setConditionDrafts] = useState<ConditionDraft[]>([]);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddRole, setQuickAddRole] = useState<PersonRole>("approver");
  const [quickAddBusy, setQuickAddBusy] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

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
      const fn = pendingAction === "approve" ? onApprove : onReject;
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

  async function doClose() {
    setClosing(true);
    setCloseError(null);
    try {
      const result = await onClose();
      if (!result.ok) setCloseError(reasonMessage("close", result.reason));
    } finally {
      setClosing(false);
    }
  }

  const exportPayload: RegResponseExportPayload = useMemo(
    () => ({
      reference: request.reference,
      title: request.title,
      regulator: request.regulator,
      channel: request.channel,
      status: request.status,
      receivedAt: request.received_at,
      deadline: request.deadline,
      submittedAt: request.submitted_at,
      ownerName: request.owner_person_id ? personById.get(request.owner_person_id)?.name ?? null : null,
      summary: request.summary,
      progress: summary,
      questions: [...questions]
        .sort((a, b) => a.position - b.position)
        .map((q) => ({
          position: q.position,
          question: q.question,
          response: q.response,
          exceptionNote: q.exception_note,
          status: q.status,
          links: q.links.map((l) => ({ linkType: l.link_type, label: REG_QUESTION_LINK_TYPE_LABEL[l.link_type], note: l.note })),
        })),
      commitments: commitments.map((c) => ({
        description: c.description,
        dueDate: c.due_date,
        ownerName: c.owner_person_id ? personById.get(c.owner_person_id)?.name ?? null : null,
        status: c.status,
        hasTrackedAction: Boolean(c.action_id),
        note: c.note,
      })),
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
        status: c.status,
      })),
      evidence: evidence.map((e) => ({ title: e.title, type: e.type, description: e.description, linkUrl: e.link_url })),
      decisions: decisions.map((d) => ({
        outcome: d.outcome,
        decidedByName: personById.get(d.decided_by_person_id)?.name ?? "Unknown",
        decidedAt: d.decided_at,
        rationale: d.rationale,
      })),
    }),
    [request, summary, questions, commitments, actions, conditions, evidence, decisions, personById]
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Approval</h2>
        <p className="text-sm text-text-muted">
          Approve, submit to the regulator, then close once every commitment is settled.
        </p>
      </div>

      {!isFinal && (
        <div className="glass-card rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Readiness checklist</p>
          <div className="space-y-2 text-sm">
            <ChecklistRow
              ok={questions.length > 0 && unanswered.length === 0}
              label={
                questions.length === 0
                  ? "No questions recorded yet (blocks approval)"
                  : unanswered.length === 0
                    ? "Every question has a response status"
                    : `${unanswered.length} question${unanswered.length === 1 ? "" : "s"} still unanswered`
              }
            />
            <ChecklistRow ok={isApproved} label={isApproved ? "Approved" : "Not yet approved"} />
            <ChecklistRow
              ok={openCommitments.length === 0}
              label={
                openCommitments.length === 0
                  ? "No open commitments"
                  : `${openCommitments.length} commitment${openCommitments.length === 1 ? " is" : "s are"} still open (blocks close only)`
              }
            />
          </div>
        </div>
      )}

      {!isFinal && !isApproved && (
        <div className="glass-card rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">Record a decision</h3>
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setPendingAction("approve")}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  pendingAction === "approve" ? "border-accent bg-accent/5 text-accent" : "border-line-2 bg-surface text-foreground hover:border-accent/40"
                }`}
              >
                Approve
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
              {pendingAction === "approve" && questions.length === 0 && (
                <div className="flex items-start gap-2 text-sm text-red-500">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  {reasonMessage("approve", "no_questions")}
                </div>
              )}
              {pendingAction === "approve" && questions.length > 0 && unanswered.length > 0 && (
                <div className="flex items-start gap-2 text-sm text-red-500">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  {reasonMessage("approve", "unanswered_questions")}
                </div>
              )}

              <div>
                <label className="text-[11px] uppercase tracking-wider text-text-muted">
                  {pendingAction === "approve" ? "Approver" : "Decided by"}
                </label>
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

              {pendingAction === "approve" && (
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
              )}

              {decisionError && <p className="text-sm text-red-500">{decisionError}</p>}

              <Button
                disabled={
                  !decidedByPersonId ||
                  decisionBusy ||
                  (pendingAction === "approve" && (questions.length === 0 || unanswered.length > 0))
                }
                onClick={doDecide}
              >
                {decisionBusy ? "Recording..." : pendingAction === "reject" ? "Record rejection" : "Record approval"}
              </Button>
            </div>
          )}
        </div>
      )}

      {!isFinal && isApproved && !isSubmitted && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Submit to the regulator</h3>
          <p className="text-xs text-text-muted">Marks this request as submitted. No approver is needed for this step.</p>
          {submitError && (
            <div className="flex items-start gap-2 text-sm text-red-500">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {submitError}
            </div>
          )}
          <Button onClick={doSubmit} disabled={submitting || !isApproved}>
            {submitting ? "Submitting..." : "Mark submitted"}
          </Button>
        </div>
      )}

      {!isFinal && isSubmitted && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Close this request</h3>
          <p className="text-xs text-text-muted">
            Requires every commitment to be met, missed or withdrawn - {openCommitments.length} still open.
          </p>
          {closeError && (
            <div className="flex items-start gap-2 text-sm text-red-500">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {closeError}
            </div>
          )}
          <Button onClick={doClose} disabled={closing || openCommitments.length > 0}>
            {closing ? "Closing..." : "Close request"}
          </Button>
        </div>
      )}

      {!isFinal && isApproved && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-2">Reject / cancel</h3>
          <div className="flex gap-2">
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
          {pendingAction === "reject" && (
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-text-muted">Decided by</label>
                <select
                  value={decidedByPersonId}
                  onChange={(e) => setDecidedByPersonId(e.target.value)}
                  className="w-full mt-1.5 px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                >
                  <option value="">Select a person...</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.role})
                    </option>
                  ))}
                </select>
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
              {decisionError && <p className="text-sm text-red-500">{decisionError}</p>}
              <Button disabled={!decidedByPersonId || decisionBusy} onClick={doDecide}>
                {decisionBusy ? "Recording..." : "Record rejection"}
              </Button>
            </div>
          )}
        </div>
      )}

      {decisions.length > 0 && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Decision history</h3>
          <div className="space-y-2">
            {[...decisions]
              .sort((a, b) => new Date(a.decided_at).getTime() - new Date(b.decided_at).getTime())
              .map((decision) => (
                <div key={decision.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/10 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={decision.outcome === "reject" ? "danger" : "success"}>
                      {decision.outcome === "reject" ? "Rejected" : decision.outcome === "approve_with_conditions" ? "Approved (with conditions)" : "Approved"}
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
              {request.status === "cancelled" ? "Request cancelled" : "Request closed"}
            </h3>
          </div>
          <p className="text-sm text-text-muted">Status: {REG_REQUEST_STATUS_LABEL[request.status]}. This record is now read-only.</p>
        </div>
      )}

      {/* Response pack */}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-4 border-t border-white/10">
        <h3 className="text-lg font-semibold text-foreground">Response pack</h3>
        <PDFExportButton module="reg_response" assessmentData={{ ...exportPayload }} />
      </div>

      <section className="glass-card rounded-xl p-5">
        <h4 className="text-sm font-semibold text-foreground mb-3">Summary</h4>
        <div className="grid sm:grid-cols-2 gap-2 text-sm text-text-muted">
          <p>Reference: <span className="text-foreground">{request.reference ?? "Not set"}</span></p>
          <p>Regulator: <span className="text-foreground">{request.regulator}</span></p>
          <p>Status: <span className="text-foreground">{REG_REQUEST_STATUS_LABEL[request.status]}</span></p>
          <p>Deadline: <span className="text-foreground">{fmtDate(request.deadline)}</span></p>
          <p>Questions answered: <span className="text-foreground">{summary.answeredCount} of {summary.totalQuestions} ({summary.answeredPct}%)</span></p>
          <p>Open commitments: <span className="text-foreground">{openCommitments.length} of {commitments.length}</span></p>
        </div>
      </section>

      <section className="glass-card rounded-xl p-5">
        <h4 className="text-sm font-semibold text-foreground mb-2">Questions ({questions.length})</h4>
        {questions.length === 0 ? (
          <p className="text-sm text-text-muted">No questions recorded.</p>
        ) : (
          <div className="space-y-1.5">
            {[...questions]
              .sort((a, b) => a.position - b.position)
              .map((q) => (
                <div key={q.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5 last:border-0 text-xs text-text-muted">
                  <span className="text-foreground truncate">#{q.position}. {q.question}</span>
                  <span className="shrink-0">{REG_QUESTION_STATUS_LABEL[q.status]}</span>
                </div>
              ))}
          </div>
        )}
      </section>

      <section className="glass-card rounded-xl p-5">
        <h4 className="text-sm font-semibold text-foreground mb-2">Commitments ({commitments.length})</h4>
        {commitments.length === 0 ? (
          <p className="text-sm text-text-muted">No commitments recorded.</p>
        ) : (
          <div className="space-y-1.5">
            {commitments.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5 last:border-0 text-xs text-text-muted">
                <span className="text-foreground truncate">{c.description}</span>
                <span className="shrink-0">{REG_COMMITMENT_STATUS_LABEL[c.status]}</span>
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
