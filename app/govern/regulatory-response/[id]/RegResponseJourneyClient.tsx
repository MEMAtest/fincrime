"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import ResponseStepper from "@/components/reg-response/ResponseStepper";
import StepRequest, { type RequestFields } from "@/components/reg-response/StepRequest";
import StepQuestions from "@/components/reg-response/StepQuestions";
import StepResponses, { type ResponsePatch } from "@/components/reg-response/StepResponses";
import StepSubstantiation, { type NewLinkPayload } from "@/components/reg-response/StepSubstantiation";
import StepCommitments, { type CommitmentPatch, type NewCommitmentPayload } from "@/components/reg-response/StepCommitments";
import StepApproval, { type ApprovalOutcome, type ApprovalReason, type DecisionPayload } from "@/components/reg-response/StepApproval";
import {
  LAST_UNLOCKED_STEP,
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
  type RegRequestStatus,
  type RegResponseSummaryDTO,
} from "@/components/reg-response/types";
import type { WorkspaceControlDTO, ControlChangeListItem } from "@/components/change-lab/types";
import type { ControlTestListItem } from "@/components/control-testing/types";
import type { IncidentListItem } from "@/components/incidents/types";
import type { ReadinessListItem } from "@/components/readiness/types";
import type { AssessmentListItem } from "@/components/pra/types";

const STATUS_VARIANT: Record<RegRequestStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  draft: "default",
  in_progress: "info",
  in_review: "info",
  approved: "warning",
  submitted: "success",
  closed: "success",
  cancelled: "danger",
};

interface RegResponseJourneyClientProps {
  requestId: string;
  bridgedIncidentId: string | null;
}

