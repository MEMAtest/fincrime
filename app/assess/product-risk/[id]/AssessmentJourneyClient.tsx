"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import AssessmentStepper from "@/components/pra/AssessmentStepper";
import StepProductProfile from "@/components/pra/StepProductProfile";
import StepFlows from "@/components/pra/StepFlows";
import StepInherentRisks, { type CreateRiskInput, type UpdateRiskInput } from "@/components/pra/StepInherentRisks";
import StepControlMapping, {
  type CreateControlInput,
  type UpdateControlInput,
} from "@/components/pra/StepControlMapping";
import StepGapsOpLoad from "@/components/pra/StepGapsOpLoad";
import StepResidualRisk from "@/components/pra/StepResidualRisk";
import StepDecision, { type DecisionPayload } from "@/components/pra/StepDecision";
import StepPack from "@/components/pra/StepPack";
import { computeAssessmentResidual } from "@/components/pra/journeyCompute";
import { DEFAULT_APPETITE_THRESHOLDS, type AppetiteThresholds } from "@/data/scoring/residual-risk";
import type { ControlRating } from "@/data/controls/types";
import {
  ASSESSMENT_STATUS_LABEL,
  LAST_UNLOCKED_STEP,
  productToProfileDraft,
  type AssessmentControlDTO,
  type AssessmentDTO,
  type AssessmentRiskDTO,
  type AssessmentStatus,
  type DecisionRecord,
  type FlowLeg,
  type PersonDTO,
  type PersonRole,
  type ProductDTO,
  type ProfileDraft,
  type WorkspaceControlDTO,
} from "@/components/pra/types";

const STATUS_VARIANT: Record<AssessmentStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  draft: "default",
  in_review: "info",
  approved: "success",
  rejected: "danger",
  conditions_applied: "warning",
};

const EMPTY_DECISION_RECORD: DecisionRecord = { decision: null, conditions: [], actions: [] };

interface AssessmentJourneyClientProps {
  assessmentId: string;
  preselectedTypologySlugs: string[];
}

