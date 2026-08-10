"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import ReadinessStepper from "@/components/readiness/ReadinessStepper";
import StepScope, { type ScopeFields } from "@/components/readiness/StepScope";
import StepObligations, { type GenerateOutcome } from "@/components/readiness/StepObligations";
import StepControls, { type ObligationControlPatch } from "@/components/readiness/StepControls";
import StepGaps, {
  type NewObligationActionPayload,
  type NewObligationEvidencePayload,
  type ObligationGapPatch,
} from "@/components/readiness/StepGaps";
import StepEvidence, { type NewEvidencePayload } from "@/components/readiness/StepEvidence";
import StepApproval, { type ApprovalOutcome, type ApprovalReason, type DecisionPayload } from "@/components/readiness/StepApproval";
import {
  LAST_UNLOCKED_STEP,
  READINESS_STATUS_LABEL,
  type ActionDTO,
  type ConditionDTO,
  type DecisionDTO,
  type EvidenceDTO,
  type PersonDTO,
  type PersonRole,
  type ReadinessAssessmentDTO,
  type ReadinessObligationDTO,
  type ReadinessStatus,
  type ReadinessSummaryDTO,
  type WorkspaceControlDTO,
} from "@/components/readiness/types";
import type { AssessmentListItem } from "@/components/pra/types";

const STATUS_VARIANT: Record<ReadinessStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  draft: "default",
  in_review: "info",
  approved_local: "warning",
  approved_global: "success",
  rejected: "danger",
  cancelled: "default",
};

interface ReadinessJourneyClientProps {
  assessmentId: string;
}

