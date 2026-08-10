"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, RotateCcw, Rocket, FlaskConical } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { PriorityBadge } from "@/components/controls/ControlBits";
import PDFExportButton from "@/components/shared/PDFExportButton";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { DEFAULT_HOURLY_COST_GBP, scoreOperationalLoad } from "@/data/scoring/operational-load";
import {
  CONTROL_CHANGE_STATUS_LABEL,
  type ActionDTO,
  type ChangeExportPayload,
  type ConditionDTO,
  type ControlChangeDTO,
  type ControlFieldValues,
  type DecisionDTO,
  type EvidenceDTO,
  type PersonDTO,
  type WorkspaceControlDTO,
} from "./types";

interface DecisionRecord {
  decision: DecisionDTO | null;
  conditions: ConditionDTO[];
  actions: ActionDTO[];
}

interface StepImplementProps {
  change: ControlChangeDTO;
  control: WorkspaceControlDTO;
  people: PersonDTO[];
  decisionData: DecisionRecord;
  onSaveRollbackCriteria: (text: string) => Promise<void>;
  onImplement: () => Promise<{ ok: true } | { ok: false; message: string }>;
  onRollback: () => Promise<{ ok: true } | { ok: false; message: string }>;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const FIELD_LABELS: { key: keyof ControlFieldValues; label: string }[] = [
  { key: "objective", label: "Objective" },
  { key: "threshold", label: "Threshold" },
  { key: "operatingFrequency", label: "Operating frequency" },
  { key: "status", label: "Status" },
  { key: "effectivenessRating", label: "Effectiveness rating" },
  { key: "systems", label: "Systems" },
  { key: "dataInputs", label: "Data inputs" },
  { key: "productApplicability", label: "Product applicability" },
  { key: "typologySlugs", label: "Typology slugs" },
  { key: "ownerPersonId", label: "Owner" },
  { key: "approverPersonId", label: "Approver" },
];

function formatFieldValue(key: keyof ControlFieldValues, value: unknown, personById: Map<string, PersonDTO>): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (key === "ownerPersonId" || key === "approverPersonId") {
    return personById.get(String(value))?.name ?? "Unassigned";
  }
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  return String(value).replace(/_/g, " ");
}