export default function AssessmentJourneyClient({
  assessmentId,
  preselectedTypologySlugs,
}: AssessmentJourneyClientProps) {
  const { wsFetch, ready } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<AssessmentDTO | null>(null);
  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [risks, setRisks] = useState<AssessmentRiskDTO[]>([]);
  const [controls, setControls] = useState<AssessmentControlDTO[]>([]);
  const [workspaceControls, setWorkspaceControls] = useState<WorkspaceControlDTO[]>([]);
  const [people, setPeople] = useState<PersonDTO[]>([]);
  const [appetiteThresholds, setAppetiteThresholds] = useState<AppetiteThresholds>(DEFAULT_APPETITE_THRESHOLDS);
  const [decisionData, setDecisionData] = useState<DecisionRecord>(EMPTY_DECISION_RECORD);
  const [step, setStep] = useState(1);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft | null>(null);
  const [flowsDraft, setFlowsDraft] = useState<FlowLeg[] | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await wsFetch(`/api/pra/assessments/${assessmentId}`);
        if (res.status === 404) {
          if (!cancelled) setLoadError("This assessment could not be found in your workspace.");
          return;
        }
        if (!res.ok) {
          if (!cancelled) setLoadError("Could not load this assessment. Try reloading the page.");
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        const loadedAssessment: AssessmentDTO = data.assessment;
        const loadedProduct: ProductDTO = data.product;

        setAssessment(loadedAssessment);
        setProduct(loadedProduct);
        setRisks(Array.isArray(data.risks) ? data.risks : []);
        setControls(Array.isArray(data.controls) ? data.controls : []);
        setStep(Math.min(Math.max(loadedAssessment.current_step ?? 1, 1), 8));
        setProfileDraft(productToProfileDraft(loadedProduct));
        setFlowsDraft(loadedProduct.flows ?? []);

        // Best-effort supplementary data for steps 5-8 (workspace controls'
        // effectiveness ratings, people for the approver picker, the
        // workspace's appetite thresholds, and any recorded decision). A
        // failure here should not block viewing the assessment - the
        // defaults already cover it (empty lists, default thresholds, no
        // recorded decision).
        const [controlsSettled, peopleSettled, meSettled, decisionSettled] = await Promise.allSettled([
          wsFetch(`/api/workspace/controls`),
          wsFetch(`/api/workspace/people`),
          wsFetch(`/api/workspace/me`),
          wsFetch(`/api/pra/assessments/${assessmentId}/decision`),
        ]);
        if (cancelled) return;

        if (controlsSettled.status === "fulfilled" && controlsSettled.value.ok) {
          const c = await controlsSettled.value.json();
          if (!cancelled) setWorkspaceControls(Array.isArray(c.controls) ? c.controls : []);
        }
        if (peopleSettled.status === "fulfilled" && peopleSettled.value.ok) {
          const p = await peopleSettled.value.json();
          if (!cancelled) setPeople(Array.isArray(p.people) ? p.people : []);
        }
        if (meSettled.status === "fulfilled" && meSettled.value.ok) {
          const m = await meSettled.value.json();
          if (!cancelled && m?.appetiteThresholds) setAppetiteThresholds(m.appetiteThresholds);
        }
        if (decisionSettled.status === "fulfilled" && decisionSettled.value.ok) {
          const d = await decisionSettled.value.json();
          if (!cancelled) {
            setDecisionData({
              decision: d.decision ?? null,
              conditions: Array.isArray(d.conditions) ? d.conditions : [],
              actions: Array.isArray(d.actions) ? d.actions : [],
            });
          }
        }
      } catch {
        if (!cancelled) setLoadError("Could not load this assessment. Try reloading the page.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, wsFetch, assessmentId]);

  const workspaceControlById = useMemo(
    () => new Map(workspaceControls.map((c) => [c.id, c])),
    [workspaceControls]
  );

  /**
   * While Step 6 is open, keep the persisted residual_score per risk and the
   * assessment's residual_summary/appetite_result in sync with what is
   * currently computed from the control map - this way the record is
   * accurate whether the user edits a rationale, changes a control's
   * effectiveness, or jumps straight to Step 8 via the stepper without
   * "leaving" Step 6 through the Back/Save & continue buttons.
   */
  // In-flight guards so re-runs of the sync effect (each updateRisk response
  // changes `risks`) never re-issue a PATCH that is still pending.
  const residualPatchInFlight = useRef<Set<string>>(new Set());
  const summaryPatchInFlight = useRef(false);

  useEffect(() => {
    if (step !== 6 || !assessment) return;

    const { perRisk, summary } = computeAssessmentResidual(risks, controls, workspaceControlById, appetiteThresholds);

    for (const { risk, result } of perRisk) {
      if (risk.residual_score !== result.residualScore && !residualPatchInFlight.current.has(risk.id)) {
        residualPatchInFlight.current.add(risk.id);
        void updateRisk(risk.id, { residualScore: result.residualScore }).finally(() => {
          residualPatchInFlight.current.delete(risk.id);
        });
      }
    }

    const nextSummary: Record<string, unknown> = summary
      ? {
          overallResidualScore: summary.overallResidualScore,
          meanResidualScore: summary.meanResidualScore,
          overallResidualRating: summary.overallResidualRating,
        }
      : {};
    const nextAppetiteResult = summary?.appetiteResult ?? null;
    // Field-wise comparison: residual_summary is JSONB, which does not
    // preserve key order, so JSON.stringify equality is always false and
    // would write a redundant assessment update + audit row on every pass.
    const stored = (assessment.residual_summary ?? {}) as Record<string, unknown>;
    const changed =
      stored.overallResidualScore !== nextSummary.overallResidualScore ||
      stored.meanResidualScore !== nextSummary.meanResidualScore ||
      stored.overallResidualRating !== nextSummary.overallResidualRating ||
      nextAppetiteResult !== assessment.appetite_result;
    if (changed && !summaryPatchInFlight.current) {
      summaryPatchInFlight.current = true;
      void patchAssessment({ residualSummary: nextSummary, appetiteResult: nextAppetiteResult }).finally(() => {
        summaryPatchInFlight.current = false;
      });
    }
    // `assessment` must be a dep: patchAssessment coalesces concurrent runs
    // via summaryPatchInFlight, and without it the run that was skipped while
    // a patch was in flight never re-fires, leaving residual_summary and
    // appetite_result persisted one change behind (stale committee pack).
    // Convergence is safe - the comparison is field-wise and the server
    // echoes back exactly what was sent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, risks, controls, workspaceControlById, appetiteThresholds, assessment]);

  /** Shared PATCH-and-refresh helper: every assessment-level save (step change, recommendation, status, residual summary) goes through here so state stays consistent. */
  async function patchAssessment(
    patch: Record<string, unknown>
  ): Promise<{ assessment: AssessmentDTO; product?: ProductDTO } | null> {
    try {
      const res = await wsFetch(`/api/pra/assessments/${assessmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) return null;
      const data = await res.json();
      setAssessment(data.assessment);
      if (data.product) {
        setProduct(data.product);
        setProfileDraft(productToProfileDraft(data.product));
        setFlowsDraft(data.product.flows ?? []);
      }
      return data;
    } catch {
      return null;
    }
  }

  async function goToStep(target: number) {
    if (!assessment || target === step || target < 1 || target > 8 || target > LAST_UNLOCKED_STEP) return;

    setNavigating(true);
    setActionError(null);
    try {
      const patch: Record<string, unknown> = { currentStep: target };
      if (step === 1 && profileDraft) {
        patch.name = profileDraft.name;
        patch.description = profileDraft.description;
        patch.customers = profileDraft.customers;
        patch.jurisdictions = profileDraft.jurisdictions;
        patch.channels = profileDraft.channels;
      } else if (step === 2 && flowsDraft) {
        patch.flows = flowsDraft;
      }

      const result = await patchAssessment(patch);
      if (!result) {
        setActionError("Could not save your changes. Please try again.");
        return;
      }
      setStep(target);
    } catch {
      setActionError("Could not save your changes. Please try again.");
    } finally {
      setNavigating(false);
    }
  }

  async function createRisk(input: CreateRiskInput) {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/pra/assessments/${assessmentId}/risks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setRisks((prev) => [...prev, data.risk]);
    } catch {
      setActionError("Could not save that risk. Please try again.");
    }
  }

  async function updateRisk(id: string, input: UpdateRiskInput) {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/pra/assessments/${assessmentId}/risks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setRisks((prev) => prev.map((r) => (r.id === id ? data.risk : r)));
    } catch {
      setActionError("Could not save that change. Please try again.");
    }
  }

  async function deleteRisk(id: string) {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/pra/assessments/${assessmentId}/risks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      setRisks((prev) => prev.filter((r) => r.id !== id));
      setControls((prev) => prev.filter((c) => c.risk_id !== id));
    } catch {
      setActionError("Could not remove that risk. Please try again.");
    }
  }

  async function createControl(input: CreateControlInput) {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/pra/assessments/${assessmentId}/controls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setControls((prev) => [...prev, data.control]);
      if (data.workspaceControl) absorbWorkspaceControl(data.workspaceControl);
    } catch {
      setActionError("Could not attach that control. Please try again.");
    }
  }

  /** Keeps the in-memory live-controls list in sync when an attach/update instantiates one. */
  function absorbWorkspaceControl(control: WorkspaceControlDTO) {
    setWorkspaceControls((prev) =>
      prev.some((c) => c.id === control.id) ? prev.map((c) => (c.id === control.id ? control : c)) : [...prev, control]
    );
  }

  async function updateControl(id: string, input: UpdateControlInput) {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/pra/assessments/${assessmentId}/controls/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setControls((prev) => prev.map((c) => (c.id === id ? data.control : c)));
      if (data.workspaceControl) absorbWorkspaceControl(data.workspaceControl);
    } catch {
      setActionError("Could not update that control. Please try again.");
    }
  }

  async function deleteControl(id: string) {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/pra/assessments/${assessmentId}/controls/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      setControls((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setActionError("Could not remove that control. Please try again.");
    }
  }

  async function updateControlEffectiveness(workspaceControlId: string, rating: ControlRating) {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/workspace/controls/${workspaceControlId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ effectivenessRating: rating }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setWorkspaceControls((prev) => prev.map((c) => (c.id === workspaceControlId ? data.control : c)));
    } catch {
      setActionError("Could not update that control's effectiveness. Please try again.");
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

  async function recordDecision(payload: DecisionPayload): Promise<boolean> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/pra/assessments/${assessmentId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setAssessment(data.assessment);
      setDecisionData({
        decision: data.decision,
        conditions: Array.isArray(data.conditions) ? data.conditions : [],
        actions: Array.isArray(data.actions) ? data.actions : [],
      });
      return true;
    } catch {
      return false;
    }
  }

  if (loading) {
    return (
      <ToolFrame>
        <main className="flex-1">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center text-text-muted text-sm">
            Loading assessment...
          </div>
        </main>
      </ToolFrame>
    );
  }

  if (loadError || !assessment || !product || !profileDraft || !flowsDraft) {
    return (
      <ToolFrame>
        <main className="flex-1">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
            <div className="glass-card rounded-2xl p-8">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {loadError ?? "Could not load this assessment."}
              </h2>
              <Link
                href="/assess/product-risk"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors mt-2"
              >
                Back to assessments
              </Link>
            </div>
          </div>
        </main>
      </ToolFrame>
    );
  }

  return (
    <ToolFrame
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Product Risk Assessments", href: "/assess/product-risk" },
        { label: product.name || "Assessment" },
      ]}
    >
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider">Product Risk Assessment</p>
              <h1 className="text-2xl font-bold text-foreground">{product.name || "Untitled product"}</h1>
            </div>
            <Badge variant={STATUS_VARIANT[assessment.status]}>{ASSESSMENT_STATUS_LABEL[assessment.status]}</Badge>
          </div>

          <AssessmentStepper currentStep={step} onSelect={(target) => void goToStep(target)} disabled={navigating} />

          {actionError && <div className="glass-card rounded-xl p-3 text-sm text-red-500 mb-4">{actionError}</div>}

          <div className="glass-card rounded-2xl p-6 sm:p-8">
            {step === 1 && <StepProductProfile draft={profileDraft} onChange={setProfileDraft} />}
            {step === 2 && <StepFlows legs={flowsDraft} onChange={setFlowsDraft} />}
            {step === 3 && (
              <StepInherentRisks
                product={product}
                risks={risks}
                preselectedTypologySlugs={preselectedTypologySlugs}
                onCreateRisk={createRisk}
                onUpdateRisk={updateRisk}
                onDeleteRisk={deleteRisk}
              />
            )}
            {step === 4 && (
              <StepControlMapping
                risks={risks}
                controls={controls}
                onCreateControl={createControl}
                onUpdateControl={updateControl}
                onDeleteControl={deleteControl}
              />
            )}
            {step === 5 && (
              <StepGapsOpLoad
                risks={risks}
                controls={controls}
                workspaceControls={workspaceControls}
                onUpdateControl={updateControl}
              />
            )}
            {step === 6 && (
              <StepResidualRisk
                risks={risks}
                controls={controls}
                workspaceControls={workspaceControls}
                appetiteThresholds={appetiteThresholds}
                onUpdateRisk={updateRisk}
                onUpdateEffectiveness={updateControlEffectiveness}
              />
            )}
            {step === 7 && (
              <StepDecision
                assessment={assessment}
                risks={risks}
                controls={controls}
                workspaceControls={workspaceControls}
                people={people}
                decisionData={decisionData}
                onSaveRecommendation={(text) => patchAssessment({ recommendation: text })}
                onSubmitForReview={() => patchAssessment({ status: "in_review" })}
                onCreatePerson={createPerson}
                onRecordDecision={recordDecision}
              />
            )}
            {step === 8 && (
              <StepPack
                assessment={assessment}
                product={product}
                risks={risks}
                controls={controls}
                workspaceControls={workspaceControls}
                people={people}
                decisionData={decisionData}
                appetiteThresholds={appetiteThresholds}
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
