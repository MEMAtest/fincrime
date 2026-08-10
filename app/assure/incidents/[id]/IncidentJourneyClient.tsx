"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ToolFrame from "@/components/layout/ToolFrame";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import IncidentStepper from "@/components/incidents/IncidentStepper";
import StepIntake from "@/components/incidents/StepIntake";
import StepContainment from "@/components/incidents/StepContainment";
import StepPopulation from "@/components/incidents/StepPopulation";
import StepRootCause, { type NewLinkPayload } from "@/components/incidents/StepRootCause";
import StepRemediation, { type NewActionPayload } from "@/components/incidents/StepRemediation";
import StepEvidence, { type NewEvidencePayload } from "@/components/incidents/StepEvidence";
import StepClosure, { type CloseOutcome } from "@/components/incidents/StepClosure";
import {
  INCIDENT_SEVERITY_LABEL,
  INCIDENT_STATUS_LABEL,
  LAST_UNLOCKED_STEP,
  type ActionDTO,
  type EvidenceDTO,
  type IncidentDTO,
  type IncidentSeverity,
  type IncidentStatus,
  type PersonDTO,
  type PersonRole,
  type ResolvedIncidentLinkDTO,
} from "@/components/incidents/types";
import type { WorkspaceControlDTO, ControlChangeListItem } from "@/components/change-lab/types";
import type { ControlTestListItem } from "@/components/control-testing/types";
import type { AssessmentListItem } from "@/components/pra/types";

const SEVERITY_VARIANT: Record<IncidentSeverity, "default" | "success" | "warning" | "danger" | "info"> = {
  low: "default",
  medium: "info",
  high: "warning",
  critical: "danger",
};

const STATUS_VARIANT: Record<IncidentStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  open: "danger",
  contained: "warning",
  investigating: "info",
  remediating: "warning",
  closed: "success",
  cancelled: "default",
};

interface IncidentJourneyClientProps {
  incidentId: string;
}

