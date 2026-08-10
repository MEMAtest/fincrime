"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import TestStepper from "@/components/control-testing/TestStepper";
import StepScope, { type ScopeFields } from "@/components/control-testing/StepScope";
import StepSamples from "@/components/control-testing/StepSamples";
import StepFindings, { type EditFindingPayload, type NewFindingPayload } from "@/components/control-testing/StepFindings";
import StepEvidence, { type NewEvidencePayload } from "@/components/control-testing/StepEvidence";
import StepConclusion from "@/components/control-testing/StepConclusion";
import {
  CONTROL_TEST_STATUS_LABEL,
  LAST_UNLOCKED_STEP,
  type ActionDTO,
  type ControlTestDTO,
  type ControlTestFindingDTO,
  type ControlTestResult,
  type ControlTestStatus,
  type EvidenceDTO,
  type PersonDTO,
  type PersonRole,
  type WorkspaceControlDTO,
} from "@/components/control-testing/types";

const STATUS_VARIANT: Record<ControlTestStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  planned: "default",
  in_progress: "info",
  complete: "success",
  cancelled: "default",
};

const RESULT_VARIANT: Record<ControlTestResult, "default" | "success" | "warning" | "danger" | "info"> = {
  pass: "success",
  pass_with_findings: "warning",
  fail: "danger",
};

interface TestJourneyClientProps {
  testId: string;
}

