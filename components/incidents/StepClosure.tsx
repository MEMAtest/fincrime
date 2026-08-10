"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, RotateCcw } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { PriorityBadge } from "@/components/controls/ControlBits";
import PDFExportButton from "@/components/shared/PDFExportButton";
import {
  INCIDENT_LINK_TYPE_LABEL,
  INCIDENT_SEVERITY_LABEL,
  INCIDENT_SOURCE_LABEL,
  INCIDENT_STATUS_LABEL,
  ROOT_CAUSE_CATEGORY_LABEL,
  type ActionDTO,
  type EvidenceDTO,
  type IncidentDTO,
  type IncidentExportPayload,
  type PersonDTO,
  type ResolvedIncidentLinkDTO,
} from "./types";

export interface ClosureFields {
  closureSummary: string | null;
  reportable: boolean;
  reportedAt: string | null;
  regulatorReference: string | null;
}

export type CloseOutcome =
  | { ok: true }
  | { ok: false; reason: "open_actions" | "no_root_cause" | "already_final" | "other"; message: string };

interface StepClosureProps {
  incident: IncidentDTO;
  links: ResolvedIncidentLinkDTO[];
  actions: ActionDTO[];
  evidence: EvidenceDTO[];
  people: PersonDTO[];
  onSave: (fields: Partial<ClosureFields>) => Promise<{ ok: true } | { ok: false; message: string }>;
  onClose: () => Promise<CloseOutcome>;
  onReopen: () => Promise<{ ok: true } | { ok: false; message: string }>;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "Not set";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function toDateInput(v: string | null): string {
  if (!v) return "";
  return v.slice(0, 10);
}

/** Step 7: closure - summary, reportable flag, a readiness checklist so the 409 close guard is never a surprise, then Close. Once closed, everything is read-only with a Reopen action, the on-screen report and PDF export. */
export default function StepClosure({ incident, links, actions, evidence, people, onSave, onClose, onReopen }: StepClosureProps) {
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);
  const [reopenError, setReopenError] = useState<string | null>(null);

  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const isClosed = incident.status === "closed";
  const isCancelled = incident.status === "cancelled";
  const readOnly = isClosed || isCancelled;

  const openActions = actions.filter((a) => a.status !== "done" && a.status !== "cancelled");
  const hasRootCause = Boolean(incident.root_cause && incident.root_cause.trim());
  const canClose = hasRootCause && openActions.length === 0;

  async function commit(fields: Partial<ClosureFields>) {
    if (readOnly) return;
    setSaving(true);
    setFieldError(null);
    try {
      const result = await onSave(fields);
      if (!result.ok) setFieldError(result.message);
    } finally {
      setSaving(false);
    }
  }

  async function doClose() {
    setClosing(true);
    setCloseError(null);
    try {
      const result = await onClose();
      if (!result.ok) setCloseError(result.message);
    } finally {
      setClosing(false);
    }
  }

  async function doReopen() {
    setReopening(true);
    setReopenError(null);
    try {
      const result = await onReopen();
      if (!result.ok) setReopenError(result.message);
    } finally {
      setReopening(false);
    }
  }

