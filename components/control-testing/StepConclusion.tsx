"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { PriorityBadge, RatingBadge } from "@/components/controls/ControlBits";
import PDFExportButton from "@/components/shared/PDFExportButton";
import { getControlBySlug } from "@/data/controls";
import { scoreTestEffectiveness, nextTestDueFrom } from "@/data/scoring/test-effectiveness";
import {
  CONTROL_TEST_METHOD_LABEL,
  CONTROL_TEST_RESULT_LABEL,
  CONTROL_TEST_STATUS_LABEL,
  FINDING_SEVERITY_LABEL,
  type ActionDTO,
  type ControlTestDTO,
  type ControlTestFindingDTO,
  type EvidenceDTO,
  type PersonDTO,
  type TestExportPayload,
  type WorkspaceControlDTO,
} from "./types";

interface StepConclusionProps {
  test: ControlTestDTO;
  control: WorkspaceControlDTO;
  findings: ControlTestFindingDTO[];
  evidence: EvidenceDTO[];
  actions: ActionDTO[];
  people: PersonDTO[];
  onSaveConclusion: (text: string) => Promise<void>;
  onComplete: () => Promise<{ ok: true } | { ok: false; message: string }>;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "Not set";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Step 5: conclusion, the Complete action (with a clear consequence statement), and - once complete - the read-only applied rating/version/dates plus the on-screen report and PDF export. */
export default function StepConclusion({
  test,
  control,
  findings,
  evidence,
  actions,
  people,
  onSaveConclusion,
  onComplete,
}: StepConclusionProps) {
  const [conclusion, setConclusion] = useState(test.conclusion ?? "");
  const [savingConclusion, setSavingConclusion] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const isComplete = test.status === "complete";
  const isCancelled = test.status === "cancelled";
  const readOnly = isComplete || isCancelled;

  const preview = useMemo(
    () =>
      scoreTestEffectiveness({
        sampleSize: test.sample_size,
        samplesPassed: test.samples_passed,
        samplesFailed: test.samples_failed,
        samplesPartial: test.samples_partial,
        findings: findings.map((f) => ({ severity: f.severity })),
      }),
    [test.sample_size, test.samples_passed, test.samples_failed, test.samples_partial, findings]
  );

  const libraryControl = useMemo(
    () => (control.control_slug ? getControlBySlug(control.control_slug) : undefined),
    [control.control_slug]
  );

  const projectedNextDue = useMemo(() => {
    if (isComplete) return test.next_test_due;
    return nextTestDueFrom(new Date(), libraryControl?.reviewCadence).toISOString().slice(0, 10);
  }, [isComplete, test.next_test_due, libraryControl?.reviewCadence]);

  const saveConclusion = async () => {
    setSavingConclusion(true);
    try {
      await onSaveConclusion(conclusion);
    } finally {
      setSavingConclusion(false);
    }
  };

  const doComplete = async () => {
    setCompleting(true);
    setCompleteError(null);
    try {
      const result = await onComplete();
      if (!result.ok) setCompleteError(result.message);
    } finally {
      setCompleting(false);
    }
  };

  const exportPayload: TestExportPayload = useMemo(
    () => ({
      testTitle: test.title,
      controlName: control.name,
      controlSlug: control.control_slug,
      status: test.status,
      method: test.method,
      periodStart: test.period_start,
      periodEnd: test.period_end,
      testerName: test.tester_person_id ? personById.get(test.tester_person_id)?.name ?? null : null,
      sampleSize: test.sample_size,
      samplesPassed: test.samples_passed,
      samplesFailed: test.samples_failed,
      samplesPartial: test.samples_partial,
      passRatePct: preview.result === null && !isComplete ? null : Math.round(preview.passRate * 100),
      derivedResult: preview.result,
      appliedRating: test.applied_rating,
      appliedVersion: test.applied_version,
      testedAt: test.tested_at,
      nextTestDue: test.next_test_due,
      conclusion: test.conclusion,
      findings: findings.map((f) => ({
        description: f.description,
        severity: f.severity,
        sampleRef: f.sample_ref,
        hasAction: Boolean(f.action_id),
      })),
      actions: actions.map((a) => ({
        title: a.title,
        ownerName: a.owner_person_id ? personById.get(a.owner_person_id)?.name ?? null : null,
        dueDate: a.due_date,
        priority: a.priority,
        status: a.status,
      })),
      evidence: evidence.map((e) => ({ title: e.title, type: e.type, description: e.description, linkUrl: e.link_url })),
    }),
    [test, control, findings, actions, evidence, personById, preview]
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Conclusion</h2>
        <p className="text-sm text-text-muted">
          Summarise the outcome, then complete the test to write the derived result onto the record.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-soft">Conclusion</label>
        <textarea
          value={conclusion}
          onChange={(e) => setConclusion(e.target.value)}
          rows={4}
          disabled={readOnly}
          placeholder="What did this test find, and what does it mean for the control's effectiveness?"
          className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors disabled:opacity-60"
        />
        {!readOnly && (
          <div>
            <Button size="sm" variant="secondary" onClick={saveConclusion} disabled={savingConclusion}>
              {savingConclusion ? "Saving..." : "Save conclusion"}
            </Button>
          </div>
        )}
      </div>

      {!isComplete && !isCancelled && (
        <div className="glass-card rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Ready to complete</p>
              <p className="text-xs text-text-muted mt-0.5">
                This will write <span className="text-foreground font-medium">{preview.result ? CONTROL_TEST_RESULT_LABEL[preview.result] : "not assessed"}</span>{" "}
                and rating <span className="text-foreground font-medium capitalize">{preview.rating.replace("_", " ")}</span> onto{" "}
                <span className="text-foreground font-medium">{control.name}</span>, bumping it to version{" "}
                {control.version + 1}, and sets the next test due date to{" "}
                <span className="text-foreground font-medium">{fmtDate(projectedNextDue)}</span> from its review
                cadence.
              </p>
            </div>
            <Badge>{CONTROL_TEST_STATUS_LABEL[test.status]}</Badge>
          </div>

          {completeError && (
            <div className="flex items-start gap-2 text-sm text-red-500">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {completeError}
            </div>
          )}

          <Button onClick={doComplete} disabled={completing}>
            {completing ? "Completing..." : "Complete test"}
          </Button>
        </div>
      )}

      {isComplete && (
        <div className="glass-card rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Test complete</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <p className="text-text-muted">
              Result: <span className="text-foreground font-medium">{test.result ? CONTROL_TEST_RESULT_LABEL[test.result] : "-"}</span>
            </p>
            <p className="text-text-muted flex items-center gap-2">
              Applied rating: <RatingBadge rating={test.applied_rating ?? "not_assessed"} />
            </p>
            <p className="text-text-muted">
              Applied as control version: <span className="text-foreground font-medium">{test.applied_version}</span>
            </p>
            <p className="text-text-muted">
              Tested: <span className="text-foreground font-medium">{fmtDate(test.tested_at)}</span>
            </p>
            <p className="text-text-muted">
              Next test due: <span className="text-foreground font-medium">{fmtDate(test.next_test_due)}</span>
            </p>
          </div>
        </div>
      )}

      {/* Test report */}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-4 border-t border-white/10">
        <h3 className="text-lg font-semibold text-foreground">Test report</h3>
        <PDFExportButton module="control_test" assessmentData={{ ...exportPayload }} />
      </div>

      <section className="glass-card rounded-xl p-5">
        <h4 className="text-sm font-semibold text-foreground mb-3">Summary</h4>
        <div className="grid sm:grid-cols-2 gap-2 text-sm text-text-muted">
          <p>Control: <span className="text-foreground">{control.name}</span></p>
          <p>Method: <span className="text-foreground">{test.method ? CONTROL_TEST_METHOD_LABEL[test.method] : "Not specified"}</span></p>
          <p>Period: <span className="text-foreground">{fmtDate(test.period_start)} to {fmtDate(test.period_end)}</span></p>
          <p>Tester: <span className="text-foreground">{exportPayload.testerName ?? "Unassigned"}</span></p>
          <p>Sample size: <span className="text-foreground">{test.sample_size ?? "-"}</span></p>
          <p>Pass / fail / partial: <span className="text-foreground">{test.samples_passed ?? 0} / {test.samples_failed ?? 0} / {test.samples_partial ?? 0}</span></p>
        </div>
        {test.conclusion && <p className="text-sm text-foreground mt-3 pt-3 border-t border-white/10">{test.conclusion}</p>}
      </section>

      <section className="glass-card rounded-xl p-5">
        <h4 className="text-sm font-semibold text-foreground mb-2">Findings ({findings.length})</h4>
        {findings.length === 0 ? (
          <p className="text-sm text-text-muted">No findings recorded.</p>
        ) : (
          <div className="space-y-1.5">
            {findings.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-2 text-xs text-text-muted py-1.5 border-b border-white/5 last:border-0">
                <span className="text-foreground">{f.description}</span>
                <Badge variant={f.severity === "high" ? "danger" : f.severity === "medium" ? "warning" : "default"}>
                  {FINDING_SEVERITY_LABEL[f.severity]}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass-card rounded-xl p-5">
        <h4 className="text-sm font-semibold text-foreground mb-2">Linked actions ({actions.length})</h4>
        {actions.length === 0 ? (
          <p className="text-sm text-text-muted">No follow-up actions recorded.</p>
        ) : (
          <div className="space-y-1.5">
            {actions.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs text-text-muted">
                <span className="text-foreground">{a.title}</span>
                <span>({fmtDate(a.due_date)})</span>
                <PriorityBadge priority={a.priority} />
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
