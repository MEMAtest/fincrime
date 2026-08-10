"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import ChangeStepper from "@/components/change-lab/ChangeStepper";
import StepControl from "@/components/change-lab/StepControl";
import StepProposed from "@/components/change-lab/StepProposed";
import StepSupportingData from "@/components/change-lab/StepSupportingData";
import StepImpact from "@/components/change-lab/StepImpact";
import StepApproval, { type ChangeDecisionPayload } from "@/components/change-lab/StepApproval";
import StepMonitoring from "@/components/change-lab/StepMonitoring";
import StepImplement from "@/components/change-lab/StepImplement";
import { DEFAULT_HOURLY_COST_GBP } from "@/data/scoring/operational-load";
import {
  CONTROL_CHANGE_STATUS_LABEL,
  LAST_UNLOCKED_STEP,
  type ControlChangeDTO,
  type ControlChangeStatus,
  type ControlFieldValues,
  type DecisionDTO,
  type ConditionDTO,
  type ActionDTO,
  type PersonDTO,
  type PersonRole,
  type WorkspaceControlDTO,
} from "@/components/change-lab/types";

const STATUS_VARIANT: Record<ControlChangeStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  draft: "default",
  in_review: "info",
  approved: "warning",
  rejected: "danger",
  implemented: "success",
  rolled_back: "default",
};

interface DecisionRecord {
  decision: DecisionDTO | null;
  conditions: ConditionDTO[];
  actions: ActionDTO[];
}

const EMPTY_DECISION_RECORD: DecisionRecord = { decision: null, conditions: [], actions: [] };

interface ChangeJourneyClientProps {
  changeId: string;
}