/** Step 7: rollback criteria, the lifecycle buttons (implement / roll back), and the on-screen change pack + PDF export. */
export default function StepImplement({
  change,
  control,
  people,
  decisionData,
  onSaveRollbackCriteria,
  onImplement,
  onRollback,
}: StepImplementProps) {
  const { wsFetch } = useWorkspace();

  const [rollbackCriteria, setRollbackCriteria] = useState(change.rollback_criteria ?? "");
  const [savingCriteria, setSavingCriteria] = useState(false);
  const [busy, setBusy] = useState<"implement" | "rollback" | null>(null);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<EvidenceDTO[]>([]);

  useEffect(() => {
    let cancelled = false;
    wsFetch(`/api/control-changes/${change.id}/evidence`)
      .then((res) => (res.ok ? res.json() : { evidence: [] }))
      .then((data) => {
        if (!cancelled) setEvidence(Array.isArray(data.evidence) ? data.evidence : []);
      })
      .catch(() => {
        if (!cancelled) setEvidence([]);
      });
    return () => {
      cancelled = true;
    };
  }, [change.id, wsFetch]);

  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const fieldDiffs = useMemo(() => {
    return FIELD_LABELS.map(({ key, label }) => {
      const baselineValue = change.baseline[key];
      const proposedValue = key in change.proposed ? change.proposed[key] : baselineValue;
      const current = formatFieldValue(key, baselineValue, personById);
      const proposed = formatFieldValue(key, proposedValue, personById);
      return { field: key, label, current, proposed, changed: current !== proposed };
    });
  }, [change.baseline, change.proposed, personById]);
  const changedFieldCount = fieldDiffs.filter((f) => f.changed).length;

  const supportingData = change.supporting_data;
  const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const baselineAlertVolume = numOrNull(supportingData.baselineAlertVolume);
  const expectedVolume = numOrNull(supportingData.expectedVolume);
  const handlingMinutes = numOrNull(change.impact.handlingMinutes);
  const hourlyCostGbp = numOrNull(change.impact.hourlyCostGbp) ?? DEFAULT_HOURLY_COST_GBP;

  const before =
    baselineAlertVolume !== null && handlingMinutes !== null
      ? scoreOperationalLoad({ monthlyVolume: baselineAlertVolume, alertRatePct: 100, handlingMinutes, hourlyCostGbp })
      : null;
  const after =
    expectedVolume !== null && handlingMinutes !== null
      ? scoreOperationalLoad({ monthlyVolume: expectedVolume, alertRatePct: 100, handlingMinutes, hourlyCostGbp })
      : null;

  const monitoringRows = useMemo(
    () => (Array.isArray(change.monitoring.rows) ? change.monitoring.rows : []),
    [change.monitoring]
  );

  // True once the live control has moved past the version this change was
  // applied as - i.e. someone edited the control after implementation. A
  // rollback restores `baseline`, not that intervening version, so it would
  // silently discard those edits; warn before the click rather than after.
  const controlEditedSinceImplement =
    change.status === "implemented" && change.applied_version !== null && control.version > change.applied_version;

  const exportPayload: ChangeExportPayload = useMemo(
    () => ({
      changeTitle: change.title,
      controlName: control.name,
      changeType: change.change_type,
      status: change.status,
      rationale: change.rationale,
      fieldDiffs,
      changedFieldCount,
      supportingData: {
        baselineAlertVolume,
        truePositives: numOrNull(supportingData.truePositives),
        falsePositives: numOrNull(supportingData.falsePositives),
        expectedVolume,
        testingNotes: typeof supportingData.testingNotes === "string" ? supportingData.testingNotes : null,
      },
      evidence: evidence.map((e) => ({ title: e.title, type: e.type, description: e.description, linkUrl: e.link_url })),
      impact: {
        beforeAnalystHoursPerMonth: before?.analystHoursPerMonth ?? null,
        afterAnalystHoursPerMonth: after?.analystHoursPerMonth ?? null,
        beforeFte: before?.fte ?? null,
        afterFte: after?.fte ?? null,
        beforeMonthlyCostGbp: before?.monthlyCostGbp ?? null,
        afterMonthlyCostGbp: after?.monthlyCostGbp ?? null,
        customerFrictionNotes: typeof change.impact.customerFrictionNotes === "string" ? change.impact.customerFrictionNotes : null,
        riskImpactNotes: typeof change.impact.riskImpactNotes === "string" ? change.impact.riskImpactNotes : null,
      },
      pilot: change.pilot,
      pilotNotes: change.pilot_notes,
      decision: decisionData.decision
        ? {
            outcome: decisionData.decision.outcome,
            decidedByName: personById.get(decisionData.decision.decided_by_person_id)?.name ?? "Unknown",
            decidedAt: decisionData.decision.decided_at,
            rationale: decisionData.decision.rationale,
          }
        : null,
      conditions: decisionData.conditions.map((c) => ({
        description: c.description,
        dueDate: c.due_date,
        ownerName: c.owner_person_id ? personById.get(c.owner_person_id)?.name ?? null : null,
        status: c.status,
      })),
      actions: decisionData.actions.map((a) => ({
        title: a.title,
        ownerName: a.owner_person_id ? personById.get(a.owner_person_id)?.name ?? null : null,
        dueDate: a.due_date,
        priority: a.priority,
        status: a.status,
      })),
      monitoring: monitoringRows.map((r: Record<string, unknown>) => ({
        metric: typeof r.metric === "string" ? r.metric : "",
        target: typeof r.target === "string" ? r.target : "",
        owner: typeof r.ownerPersonId === "string" && r.ownerPersonId ? personById.get(r.ownerPersonId)?.name ?? "Unassigned" : "Unassigned",
        reviewDate: typeof r.reviewDate === "string" ? r.reviewDate : "",
      })),
      rollbackCriteria: change.rollback_criteria,
      implementedAt: change.implemented_at,
      rolledBackAt: change.rolled_back_at,
      appliedVersion: change.applied_version,
    }),
    [change, control, fieldDiffs, changedFieldCount, supportingData, baselineAlertVolume, expectedVolume, before, after, evidence, decisionData, personById, monitoringRows]
  );

  const saveCriteria = async () => {
    setSavingCriteria(true);
    try {
      await onSaveRollbackCriteria(rollbackCriteria);
    } finally {
      setSavingCriteria(false);
    }
  };

  const doImplement = async () => {
    setBusy("implement");
    setLifecycleError(null);
    try {
      const result = await onImplement();
      if (!result.ok) setLifecycleError(result.message);
    } finally {
      setBusy(null);
    }
  };

  const doRollback = async () => {
    setBusy("rollback");
    setLifecycleError(null);
    try {
      const result = await onRollback();
      if (!result.ok) setLifecycleError(result.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Implement</h2>
        <p className="text-sm text-text-muted">
          Record when to roll this change back, then apply it to the live control, or roll it back if it&apos;s
          already implemented.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-soft">Rollback criteria</label>
        <textarea
          value={rollbackCriteria}
          onChange={(e) => setRollbackCriteria(e.target.value)}
          rows={3}
          placeholder="Under what conditions should this change be rolled back (e.g. alert volume drops below X, FP rate rises above Y)?"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
        />
        <div>
          <Button size="sm" variant="secondary" onClick={saveCriteria} disabled={savingCriteria}>
            {savingCriteria ? "Saving..." : "Save rollback criteria"}
          </Button>
        </div>
      </div>

      <div className="glass-card rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Lifecycle</p>
            <p className="text-xs text-text-muted mt-0.5">Live control is currently at v{control.version}.</p>
          </div>
          <Badge>{CONTROL_CHANGE_STATUS_LABEL[change.status]}</Badge>
        </div>

        {lifecycleError && (
          <div className="flex items-start gap-2 text-sm text-red-500">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {lifecycleError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <Button onClick={doImplement} disabled={change.status !== "approved" || busy !== null}>
              <Rocket className="h-4 w-4" /> {busy === "implement" ? "Implementing..." : "Mark implemented"}
            </Button>
            <p className="text-xs text-text-muted mt-1.5 max-w-xs">
              Writes the proposed values onto the live control and bumps its version. Only available once this
              change is approved.
            </p>
          </div>
          <div>
            <Button
              variant="secondary"
              onClick={doRollback}
              disabled={change.status !== "implemented" || busy !== null}
            >
              <RotateCcw className="h-4 w-4" /> {busy === "rollback" ? "Rolling back..." : "Roll back"}
            </Button>
            <p className="text-xs text-text-muted mt-1.5 max-w-xs">
              Restores the baseline values as a new control version. Only available once this change is implemented.
            </p>
            {controlEditedSinceImplement && (
              <div className="flex items-start gap-1.5 text-xs text-amber-500 mt-1.5 max-w-xs">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  The live control has been edited since this change was implemented (now v{control.version}, applied
                  as v{change.applied_version}). Rolling back will overwrite those intervening edits with the
                  baseline values.
                </span>
              </div>
            )}
          </div>
        </div>

        {change.status === "implemented" && (
          <>
            <p className="text-xs text-accent flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Implemented {fmtDate(change.implemented_at)}, applied as control
              version {change.applied_version}.
            </p>
            <Link
              href={`/assure/control-testing/new?controlId=${change.workspace_control_id}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
            >
              <FlaskConical className="h-3.5 w-3.5" /> Test this control
            </Link>
          </>
        )}
        {change.status === "rolled_back" && (
          <p className="text-xs text-text-muted flex items-center gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Rolled back {fmtDate(change.rolled_back_at)}. Baseline restored as
            control version {control.version}.
          </p>
        )}
      </div>

      {/* Change pack */}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-4 border-t border-white/10">
        <h3 className="text-lg font-semibold text-foreground">Change pack</h3>
        <PDFExportButton module="control_change" assessmentData={{ ...exportPayload }} />
      </div>

      <section className="glass-card rounded-xl p-5">
        <h4 className="text-sm font-semibold text-foreground mb-3">
          Current vs proposed ({changedFieldCount} changed)
        </h4>
        <div className="space-y-1.5">
          {fieldDiffs.map((f) => (
            <div key={f.field} className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-white/5 last:border-0">
              <span className="text-text-muted w-40 shrink-0">{f.label}</span>
              <span className={f.changed ? "text-text-muted" : "text-foreground"}>{f.current}</span>
              <span className="text-text-muted">&rarr;</span>
              <span className={`text-right flex-1 ${f.changed ? "text-accent font-medium" : "text-foreground"}`}>{f.proposed}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card rounded-xl p-5">
        <h4 className="text-sm font-semibold text-foreground mb-2">Supporting data</h4>
        <div className="grid sm:grid-cols-2 gap-2 text-sm text-text-muted">
          <p>Baseline volume: {baselineAlertVolume ?? "Not recorded"}</p>
          <p>Expected volume: {expectedVolume ?? "Not recorded"}</p>
          <p>True positives: {numOrNull(supportingData.truePositives) ?? "Not recorded"}</p>
          <p>False positives: {numOrNull(supportingData.falsePositives) ?? "Not recorded"}</p>
        </div>
        {exportPayload.supportingData.testingNotes && (
          <p className="text-sm text-foreground mt-2">{exportPayload.supportingData.testingNotes}</p>
        )}
      </section>

      <section className="glass-card rounded-xl p-5">
        <h4 className="text-sm font-semibold text-foreground mb-2">Impact</h4>
        {before && after ? (
          <div className="grid sm:grid-cols-3 gap-3 text-sm text-text-muted">
            <p>Analyst hours: {before.analystHoursPerMonth} &rarr; {after.analystHoursPerMonth}</p>
            <p>FTE: {before.fte} &rarr; {after.fte}</p>
            <p>Monthly cost: £{before.monthlyCostGbp} &rarr; £{after.monthlyCostGbp}</p>
          </div>
        ) : (
          <p className="text-sm text-text-muted">Not enough data to compute operational load.</p>
        )}
      </section>

      <section className="glass-card rounded-xl p-5 space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Decision, conditions &amp; actions</h4>
        {decisionData.decision ? (
          <p className="text-sm text-foreground">
            {decisionData.decision.outcome.replace(/_/g, " ")} by{" "}
            {personById.get(decisionData.decision.decided_by_person_id)?.name ?? "Unknown"} on{" "}
            {fmtDate(decisionData.decision.decided_at)}
          </p>
        ) : (
          <p className="text-sm text-text-muted">No decision recorded yet.</p>
        )}
        {decisionData.conditions.length > 0 && (
          <div className="space-y-1">
            {decisionData.conditions.map((c) => (
              <p key={c.id} className="text-xs text-text-muted">
                Condition: {c.description} ({fmtDate(c.due_date)})
              </p>
            ))}
          </div>
        )}
        {decisionData.actions.length > 0 && (
          <div className="space-y-1">
            {decisionData.actions.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs text-text-muted">
                <span>Action: {a.title} ({fmtDate(a.due_date)})</span>
                <PriorityBadge priority={a.priority} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass-card rounded-xl p-5">
        <h4 className="text-sm font-semibold text-foreground mb-2">Monitoring plan</h4>
        {monitoringRows.length === 0 ? (
          <p className="text-sm text-text-muted">No monitoring rows recorded.</p>
        ) : (
          <div className="space-y-1">
            {exportPayload.monitoring.map((r, i) => (
              <p key={i} className="text-xs text-text-muted">
                {r.metric || "Metric"} - target {r.target || "n/a"} - {r.owner} - due {fmtDate(r.reviewDate || null)}
              </p>
            ))}
          </div>
        )}
      </section>

      <section className="glass-card rounded-xl p-5">
        <h4 className="text-sm font-semibold text-foreground mb-2">Rollback criteria</h4>
        <p className="text-sm text-text-muted whitespace-pre-wrap">{change.rollback_criteria || "Not recorded."}</p>
      </section>
    </div>
  );
}