  const exportPayload: IncidentExportPayload = useMemo(
    () => ({
      reference: incident.reference,
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      source: incident.source,
      ownerName: incident.owner_person_id ? personById.get(incident.owner_person_id)?.name ?? null : null,
      occurredAt: incident.occurred_at,
      detectedAt: incident.detected_at,
      containedAt: incident.contained_at,
      closedAt: incident.closed_at,
      summary: incident.summary,
      containment: incident.containment,
      affectedPopulation: {
        customersAffected: incident.affected_population.customersAffected ?? null,
        transactionsAffected: incident.affected_population.transactionsAffected ?? null,
        valueGbp: incident.affected_population.valueGbp ?? null,
        identificationMethod: incident.affected_population.identificationMethod ?? null,
        notes: incident.affected_population.notes ?? null,
      },
      rootCause: incident.root_cause,
      rootCauseCategory: incident.root_cause_category,
      links: links.map((l) => ({
        linkType: l.link.link_type,
        label: l.label ?? "Target no longer available",
        note: l.link.note,
      })),
      actions: actions.map((a) => ({
        title: a.title,
        ownerName: a.owner_person_id ? personById.get(a.owner_person_id)?.name ?? null : null,
        dueDate: a.due_date,
        priority: a.priority,
        status: a.status,
      })),
      evidence: evidence.map((e) => ({ title: e.title, type: e.type, description: e.description, linkUrl: e.link_url })),
      closureSummary: incident.closure_summary,
      reportable: incident.reportable,
      reportedAt: incident.reported_at,
      regulatorReference: incident.regulator_reference,
    }),
    [incident, links, actions, evidence, personById]
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Closure</h2>
        <p className="text-sm text-text-muted">
          Summarise the outcome, record whether this was reportable, then close the incident once it is ready.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-soft">Closure summary</label>
        <textarea
          key={`${incident.id}-closureSummary`}
          defaultValue={incident.closure_summary ?? ""}
          disabled={readOnly}
          rows={4}
          placeholder="What was the final outcome, and what changed as a result?"
          onBlur={(e) => {
            const v = e.target.value.trim() || null;
            if (v !== incident.closure_summary) void commit({ closureSummary: v });
          }}
          className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors disabled:opacity-60"
        />
      </div>

      <div className="glass-card rounded-xl p-4 space-y-3">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={incident.reportable}
            disabled={readOnly}
            onChange={(e) => void commit({ reportable: e.target.checked })}
            className="h-4 w-4 rounded border-line-2 text-accent focus:ring-accent/30"
          />
          <span className="text-sm font-medium text-foreground">This incident is reportable to a regulator</span>
        </label>
        {incident.reportable && (
          <div className="grid sm:grid-cols-2 gap-3 pt-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-soft">Reported on</label>
              <input
                key={`${incident.id}-reportedAt`}
                type="date"
                defaultValue={toDateInput(incident.reported_at)}
                disabled={readOnly}
                onBlur={(e) => {
                  const v = e.target.value || null;
                  if (v !== toDateInput(incident.reported_at) || (v === "" && incident.reported_at)) {
                    void commit({ reportedAt: v });
                  }
                }}
                className="px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-60"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-soft">Regulator reference</label>
              <input
                key={`${incident.id}-regulatorReference`}
                defaultValue={incident.regulator_reference ?? ""}
                disabled={readOnly}
                onBlur={(e) => {
                  const v = e.target.value.trim() || null;
                  if (v !== incident.regulator_reference) void commit({ regulatorReference: v });
                }}
                className="px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-60"
              />
            </div>
          </div>
        )}
      </div>

      {saving && <p className="text-xs text-text-muted">Saving...</p>}
      {fieldError && <p className="text-xs text-red-500">{fieldError}</p>}

      {!readOnly && (
        <div className="glass-card rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-foreground">Readiness to close</p>
          <div className="space-y-2 text-sm">
            <ChecklistRow ok={hasRootCause} label="A root cause has been recorded" />
            <ChecklistRow
              ok={openActions.length === 0}
              label={
                openActions.length === 0
                  ? "All remediation actions are done or cancelled"
                  : `${openActions.length} remediation action${openActions.length === 1 ? " is" : "s are"} still open`
              }
            />
          </div>

          {closeError && (
            <div className="flex items-start gap-2 text-sm text-red-500">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {closeError}
            </div>
          )}

          <Button onClick={doClose} disabled={closing || !canClose}>
            {closing ? "Closing..." : "Close incident"}
          </Button>
          {!canClose && <p className="text-xs text-text-muted">Resolve the items above before closing.</p>}
        </div>
      )}

      {isClosed && (
        <div className="glass-card rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-semibold text-foreground">Incident closed</h3>
            </div>
            <Button size="sm" variant="secondary" onClick={doReopen} disabled={reopening}>
              <RotateCcw className="h-3.5 w-3.5" /> {reopening ? "Reopening..." : "Reopen"}
            </Button>
          </div>
          <p className="text-sm text-text-muted">Closed on {fmtDate(incident.closed_at)}</p>
          {reopenError && <p className="text-xs text-red-500">{reopenError}</p>}
        </div>
      )}

      {/* Incident report */}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-4 border-t border-white/10">
        <h3 className="text-lg font-semibold text-foreground">Incident report</h3>
        <PDFExportButton module="incident" assessmentData={{ ...exportPayload }} />
      </div>

      <section className="glass-card rounded-xl p-5">
        <h4 className="text-sm font-semibold text-foreground mb-3">Summary</h4>
        <div className="grid sm:grid-cols-2 gap-2 text-sm text-text-muted">
          <p>Reference: <span className="text-foreground">{incident.reference ?? "Not set"}</span></p>
          <p>Status: <span className="text-foreground">{INCIDENT_STATUS_LABEL[incident.status]}</span></p>
          <p>Severity: <span className="text-foreground">{INCIDENT_SEVERITY_LABEL[incident.severity]}</span></p>
          <p>Source: <span className="text-foreground">{incident.source ? INCIDENT_SOURCE_LABEL[incident.source] : "Not specified"}</span></p>
          <p>Occurred: <span className="text-foreground">{fmtDate(incident.occurred_at)}</span></p>
          <p>Detected: <span className="text-foreground">{fmtDate(incident.detected_at)}</span></p>
        </div>
        {incident.summary && <p className="text-sm text-foreground mt-3 pt-3 border-t border-white/10">{incident.summary}</p>}
      </section>

      <section className="glass-card rounded-xl p-5">
        <h4 className="text-sm font-semibold text-foreground mb-2">Root cause</h4>
        <p className="text-sm text-text-muted">
          {incident.root_cause_category ? ROOT_CAUSE_CATEGORY_LABEL[incident.root_cause_category] : "Not categorised"}
        </p>
        <p className="text-sm text-foreground mt-1">{incident.root_cause ?? "Not recorded."}</p>
      </section>

      <section className="glass-card rounded-xl p-5">
        <h4 className="text-sm font-semibold text-foreground mb-2">Traceability links ({links.length})</h4>
        {links.length === 0 ? (
          <p className="text-sm text-text-muted">No links recorded.</p>
        ) : (
          <div className="space-y-1.5">
            {links.map((l) => (
              <div key={l.link.id} className="flex items-center gap-2 text-xs text-text-muted py-1.5 border-b border-white/5 last:border-0">
                <Badge>{INCIDENT_LINK_TYPE_LABEL[l.link.link_type]}</Badge>
                <span className="text-foreground">{l.label ?? "Target no longer available"}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass-card rounded-xl p-5">
        <h4 className="text-sm font-semibold text-foreground mb-2">Remediation actions ({actions.length})</h4>
        {actions.length === 0 ? (
          <p className="text-sm text-text-muted">No remediation actions recorded.</p>
        ) : (
          <div className="space-y-1.5">
            {actions.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs text-text-muted">
                <span className="text-foreground">{a.title}</span>
                <span>({fmtDate(a.due_date)})</span>
                <PriorityBadge priority={a.priority} />
                <Badge variant={a.status === "done" ? "success" : "warning"}>{a.status.replace(/_/g, " ")}</Badge>
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