export default function ChangeJourneyClient({ changeId }: ChangeJourneyClientProps) {
  const { wsFetch, ready } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [change, setChange] = useState<ControlChangeDTO | null>(null);
  const [control, setControl] = useState<WorkspaceControlDTO | null>(null);
  const [people, setPeople] = useState<PersonDTO[]>([]);
  const [decisionData, setDecisionData] = useState<DecisionRecord>(EMPTY_DECISION_RECORD);
  const [defaultHourlyCostGbp, setDefaultHourlyCostGbp] = useState<number>(DEFAULT_HOURLY_COST_GBP);
  const [step, setStep] = useState(1);
  const [navigating, setNavigating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await wsFetch(`/api/control-changes/${changeId}`);
        if (res.status === 404) {
          if (!cancelled) setLoadError("This control change could not be found in your workspace.");
          return;
        }
        if (!res.ok) {
          if (!cancelled) setLoadError("Could not load this control change. Try reloading the page.");
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        setChange(data.change);
        setControl(data.control ?? null);
        setStep(Math.min(Math.max(data.change?.current_step ?? 1, 1), LAST_UNLOCKED_STEP));
        setDecisionData({
          decision: data.decision ?? null,
          conditions: Array.isArray(data.conditions) ? data.conditions : [],
          actions: Array.isArray(data.actions) ? data.actions : [],
        });

        const [peopleRes, meRes] = await Promise.all([
          wsFetch(`/api/workspace/people`).catch(() => null),
          wsFetch(`/api/workspace/me`).catch(() => null),
        ]);
        if (!cancelled && peopleRes?.ok) {
          const p = await peopleRes.json();
          setPeople(Array.isArray(p.people) ? p.people : []);
        }
        if (!cancelled && meRes?.ok) {
          const m = await meRes.json();
          if (typeof m?.settings?.defaultHourlyCostGbp === "number") {
            setDefaultHourlyCostGbp(m.settings.defaultHourlyCostGbp);
          }
        }
      } catch {
        if (!cancelled) setLoadError("Could not load this control change. Try reloading the page.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, wsFetch, changeId]);

  /** Shared PATCH-and-refresh helper: every change-level save (step change, proposed, supporting data, impact, monitoring, rollback criteria) goes through here. */
  async function patchChange(patch: Record<string, unknown>): Promise<ControlChangeDTO | null> {
    try {
      const res = await wsFetch(`/api/control-changes/${changeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) return null;
      const data = await res.json();
      setChange(data.change);
      return data.change;
    } catch {
      return null;
    }
  }

  async function goToStep(target: number) {
    if (!change || target === step || target < 1 || target > LAST_UNLOCKED_STEP) return;
    setNavigating(true);
    setActionError(null);
    try {
      const updated = await patchChange({ currentStep: target });
      if (!updated) {
        setActionError("Could not save your changes. Please try again.");
        return;
      }
      setStep(target);
    } finally {
      setNavigating(false);
    }
  }

  async function saveProposed(fields: ControlFieldValues) {
    setActionError(null);
    const updated = await patchChange({ proposed: fields });
    if (!updated) setActionError("Could not save the proposed change. Please try again.");
  }

  async function saveControlHeader(fields: { title?: string; rationale?: string | null; changeType?: string | null }) {
    setActionError(null);
    const updated = await patchChange(fields);
    if (!updated) setActionError("Could not save your changes. Please try again.");
  }

  async function saveSupportingData(data: Record<string, unknown>) {
    setActionError(null);
    const updated = await patchChange({ supportingData: data });
    if (!updated) setActionError("Could not save supporting data. Please try again.");
  }

  async function saveImpact(data: Record<string, unknown>) {
    setActionError(null);
    const updated = await patchChange({ impact: data });
    if (!updated) setActionError("Could not save impact. Please try again.");
  }

  async function savePilot(pilot: boolean, pilotNotes: string | null) {
    setActionError(null);
    const updated = await patchChange({ pilot, pilotNotes });
    if (!updated) setActionError("Could not save the pilot settings. Please try again.");
  }

  async function saveMonitoring(data: Record<string, unknown>) {
    setActionError(null);
    const updated = await patchChange({ monitoring: data });
    if (!updated) setActionError("Could not save the monitoring plan. Please try again.");
  }

  async function saveRollbackCriteria(text: string) {
    setActionError(null);
    const updated = await patchChange({ rollbackCriteria: text });
    if (!updated) setActionError("Could not save rollback criteria. Please try again.");
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

  async function recordDecision(payload: ChangeDecisionPayload): Promise<boolean> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/control-changes/${changeId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setChange(data.change);
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

  async function implementChange(): Promise<{ ok: true } | { ok: false; message: string }> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/control-changes/${changeId}/implement`, { method: "POST" });
      if (res.status === 409) {
        const body = await res.json().catch(() => null);
        return { ok: false, message: body?.error ?? "This change must be approved before it can be implemented." };
      }
      if (!res.ok) return { ok: false, message: "Could not implement this change. Please try again." };
      const data = await res.json();
      setChange(data.change);
      setControl(data.control ?? null);
      return { ok: true };
    } catch {
      return { ok: false, message: "Could not implement this change. Please try again." };
    }
  }

  async function rollbackChange(): Promise<{ ok: true } | { ok: false; message: string }> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/control-changes/${changeId}/rollback`, { method: "POST" });
      if (res.status === 409) {
        const body = await res.json().catch(() => null);
        return { ok: false, message: body?.error ?? "This change must be implemented before it can be rolled back." };
      }
      if (!res.ok) return { ok: false, message: "Could not roll back this change. Please try again." };
      const data = await res.json();
      setChange(data.change);
      setControl(data.control ?? null);
      return { ok: true };
    } catch {
      return { ok: false, message: "Could not roll back this change. Please try again." };
    }
  }

  if (loading) {
    return (
      <ToolFrame>
        <main className="flex-1">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center text-text-muted text-sm">
            Loading control change...
          </div>
        </main>
      </ToolFrame>
    );
  }

  if (loadError || !change || !control) {
    return (
      <ToolFrame>
        <main className="flex-1">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
            <div className="glass-card rounded-2xl p-8">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {loadError ?? "Could not load this control change."}
              </h2>
              <Link
                href="/change-lab"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors mt-2"
              >
                Back to control changes
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
        { label: "Control Changes", href: "/change-lab" },
        { label: change.title || "Change" },
      ]}
    >
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider">Control Change</p>
              <h1 className="text-2xl font-bold text-foreground">{change.title || "Untitled change"}</h1>
            </div>
            <Badge variant={STATUS_VARIANT[change.status]}>{CONTROL_CHANGE_STATUS_LABEL[change.status]}</Badge>
          </div>

          <ChangeStepper currentStep={step} onSelect={(target) => void goToStep(target)} disabled={navigating} />

          {actionError && <div className="glass-card rounded-xl p-3 text-sm text-red-500 mb-4">{actionError}</div>}

          <div className="glass-card rounded-2xl p-6 sm:p-8">
            {step === 1 && <StepControl change={change} control={control} people={people} onSave={saveControlHeader} />}
            {step === 2 && <StepProposed change={change} control={control} people={people} onSave={saveProposed} />}
            {step === 3 && (
              <StepSupportingData changeId={change.id} supportingData={change.supporting_data} onSave={saveSupportingData} />
            )}
            {step === 4 && <StepImpact change={change} onSave={saveImpact} defaultHourlyCostGbp={defaultHourlyCostGbp} />}
            {step === 5 && (
              <StepApproval
                change={change}
                people={people}
                decisionData={decisionData}
                onSavePilot={savePilot}
                onCreatePerson={createPerson}
                onRecordDecision={recordDecision}
              />
            )}
            {step === 6 && <StepMonitoring change={change} people={people} onSave={saveMonitoring} />}
            {step === 7 && (
              <StepImplement
                change={change}
                control={control}
                people={people}
                decisionData={decisionData}
                onSaveRollbackCriteria={saveRollbackCriteria}
                onImplement={implementChange}
                onRollback={rollbackChange}
                defaultHourlyCostGbp={defaultHourlyCostGbp}
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