export default function TestJourneyClient({ testId }: TestJourneyClientProps) {
  const { wsFetch, ready } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [test, setTest] = useState<ControlTestDTO | null>(null);
  const [control, setControl] = useState<WorkspaceControlDTO | null>(null);
  const [findings, setFindings] = useState<ControlTestFindingDTO[]>([]);
  const [evidence, setEvidence] = useState<EvidenceDTO[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(true);
  const [actions, setActions] = useState<ActionDTO[]>([]);
  const [people, setPeople] = useState<PersonDTO[]>([]);
  const [step, setStep] = useState(1);
  const [navigating, setNavigating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await wsFetch(`/api/control-tests/${testId}`);
        if (res.status === 404) {
          if (!cancelled) setLoadError("This control test could not be found in your workspace.");
          return;
        }
        if (!res.ok) {
          if (!cancelled) setLoadError("Could not load this control test. Try reloading the page.");
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        setTest(data.test);
        setControl(data.control ?? null);
        setFindings(Array.isArray(data.findings) ? data.findings : []);
        setEvidence(Array.isArray(data.evidence) ? data.evidence : []);
        setActions(Array.isArray(data.actions) ? data.actions : []);
        setEvidenceLoading(false);
        setStep(Math.min(Math.max(data.test?.current_step ?? 1, 1), LAST_UNLOCKED_STEP));

        const peopleRes = await wsFetch(`/api/workspace/people`).catch(() => null);
        if (!cancelled && peopleRes?.ok) {
          const p = await peopleRes.json();
          setPeople(Array.isArray(p.people) ? p.people : []);
        }
      } catch {
        if (!cancelled) setLoadError("Could not load this control test. Try reloading the page.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, wsFetch, testId]);

  const readOnly = test?.status === "complete" || test?.status === "cancelled";

  /** Shared PATCH-and-refresh helper: every test-level save (step change, scope, samples, conclusion) goes through here. Returns null (and leaves state untouched) on a 409 - the test became a historical record mid-edit. */
  async function patchTest(patch: Record<string, unknown>): Promise<ControlTestDTO | null> {
    try {
      const res = await wsFetch(`/api/control-tests/${testId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) return null;
      const data = await res.json();
      setTest(data.test);
      return data.test;
    } catch {
      return null;
    }
  }

  async function goToStep(target: number) {
    if (!test || target === step || target < 1 || target > LAST_UNLOCKED_STEP) return;
    setNavigating(true);
    setActionError(null);
    try {
      if (readOnly) {
        setStep(target);
        return;
      }
      const updated = await patchTest({ currentStep: target });
      if (!updated) {
        setActionError("Could not save your progress. Please try again.");
        return;
      }
      setStep(target);
    } finally {
      setNavigating(false);
    }
  }

  async function saveScope(fields: ScopeFields) {
    setActionError(null);
    const updated = await patchTest({
      title: fields.title,
      method: fields.method,
      periodStart: fields.periodStart,
      periodEnd: fields.periodEnd,
      testerPersonId: fields.testerPersonId,
    });
    if (!updated) setActionError("Could not save the test scope. Please try again.");
  }

  async function saveSamples(fields: {
    sampleSize: number | null;
    samplesPassed: number | null;
    samplesFailed: number | null;
    samplesPartial: number | null;
  }) {
    setActionError(null);
    const updated = await patchTest(fields);
    if (!updated) setActionError("Could not save the sample counts. Please try again.");
  }

  async function saveConclusion(text: string) {
    setActionError(null);
    const updated = await patchTest({ conclusion: text });
    if (!updated) setActionError("Could not save the conclusion. Please try again.");
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

  async function addFinding(payload: NewFindingPayload): Promise<boolean> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/control-tests/${testId}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: payload.description,
          severity: payload.severity,
          sampleRef: payload.sampleRef,
          createAction: payload.createAction,
          ownerPersonId: payload.ownerPersonId,
          dueDate: payload.dueDate,
        }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setFindings((prev) => [...prev, data.finding]);
      // A new finding may have created an action, which affects the sample
      // preview and the final report - refresh the actions list rather than
      // guessing its shape client-side.
      if (data.finding?.action_id) {
        const actionsRes = await wsFetch(`/api/control-tests/${testId}`).catch(() => null);
        if (actionsRes?.ok) {
          const detail = await actionsRes.json();
          setActions(Array.isArray(detail.actions) ? detail.actions : []);
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  async function editFinding(findingId: string, payload: EditFindingPayload): Promise<boolean> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/control-tests/${testId}/findings/${findingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setFindings((prev) => prev.map((f) => (f.id === findingId ? data.finding : f)));
      return true;
    } catch {
      return false;
    }
  }

  async function deleteFinding(findingId: string): Promise<boolean> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/control-tests/${testId}/findings/${findingId}`, { method: "DELETE" });
      if (!res.ok) return false;
      setFindings((prev) => prev.filter((f) => f.id !== findingId));
      return true;
    } catch {
      return false;
    }
  }

  async function addEvidence(payload: NewEvidencePayload): Promise<boolean> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/control-tests/${testId}/evidence`, {
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

  async function completeTest(): Promise<{ ok: true } | { ok: false; message: string }> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/control-tests/${testId}/complete`, { method: "POST" });
      if (res.status === 409) {
        const body = await res.json().catch(() => null);
        return { ok: false, message: body?.error ?? "This test is already complete or cancelled." };
      }
      if (!res.ok) return { ok: false, message: "Could not complete this test. Please try again." };
      const data = await res.json();
      setTest(data.test);
      setControl(data.control ?? null);
      return { ok: true };
    } catch {
      return { ok: false, message: "Could not complete this test. Please try again." };
    }
  }

  if (loading) {
    return (
      <ToolFrame>
        <main className="flex-1">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center text-text-muted text-sm">
            Loading control test...
          </div>
        </main>
      </ToolFrame>
    );
  }

  if (loadError || !test || !control) {
    return (
      <ToolFrame>
        <main className="flex-1">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
            <div className="glass-card rounded-2xl p-8">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {loadError ?? "Could not load this control test."}
              </h2>
              <Link
                href="/assure/control-testing"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors mt-2"
              >
                Back to control tests
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
        { label: "Control Testing", href: "/assure/control-testing" },
        { label: test.title || "Test" },
      ]}
    >
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider">Control Test</p>
              <h1 className="text-2xl font-bold text-foreground">{test.title || "Untitled test"}</h1>
            </div>
            <div className="flex items-center gap-2">
              {test.result && <Badge variant={RESULT_VARIANT[test.result]}>{test.result.replace(/_/g, " ")}</Badge>}
              <Badge variant={STATUS_VARIANT[test.status]}>{CONTROL_TEST_STATUS_LABEL[test.status]}</Badge>
            </div>
          </div>

          <TestStepper currentStep={step} onSelect={(target) => void goToStep(target)} disabled={navigating} />

          {actionError && <div className="glass-card rounded-xl p-3 text-sm text-red-500 mb-4">{actionError}</div>}

          <div className="glass-card rounded-2xl p-6 sm:p-8">
            {step === 1 && (
              <StepScope
                test={test}
                control={control}
                people={people}
                readOnly={Boolean(readOnly)}
                onSave={saveScope}
                onCreatePerson={createPerson}
              />
            )}
            {step === 2 && <StepSamples test={test} findings={findings} readOnly={Boolean(readOnly)} onSave={saveSamples} />}
            {step === 3 && (
              <StepFindings
                findings={findings}
                people={people}
                readOnly={Boolean(readOnly)}
                onAdd={addFinding}
                onEdit={editFinding}
                onDelete={deleteFinding}
              />
            )}
            {step === 4 && (
              <StepEvidence evidence={evidence} loading={evidenceLoading} readOnly={Boolean(readOnly)} onAdd={addEvidence} />
            )}
            {step === 5 && (
              <StepConclusion
                test={test}
                control={control}
                findings={findings}
                evidence={evidence}
                actions={actions}
                people={people}
                onSaveConclusion={saveConclusion}
                onComplete={completeTest}
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