export default function IncidentJourneyClient({ incidentId }: IncidentJourneyClientProps) {
  const { wsFetch, ready, workspaceId } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [incident, setIncident] = useState<IncidentDTO | null>(null);
  const [links, setLinks] = useState<ResolvedIncidentLinkDTO[]>([]);
  const [actions, setActions] = useState<ActionDTO[]>([]);
  const [evidence, setEvidence] = useState<EvidenceDTO[]>([]);
  const [people, setPeople] = useState<PersonDTO[]>([]);
  const [controls, setControls] = useState<WorkspaceControlDTO[]>([]);
  const [changes, setChanges] = useState<ControlChangeListItem[]>([]);
  const [tests, setTests] = useState<ControlTestListItem[]>([]);
  const [assessments, setAssessments] = useState<AssessmentListItem[]>([]);
  const [step, setStep] = useState(1);
  const [navigating, setNavigating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Only fetch once a workspace already exists - never bootstrap one just
  // for visiting this page. Mirrors app/assure/control-testing/[id]/TestJourneyClient.tsx's
  // gate; without workspaceId here, an anonymous visitor landing directly on
  // a (nonexistent) incident URL would silently mint a workspace row via
  // wsFetch's ensureWorkspace(). Derived rather than set from inside the
  // effect below, so there is no synchronous setState-in-effect.
  const noWorkspaceYet = ready && !workspaceId;

  useEffect(() => {
    if (!ready || !workspaceId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await wsFetch(`/api/incidents/${incidentId}`);
        if (res.status === 404) {
          if (!cancelled) setLoadError("This incident could not be found in your workspace.");
          return;
        }
        if (!res.ok) {
          if (!cancelled) setLoadError("Could not load this incident. Try reloading the page.");
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        setIncident(data.incident);
        setLinks(Array.isArray(data.links) ? data.links : []);
        setActions(Array.isArray(data.actions) ? data.actions : []);
        setEvidence(Array.isArray(data.evidence) ? data.evidence : []);
        setStep(Math.min(Math.max(data.incident?.current_step ?? 1, 1), LAST_UNLOCKED_STEP));

        const [peopleRes, controlsRes, changesRes, testsRes, assessmentsRes] = await Promise.all([
          wsFetch(`/api/workspace/people`).catch(() => null),
          wsFetch(`/api/workspace/controls`).catch(() => null),
          wsFetch(`/api/control-changes`).catch(() => null),
          wsFetch(`/api/control-tests`).catch(() => null),
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
        if (changesRes?.ok) {
          const c = await changesRes.json();
          setChanges(Array.isArray(c.changes) ? c.changes : []);
        }
        if (testsRes?.ok) {
          const t = await testsRes.json();
          setTests(Array.isArray(t.tests) ? t.tests : []);
        }
        if (assessmentsRes?.ok) {
          const a = await assessmentsRes.json();
          setAssessments(Array.isArray(a.assessments) ? a.assessments : []);
        }
      } catch {
        if (!cancelled) setLoadError("Could not load this incident. Try reloading the page.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, workspaceId, wsFetch, incidentId]);

  const readOnly = incident?.status === "closed" || incident?.status === "cancelled";

  /** Shared PATCH-and-refresh helper: every incident-level save (step change, intake, containment, population, root cause, closure) goes through here. */
  async function patchIncidentDetailed(
    patch: Record<string, unknown>
  ): Promise<{ ok: true; incident: IncidentDTO } | { ok: false; message: string }> {
    try {
      const res = await wsFetch(`/api/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return { ok: false, message: body?.error ?? "Could not save. Please try again." };
      }
      const data = await res.json();
      setIncident(data.incident);
      return { ok: true, incident: data.incident };
    } catch {
      return { ok: false, message: "Could not save. Please try again." };
    }
  }

  async function patchIncident(patch: Record<string, unknown>): Promise<{ ok: true } | { ok: false; message: string }> {
    const result = await patchIncidentDetailed(patch);
    return result.ok ? { ok: true } : { ok: false, message: result.message };
  }

  async function goToStep(target: number) {
    if (!incident || target === step || target < 1 || target > LAST_UNLOCKED_STEP) return;
    setNavigating(true);
    setActionError(null);
    try {
      if (readOnly) {
        setStep(target);
        return;
      }
      const result = await patchIncidentDetailed({ currentStep: target });
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

  async function addLink(payload: NewLinkPayload): Promise<{ ok: true } | { ok: false; message: string }> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/incidents/${incidentId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return { ok: false, message: body?.error ?? "Could not add that link. Please try again." };
      }
      const linksRes = await wsFetch(`/api/incidents/${incidentId}`).catch(() => null);
      if (linksRes?.ok) {
        const detail = await linksRes.json();
        setLinks(Array.isArray(detail.links) ? detail.links : []);
      }
      return { ok: true };
    } catch {
      return { ok: false, message: "Could not add that link. Please try again." };
    }
  }

  async function removeLink(linkId: string): Promise<boolean> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/incidents/${incidentId}/links/${linkId}`, { method: "DELETE" });
      if (!res.ok) return false;
      setLinks((prev) => prev.filter((l) => l.link.id !== linkId));
      return true;
    } catch {
      return false;
    }
  }

  async function addAction(payload: NewActionPayload): Promise<boolean> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/incidents/${incidentId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setActions((prev) => [...prev, data.action]);
      return true;
    } catch {
      return false;
    }
  }

  async function markActionDone(actionId: string): Promise<boolean> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/workspace/actions/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setActions((prev) => prev.map((a) => (a.id === actionId ? data.action : a)));
      return true;
    } catch {
      return false;
    }
  }

  async function addEvidence(payload: NewEvidencePayload): Promise<boolean> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/incidents/${incidentId}/evidence`, {
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

  async function doClose(): Promise<CloseOutcome> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/incidents/${incidentId}/close`, { method: "POST" });
      if (res.status === 409) {
        const body = await res.json().catch(() => null);
        const msg: string = body?.error ?? "Cannot close this incident.";
        const reason: "open_actions" | "no_root_cause" | "already_final" = msg.includes("open remediation")
          ? "open_actions"
          : msg.includes("no root cause")
          ? "no_root_cause"
          : "already_final";
        return { ok: false, reason, message: msg };
      }
      if (!res.ok) return { ok: false, reason: "other", message: "Could not close this incident. Please try again." };
      const data = await res.json();
      setIncident(data.incident);
      return { ok: true };
    } catch {
      return { ok: false, reason: "other", message: "Could not close this incident. Please try again." };
    }
  }

  async function doReopen(): Promise<{ ok: true } | { ok: false; message: string }> {
    setActionError(null);
    try {
      const res = await wsFetch(`/api/incidents/${incidentId}/reopen`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return { ok: false, message: body?.error ?? "Could not reopen this incident. Please try again." };
      }
      const data = await res.json();
      setIncident(data.incident);
      return { ok: true };
    } catch {
      return { ok: false, message: "Could not reopen this incident. Please try again." };
    }
  }

  if (loading && !noWorkspaceYet) {
    return (
      <ToolFrame>
        <main className="flex-1">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center text-text-muted text-sm">
            Loading incident...
          </div>
        </main>
      </ToolFrame>
    );
  }

  if (noWorkspaceYet || loadError || !incident) {
    return (
      <ToolFrame>
        <main className="flex-1">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
            <div className="glass-card rounded-2xl p-8">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {noWorkspaceYet ? "This incident could not be found in your workspace." : loadError ?? "Could not load this incident."}
              </h2>
              <Link
                href="/assure/incidents"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors mt-2"
              >
                Back to incidents
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
        { label: "Incidents", href: "/assure/incidents" },
        { label: incident.title || "Incident" },
      ]}
    >
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider">
                {incident.reference ? `Incident ${incident.reference}` : "Incident"}
              </p>
              <h1 className="text-2xl font-bold text-foreground">{incident.title || "Untitled incident"}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={SEVERITY_VARIANT[incident.severity]}>{INCIDENT_SEVERITY_LABEL[incident.severity]}</Badge>
              <Badge variant={STATUS_VARIANT[incident.status]}>{INCIDENT_STATUS_LABEL[incident.status]}</Badge>
            </div>
          </div>

          <IncidentStepper currentStep={step} onSelect={(target) => void goToStep(target)} disabled={navigating} />

          {actionError && <div className="glass-card rounded-xl p-3 text-sm text-red-500 mb-4">{actionError}</div>}

          <div className="glass-card rounded-2xl p-6 sm:p-8">
            {step === 1 && (
              <StepIntake
                incident={incident}
                people={people}
                readOnly={Boolean(readOnly)}
                onSave={patchIncident}
                onCreatePerson={createPerson}
              />
            )}
            {step === 2 && <StepContainment incident={incident} readOnly={Boolean(readOnly)} onSave={patchIncident} />}
            {step === 3 && (
              <StepPopulation
                incident={incident}
                readOnly={Boolean(readOnly)}
                onSave={(affectedPopulation) => patchIncident({ affectedPopulation })}
              />
            )}
            {step === 4 && (
              <StepRootCause
                incident={incident}
                links={links}
                controls={controls}
                changes={changes}
                tests={tests}
                assessments={assessments}
                readOnly={Boolean(readOnly)}
                onSave={patchIncident}
                onAddLink={addLink}
                onRemoveLink={removeLink}
              />
            )}
            {step === 5 && (
              <StepRemediation
                actions={actions}
                people={people}
                readOnly={Boolean(readOnly)}
                onAdd={addAction}
                onMarkDone={markActionDone}
              />
            )}
            {step === 6 && (
              <StepEvidence evidence={evidence} loading={false} readOnly={Boolean(readOnly)} onAdd={addEvidence} />
            )}
            {step === 7 && (
              <StepClosure
                incident={incident}
                links={links}
                actions={actions}
                evidence={evidence}
                people={people}
                onSave={patchIncident}
                onClose={doClose}
                onReopen={doReopen}
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