export default function ReadinessJourneyClient({ assessmentId }: ReadinessJourneyClientProps) {
  const { wsFetch, ready, workspaceId } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<ReadinessAssessmentDTO | null>(null);
  const [obligations, setObligations] = useState<ReadinessObligationDTO[]>([]);
  const [summary, setSummary] = useState<ReadinessSummaryDTO | null>(null);
  const [decisions, setDecisions] = useState<DecisionDTO[]>([]);
  const [conditions, setConditions] = useState<ConditionDTO[]>([]);
  const [actions, setActions] = useState<ActionDTO[]>([]);
  const [evidence, setEvidence] = useState<EvidenceDTO[]>([]);
  const [people, setPeople] = useState<PersonDTO[]>([]);
  const [controls, setControls] = useState<WorkspaceControlDTO[]>([]);
  const [praAssessments, setPraAssessments] = useState<AssessmentListItem[]>([]);
  const [step, setStep] = useState(1);
  const [navigating, setNavigating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Only fetch once a workspace already exists - never bootstrap one just
  // for visiting this page. Mirrors app/assure/incidents/[id]/IncidentJourneyClient.tsx's
  // gate. Derived rather than set from inside the effect below, so there is
  // no synchronous setState-in-effect.
  const noWorkspaceYet = ready && !workspaceId;

  useEffect(() => {
    if (!ready || !workspaceId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await wsFetch(`/api/readiness/${assessmentId}`);
        if (res.status === 404) {
          if (!cancelled) setLoadError("This readiness assessment could not be found in your workspace.");
          return;
        }
        if (!res.ok) {
          if (!cancelled) setLoadError("Could not load this readiness assessment. Try reloading the page.");
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        setAssessment(data.assessment);
        setObligations(Array.isArray(data.obligations) ? data.obligations : []);
        setSummary(data.summary ?? null);
        setDecisions(Array.isArray(data.decisions) ? data.decisions : []);
        setConditions(Array.isArray(data.conditions) ? data.conditions : []);
        setActions(Array.isArray(data.actions) ? data.actions : []);
        setEvidence(Array.isArray(data.evidence) ? data.evidence : []);
        setStep(Math.min(Math.max(data.assessment?.current_step ?? 1, 1), LAST_UNLOCKED_STEP));

        const [peopleRes, controlsRes, praRes] = await Promise.all([
          wsFetch(`/api/workspace/people`).catch(() => null),
          wsFetch(`/api/workspace/controls`).catch(() => null),
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
        if (praRes?.ok) {
          const a = await praRes.json();
          setPraAssessments(Array.isArray(a.assessments) ? a.assessments : []);
        }
      } catch {
        if (!cancelled) setLoadError("Could not load this readiness assessment. Try reloading the page.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, workspaceId, wsFetch, assessmentId]);

  const readOnly =
    assessment?.status === "approved_global" || assessment?.status === "rejected" || assessment?.status === "cancelled";

  /** Shared PATCH-and-refresh helper: every assessment-level save (step change, scope) goes through here. */
  async function patchAssessmentDetailed(
    patch: Record<string, unknown>
  ): Promise<{ ok: true; assessment: ReadinessAssessmentDTO } | { ok: false; message: string }> {
    try {
      const res = await wsFetch(`/api/readiness/${assessmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return { ok: false, message: body?.error ?? "Could not save. Please try again." };
      }
      const data = await res.json();
      setAssessment(data.assessment);
      return { ok: true, assessment: data.assessment };
    } catch {
      return { ok: false, message: "Could not save. Please try again." };
    }
  }

  async function patchAssessment(patch: Record<string, unknown>): Promise<{ ok: true } | { ok: false; message: string }> {
    const result = await patchAssessmentDetailed(patch);
    return result.ok ? { ok: true } : { ok: false, message: result.message };
  }

  async function goToStep(target: number) {
    if (!assessment || target === step || target < 1 || target > LAST_UNLOCKED_STEP) return;
    setNavigating(true);
    setActionError(null);
    try {
      if (readOnly) {
        setStep(target);
        return;
      }
      const result = await patchAssessmentDetailed({ currentStep: target });
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
      const res = await wsFetch(`/api/readiness/${assessmentId}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary ?? null);
        setObligations(Array.isArray(data.obligations) ? data.obligations : []);
      }
    } catch {
      // best-effort refresh
    }
  }

  async function generateObligations(): Promise<GenerateOutcome> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/readiness/${assessmentId}/generate`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return { ok: false, message: body?.error ?? "Could not generate the obligation register. Please try again." };
      }
      const data = await res.json();
      await refreshSummary();
      return { ok: true, created: data.created ?? 0, existing: data.existing ?? 0 };
    } catch {
      return { ok: false, message: "Could not generate the obligation register. Please try again." };
    }
  }

  async function patchObligation(
    obligationId: string,
    patch: ObligationControlPatch | ObligationGapPatch
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/readiness/${assessmentId}/obligations/${obligationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return { ok: false, message: body?.error ?? "Could not save. Please try again." };
      }
      const data = await res.json();
      setObligations((prev) => prev.map((o) => (o.id === obligationId ? data.obligation : o)));
      await refreshSummary();
      return { ok: true };
    } catch {
      return { ok: false, message: "Could not save. Please try again." };
    }
  }

  async function addObligationAction(obligationId: string, payload: NewObligationActionPayload): Promise<boolean> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/readiness/${assessmentId}/obligations/${obligationId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function loadObligationEvidence(obligationId: string): Promise<EvidenceDTO[]> {
    try {
      const res = await wsFetch(`/api/readiness/${assessmentId}/obligations/${obligationId}/evidence`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.evidence) ? data.evidence : [];
    } catch {
      return [];
    }
  }

  async function addObligationEvidence(obligationId: string, payload: NewObligationEvidencePayload): Promise<boolean> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/readiness/${assessmentId}/obligations/${obligationId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function addEvidence(payload: NewEvidencePayload): Promise<boolean> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/readiness/${assessmentId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setEvidence((prev) => [...prev, data.evidence]);
      return true;
    } catch {
      return false;
    }
  }

  function toApprovalOutcome(body: { error?: string; reason?: string } | null, fallback: ApprovalReason): ApprovalOutcome {
    const reasons: ApprovalReason[] = ["already_final", "wrong_status", "not_locally_approved", "unresolved_blockers", "no_obligations"];
    const reason = reasons.includes(body?.reason as ApprovalReason) ? (body!.reason as ApprovalReason) : fallback;
    return { ok: false, reason, message: body?.error ?? "Could not complete that action." };
  }

  async function doSubmit(): Promise<ApprovalOutcome> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/readiness/${assessmentId}/submit`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return toApprovalOutcome(body, "other");
      }
      const data = await res.json();
      setAssessment(data.assessment);
      return { ok: true };
    } catch {
      return { ok: false, reason: "other", message: "Could not submit for review. Please try again." };
    }
  }

  async function runDecision(path: string, payload: DecisionPayload): Promise<ApprovalOutcome> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/readiness/${assessmentId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return toApprovalOutcome(body, "other");
      }
      const data = await res.json();
      setAssessment(data.assessment);
      if (data.decision) setDecisions((prev) => [...prev, data.decision]);
      if (Array.isArray(data.conditions) && data.conditions.length > 0) setConditions((prev) => [...prev, ...data.conditions]);
      return { ok: true };
    } catch {
      return { ok: false, reason: "other", message: "Could not record that decision. Please try again." };
    }
  }

  const doApproveLocal = (payload: DecisionPayload) => runDecision("approve-local", payload);
  const doApproveGlobal = (payload: DecisionPayload) => runDecision("approve-global", payload);
  const doReject = (payload: DecisionPayload) => runDecision("reject", payload);

  if (loading && !noWorkspaceYet) {
    return (
      <ToolFrame>
        <main className="flex-1">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center text-text-muted text-sm">
            Loading readiness assessment...
          </div>
        </main>
      </ToolFrame>
    );
  }

  if (noWorkspaceYet || loadError || !assessment) {
    return (
      <ToolFrame>
        <main className="flex-1">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
            <div className="glass-card rounded-2xl p-8">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {noWorkspaceYet ? "This readiness assessment could not be found in your workspace." : loadError ?? "Could not load this assessment."}
              </h2>
              <Link
                href="/assure/market-readiness"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors mt-2"
              >
                Back to Market Readiness
              </Link>
            </div>
          </div>
        </main>
      </ToolFrame>
    );
  }

  const activeSummary: ReadinessSummaryDTO =
    summary ?? { total: obligations.length, byGap: { not_assessed: 0, none: 0, partial: 0, full: 0 }, blockerCount: 0, unresolvedBlockerCount: 0, noControlCount: 0, coveragePct: 0 };
  const linkedProduct = assessment.product_id ? praAssessments.find((a) => a.productId === assessment.product_id) : undefined;
  const productName = linkedProduct?.productName ?? null;

  return (
    <ToolFrame
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Market Readiness", href: "/assure/market-readiness" },
        { label: assessment.title || "Readiness assessment" },
      ]}
    >
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider">Readiness assessment</p>
              <h1 className="text-2xl font-bold text-foreground">{assessment.title || "Untitled assessment"}</h1>
            </div>
            <Badge variant={STATUS_VARIANT[assessment.status]}>{READINESS_STATUS_LABEL[assessment.status]}</Badge>
          </div>

          <div className="glass-card rounded-xl p-4 mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-text-muted">
              Coverage: <span className="text-foreground font-medium">{activeSummary.coveragePct}%</span> ({activeSummary.byGap.full} of {activeSummary.total} full)
            </span>
            <span className="text-text-muted">
              Blockers: <span className="text-foreground font-medium">{activeSummary.blockerCount}</span>
            </span>
            {activeSummary.unresolvedBlockerCount > 0 && (
              <span className="inline-flex items-center gap-1 text-red-500 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" /> {activeSummary.unresolvedBlockerCount} unresolved
              </span>
            )}
          </div>

          <ReadinessStepper currentStep={step} onSelect={(target) => void goToStep(target)} disabled={navigating} />

          {actionError && <div className="glass-card rounded-xl p-3 text-sm text-red-500 mb-4">{actionError}</div>}

          <div className="glass-card rounded-2xl p-6 sm:p-8">
            {step === 1 && (
              <StepScope
                assessment={assessment}
                people={people}
                praAssessments={praAssessments}
                readOnly={Boolean(readOnly)}
                onSave={(fields: Partial<ScopeFields>) => patchAssessment(fields)}
                onCreatePerson={createPerson}
              />
            )}
            {step === 2 && <StepObligations obligations={obligations} readOnly={Boolean(readOnly)} onGenerate={generateObligations} />}
            {step === 3 && (
              <StepControls obligations={obligations} controls={controls} readOnly={Boolean(readOnly)} onSave={patchObligation} />
            )}
            {step === 4 && (
              <StepGaps
                obligations={obligations}
                people={people}
                readOnly={Boolean(readOnly)}
                onSave={patchObligation}
                onAddAction={addObligationAction}
                onLoadEvidence={loadObligationEvidence}
                onAddEvidence={addObligationEvidence}
              />
            )}
            {step === 5 && <StepEvidence evidence={evidence} readOnly={Boolean(readOnly)} onAdd={addEvidence} />}
            {step === 6 && (
              <StepApproval
                assessment={assessment}
                obligations={obligations}
                summary={activeSummary}
                decisions={decisions}
                conditions={conditions}
                actions={actions}
                evidence={evidence}
                controls={controls}
                people={people}
                productName={productName}
                onCreatePerson={createPerson}
                onSubmit={doSubmit}
                onApproveLocal={doApproveLocal}
                onApproveGlobal={doApproveGlobal}
                onReject={doReject}
              />
            )}
          </div>

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