export default function RegResponseJourneyClient({ requestId, bridgedIncidentId }: RegResponseJourneyClientProps) {
  const { wsFetch, ready, workspaceId } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [request, setRequest] = useState<RegRequestDTO | null>(null);
  const [questions, setQuestions] = useState<RegQuestionDTO[]>([]);
  const [commitments, setCommitments] = useState<RegCommitmentDTO[]>([]);
  const [summary, setSummary] = useState<RegResponseSummaryDTO | null>(null);
  const [decisions, setDecisions] = useState<DecisionDTO[]>([]);
  const [conditions, setConditions] = useState<ConditionDTO[]>([]);
  const [actions, setActions] = useState<ActionDTO[]>([]);
  const [evidence, setEvidence] = useState<EvidenceDTO[]>([]);
  const [people, setPeople] = useState<PersonDTO[]>([]);
  const [controls, setControls] = useState<WorkspaceControlDTO[]>([]);
  const [tests, setTests] = useState<ControlTestListItem[]>([]);
  const [changes, setChanges] = useState<ControlChangeListItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentListItem[]>([]);
  const [readinessAssessments, setReadinessAssessments] = useState<ReadinessListItem[]>([]);
  const [praAssessments, setPraAssessments] = useState<AssessmentListItem[]>([]);
  const [step, setStep] = useState(1);
  const [navigating, setNavigating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Only fetch once a workspace already exists - never bootstrap one just
  // for visiting this page. Mirrors app/assure/market-readiness/[id]'s gate.
  const noWorkspaceYet = ready && !workspaceId;

  useEffect(() => {
    if (!ready || !workspaceId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await wsFetch(`/api/reg-requests/${requestId}`);
        if (res.status === 404) {
          if (!cancelled) setLoadError("This regulator request could not be found in your workspace.");
          return;
        }
        if (!res.ok) {
          if (!cancelled) setLoadError("Could not load this regulator request. Try reloading the page.");
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        setRequest(data.request);
        setQuestions(Array.isArray(data.questions) ? data.questions : []);
        setCommitments(Array.isArray(data.commitments) ? data.commitments : []);
        setSummary(data.summary ?? null);
        setDecisions(Array.isArray(data.decisions) ? data.decisions : []);
        setConditions(Array.isArray(data.conditions) ? data.conditions : []);
        setActions(Array.isArray(data.actions) ? data.actions : []);
        setEvidence(Array.isArray(data.evidence) ? data.evidence : []);
        setStep(Math.min(Math.max(data.request?.current_step ?? 1, 1), LAST_UNLOCKED_STEP));

        const [peopleRes, controlsRes, testsRes, changesRes, incidentsRes, readinessRes, praRes] = await Promise.all([
          wsFetch(`/api/workspace/people`).catch(() => null),
          wsFetch(`/api/workspace/controls`).catch(() => null),
          wsFetch(`/api/control-tests`).catch(() => null),
          wsFetch(`/api/control-changes`).catch(() => null),
          wsFetch(`/api/incidents`).catch(() => null),
          wsFetch(`/api/readiness`).catch(() => null),
          wsFetch(`/api/pra/assessments`).catch(() => null),
        ]);
        if (cancelled) return;
        if (peopleRes?.ok) {
          const p = await peopleRes.json();
          setPeople(Array.isArray(p.people) ? p.people : []);
        }
        if (controlsRes?.ok) {
          const c = await controlsRes.json();
          setControls(Array.isArray(c.controls) ? c.controls : []);
        }
        if (testsRes?.ok) {
          const t = await testsRes.json();
          setTests(Array.isArray(t.tests) ? t.tests : []);
        }
        if (changesRes?.ok) {
          const c = await changesRes.json();
          setChanges(Array.isArray(c.changes) ? c.changes : []);
        }
        if (incidentsRes?.ok) {
          const i = await incidentsRes.json();
          setIncidents(Array.isArray(i.incidents) ? i.incidents : []);
        }
        if (readinessRes?.ok) {
          const r = await readinessRes.json();
          setReadinessAssessments(Array.isArray(r.assessments) ? r.assessments : []);
        }
        if (praRes?.ok) {
          const a = await praRes.json();
          setPraAssessments(Array.isArray(a.assessments) ? a.assessments : []);
        }
      } catch {
        if (!cancelled) setLoadError("Could not load this regulator request. Try reloading the page.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, workspaceId, wsFetch, requestId]);

  const readOnly = request?.status === "closed" || request?.status === "cancelled";

  /** Shared PATCH-and-refresh helper: every request-level save (step change, request fields) goes through here. */
  async function patchRequest(patch: Record<string, unknown>): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      const res = await wsFetch(`/api/reg-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return { ok: false, message: body?.error ?? "Could not save. Please try again." };
      }
      const data = await res.json();
      setRequest(data.request);
      return { ok: true };
    } catch {
      return { ok: false, message: "Could not save. Please try again." };
    }
  }

  async function goToStep(target: number) {
    if (!request || target === step || target < 1 || target > LAST_UNLOCKED_STEP) return;
    setNavigating(true);
    setActionError(null);
    try {
      if (readOnly) {
        setStep(target);
        return;
      }
      const result = await patchRequest({ currentStep: target });
      if (!result.ok) {
        setActionError("Could not save your progress. Please try again.");
        return;
      }
      setStep(target);
    } finally {
      setNavigating(false);
    }
  }

  async function createPerson(input: { name: string; role: PersonRole; email?: string }): Promise<PersonDTO | null> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/workspace/people`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setPeople((prev) => [...prev, data.person]);
      return data.person;
    } catch {
      setActionError("Could not add that person. Please try again.");
      return null;
    }
  }

  async function refreshSummary() {
    try {
      const res = await wsFetch(`/api/reg-requests/${requestId}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary ?? null);
        setQuestions(Array.isArray(data.questions) ? data.questions : []);
        setCommitments(Array.isArray(data.commitments) ? data.commitments : []);
        setActions(Array.isArray(data.actions) ? data.actions : []);
      }
    } catch {
      // best-effort refresh
    }
  }

  // --- Questions ---------------------------------------------------------

  async function addQuestion(question: string): Promise<{ ok: true } | { ok: false; message: string }> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/reg-requests/${requestId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return { ok: false, message: body?.error ?? "Could not add that question. Please try again." };
      }
      const data = await res.json();
      setQuestions((prev) => [...prev, { ...data.question, links: [] }]);
      await refreshSummary();
      return { ok: true };
    } catch {
      return { ok: false, message: "Could not add that question. Please try again." };
    }
  }

  async function patchQuestion(
    questionId: string,
    patch: { question?: string; response?: string | null; exceptionNote?: string | null; status?: RegQuestionDTO["status"] }
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/reg-requests/${requestId}/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return { ok: false, message: body?.error ?? "Could not save. Please try again." };
      }
      const data = await res.json();
      setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...data.question, links: q.links } : q)));
      await refreshSummary();
      return { ok: true };
    } catch {
      return { ok: false, message: "Could not save. Please try again." };
    }
  }

  const saveResponse = (questionId: string, patch: ResponsePatch) => patchQuestion(questionId, patch);

  async function deleteQuestion(questionId: string): Promise<{ ok: true } | { ok: false; message: string }> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/reg-requests/${requestId}/questions/${questionId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return { ok: false, message: body?.error ?? "Could not delete that question. Please try again." };
      }
      // Deleting renumbers the remaining questions server-side, so refetch
      // the full list rather than trying to patch positions locally.
      await refreshSummary();
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      return { ok: true };
    } catch {
      return { ok: false, message: "Could not delete that question. Please try again." };
    }
  }

  async function reorderQuestions(orderedQuestionIds: string[]): Promise<{ ok: true } | { ok: false; message: string }> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/reg-requests/${requestId}/questions/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedQuestionIds }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return { ok: false, message: body?.error ?? "Could not reorder questions. Please try again." };
      }
      const data = await res.json();
      const linksByQuestion = new Map(questions.map((q) => [q.id, q.links]));
      setQuestions((data.questions as RegQuestionDTO[]).map((q) => ({ ...q, links: linksByQuestion.get(q.id) ?? [] })));
      return { ok: true };
    } catch {
      return { ok: false, message: "Could not reorder questions. Please try again." };
    }
  }

  // --- Substantiation links ------------------------------------------------

  async function addLink(questionId: string, payload: NewLinkPayload): Promise<{ ok: true } | { ok: false; message: string }> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/reg-requests/${requestId}/questions/${questionId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return { ok: false, message: body?.error ?? "Could not add that link. Please try again." };
      }
      const data = await res.json();
      setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, links: [...q.links, data.link] } : q)));
      return { ok: true };
    } catch {
      return { ok: false, message: "Could not add that link. Please try again." };
    }
  }

  async function removeLink(questionId: string, linkId: string): Promise<boolean> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/reg-requests/${requestId}/questions/${questionId}/links/${linkId}`, { method: "DELETE" });
      if (!res.ok) return false;
      setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, links: q.links.filter((l) => l.id !== linkId) } : q)));
      return true;
    } catch {
      return false;
    }
  }

  // --- Commitments -----------------------------------------------------

  async function addCommitment(payload: NewCommitmentPayload): Promise<{ ok: true } | { ok: false; message: string }> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/reg-requests/${requestId}/commitments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return { ok: false, message: body?.error ?? "Could not add that commitment. Please try again." };
      }
      const data = await res.json();
      setCommitments((prev) => [...prev, data.commitment]);
      await refreshSummary();
      return { ok: true };
    } catch {
      return { ok: false, message: "Could not add that commitment. Please try again." };
    }
  }

  async function saveCommitment(commitmentId: string, patch: CommitmentPatch): Promise<{ ok: true } | { ok: false; message: string }> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/reg-requests/${requestId}/commitments/${commitmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return { ok: false, message: body?.error ?? "Could not save. Please try again." };
      }
      const data = await res.json();
      setCommitments((prev) => prev.map((c) => (c.id === commitmentId ? data.commitment : c)));
      // A commitment moving to 'met' closes its tracked action server-side,
      // so the action list (used by StepCommitments and the response pack)
      // must be refreshed too, not just the commitment row itself.
      await refreshSummary();
      return { ok: true };
    } catch {
      return { ok: false, message: "Could not save. Please try again." };
    }
  }

  // --- Approval path -----------------------------------------------------

  function toApprovalOutcome(body: { error?: string; reason?: string } | null, fallback: ApprovalReason): ApprovalOutcome {
    const reasons: ApprovalReason[] = [
      "already_final",
      "wrong_status",
      "unanswered_questions",
      "not_approved",
      "not_submitted",
      "open_commitments",
    ];
    const reason = reasons.includes(body?.reason as ApprovalReason) ? (body!.reason as ApprovalReason) : fallback;
    return { ok: false, reason, message: body?.error ?? "Could not complete that action." };
  }

  async function doApprove(payload: DecisionPayload): Promise<ApprovalOutcome> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/reg-requests/${requestId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return toApprovalOutcome(body, "other");
      }
      const data = await res.json();
      setRequest(data.request);
      if (data.decision) setDecisions((prev) => [...prev, data.decision]);
      if (Array.isArray(data.conditions) && data.conditions.length > 0) setConditions((prev) => [...prev, ...data.conditions]);
      return { ok: true };
    } catch {
      return { ok: false, reason: "other", message: "Could not record that approval. Please try again." };
    }
  }

  async function doSubmit(): Promise<ApprovalOutcome> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/reg-requests/${requestId}/submit`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return toApprovalOutcome(body, "other");
      }
      const data = await res.json();
      setRequest(data.request);
      return { ok: true };
    } catch {
      return { ok: false, reason: "other", message: "Could not submit this request. Please try again." };
    }
  }

  async function doClose(): Promise<ApprovalOutcome> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/reg-requests/${requestId}/close`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return toApprovalOutcome(body, "other");
      }
      const data = await res.json();
      setRequest(data.request);
      return { ok: true };
    } catch {
      return { ok: false, reason: "other", message: "Could not close this request. Please try again." };
    }
  }

  async function doReject(payload: DecisionPayload): Promise<ApprovalOutcome> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/reg-requests/${requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return toApprovalOutcome(body, "other");
      }
      const data = await res.json();
      setRequest(data.request);
      if (data.decision) setDecisions((prev) => [...prev, data.decision]);
      if (Array.isArray(data.conditions) && data.conditions.length > 0) setConditions((prev) => [...prev, ...data.conditions]);
      return { ok: true };
    } catch {
      return { ok: false, reason: "other", message: "Could not record that rejection. Please try again." };
    }
  }

  if (loading && !noWorkspaceYet) {
    return (
      <ToolFrame>
        <main className="flex-1">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center text-text-muted text-sm">
            Loading regulator request...
          </div>
        </main>
      </ToolFrame>
    );
  }

  if (noWorkspaceYet || loadError || !request) {
    return (
      <ToolFrame>
        <main className="flex-1">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
            <div className="glass-card rounded-2xl p-8">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {noWorkspaceYet ? "This regulator request could not be found in your workspace." : loadError ?? "Could not load this request."}
              </h2>
              <Link
                href="/govern/regulatory-response"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors mt-2"
              >
                Back to Regulatory Response
              </Link>
            </div>
          </div>
        </main>
      </ToolFrame>
    );
  }

  const activeSummary: RegResponseSummaryDTO =
    summary ?? {
      totalQuestions: questions.length,
      questionsByStatus: { unanswered: 0, drafted: 0, reviewed: 0 },
      answeredCount: 0,
      unansweredCount: questions.length,
      answeredPct: 0,
      totalCommitments: commitments.length,
      commitmentsByStatus: { open: 0, in_progress: 0, met: 0, missed: 0, withdrawn: 0 },
      overdueCommitmentCount: 0,
      daysUntilDeadline: null,
    };

  return (
    <ToolFrame
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Regulatory Response", href: "/govern/regulatory-response" },
        { label: request.title || "Regulator request" },
      ]}
    >
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider">Regulator request</p>
              <h1 className="text-2xl font-bold text-foreground">{request.title || "Untitled request"}</h1>
            </div>
            <Badge variant={STATUS_VARIANT[request.status]}>{REG_REQUEST_STATUS_LABEL[request.status]}</Badge>
          </div>

          <div className="glass-card rounded-xl p-4 mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-text-muted">
              Answered: <span className="text-foreground font-medium">{activeSummary.answeredCount}</span> of {activeSummary.totalQuestions}
            </span>
            {activeSummary.daysUntilDeadline !== null && (
              <span className={activeSummary.daysUntilDeadline < 0 ? "text-red-500 font-medium inline-flex items-center gap-1" : "text-text-muted"}>
                {activeSummary.daysUntilDeadline < 0 && <AlertTriangle className="h-3.5 w-3.5" />}
                {activeSummary.daysUntilDeadline < 0
                  ? `${Math.abs(activeSummary.daysUntilDeadline)} day${Math.abs(activeSummary.daysUntilDeadline) === 1 ? "" : "s"} overdue`
                  : `${activeSummary.daysUntilDeadline} day${activeSummary.daysUntilDeadline === 1 ? "" : "s"} to deadline`}
              </span>
            )}
            {activeSummary.overdueCommitmentCount > 0 && (
              <span className="inline-flex items-center gap-1 text-red-500 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" /> {activeSummary.overdueCommitmentCount} overdue commitment
                {activeSummary.overdueCommitmentCount === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <ResponseStepper currentStep={step} onSelect={(target) => void goToStep(target)} disabled={navigating} />

          {actionError && <div className="glass-card rounded-xl p-3 text-sm text-red-500 mb-4">{actionError}</div>}

          <div className="glass-card rounded-2xl p-6 sm:p-8">
            {step === 1 && (
              <StepRequest
                request={request}
                people={people}
                readOnly={Boolean(readOnly)}
                onSave={(fields: Partial<RequestFields>) => patchRequest(fields)}
                onCreatePerson={createPerson}
              />
            )}
            {step === 2 && (
              <StepQuestions
                questions={questions}
                readOnly={Boolean(readOnly)}
                onAdd={addQuestion}
                onSave={patchQuestion}
                onDelete={deleteQuestion}
                onReorder={reorderQuestions}
              />
            )}
            {step === 3 && <StepResponses questions={questions} readOnly={Boolean(readOnly)} onSave={saveResponse} />}
            {step === 4 && (
              <StepSubstantiation
                questions={questions}
                controls={controls}
                tests={tests}
                changes={changes}
                incidents={incidents}
                readinessAssessments={readinessAssessments}
                praAssessments={praAssessments}
                evidence={evidence}
                readOnly={Boolean(readOnly)}
                onAddLink={addLink}
                onRemoveLink={removeLink}
              />
            )}
            {step === 5 && (
              <StepCommitments
                commitments={commitments}
                people={people}
                actions={actions}
                readOnly={Boolean(readOnly)}
                onAdd={addCommitment}
                onSave={saveCommitment}
              />
            )}
            {step === 6 && (
              <StepApproval
                request={request}
                questions={questions}
                commitments={commitments}
                summary={activeSummary}
                decisions={decisions}
                conditions={conditions}
                actions={actions}
                evidence={evidence}
                people={people}
                onCreatePerson={createPerson}
                onApprove={doApprove}
                onSubmit={doSubmit}
                onClose={doClose}
                onReject={doReject}
              />
            )}
          </div>

          {step === 4 && bridgedIncidentId && incidents.some((i) => i.id === bridgedIncidentId) && questions.length > 0 && (
            <div className="glass-card rounded-xl p-4 mt-4 text-sm text-text-muted">
              This request was opened from a reportable incident. Use the Substantiation picker above (link type
              &quot;Incident&quot;) to link it to a question.
            </div>
          )}

          <div className="flex items-center justify-between mt-6">
            <Button variant="ghost" onClick={() => void goToStep(step - 1)} disabled={step <= 1 || navigating}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              onClick={() => void goToStep(Math.min(step + 1, LAST_UNLOCKED_STEP))}
              disabled={step >= LAST_UNLOCKED_STEP || navigating}
            >
              {navigating ? "Saving..." : "Save & continue"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
    </ToolFrame>
  );
}
