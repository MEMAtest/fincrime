"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import Input from "@/components/ui/Input";
import {
  INCIDENT_SEVERITY_LABEL,
  INCIDENT_SOURCE_LABEL,
  type IncidentDTO,
  type IncidentSeverity,
  type IncidentSource,
  type PersonDTO,
  type PersonRole,
} from "./types";

const SOURCES = Object.keys(INCIDENT_SOURCE_LABEL) as IncidentSource[];
const SEVERITIES = Object.keys(INCIDENT_SEVERITY_LABEL) as IncidentSeverity[];
const PERSON_ROLES: PersonRole[] = ["owner", "reviewer", "approver"];

export interface IntakeFields {
  reference: string | null;
  title: string;
  source: IncidentSource | null;
  severity: IncidentSeverity;
  occurredAt: string | null;
  detectedAt: string | null;
  summary: string | null;
  ownerPersonId: string | null;
}

interface StepIntakeProps {
  incident: IncidentDTO;
  people: PersonDTO[];
  readOnly: boolean;
  onSave: (fields: Partial<IntakeFields>) => Promise<{ ok: true } | { ok: false; message: string }>;
  onCreatePerson: (input: { name: string; role: PersonRole; email?: string }) => Promise<PersonDTO | null>;
}

/** Converts an ISO timestamp or date to the value a `type="date"` input needs. */
function toDateInput(v: string | null): string {
  if (!v) return "";
  return v.slice(0, 10);
}

/** Step 1: the record's identity - reference, title, source, severity, when it occurred vs was detected, a plain-language summary, and the owner. */
export default function StepIntake({ incident, people, readOnly, onSave, onCreatePerson }: StepIntakeProps) {
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddRole, setQuickAddRole] = useState<PersonRole>("owner");
  const [quickAddBusy, setQuickAddBusy] = useState(false);

  async function commit(fields: Partial<IntakeFields>) {
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

  const submitQuickAdd = async () => {
    const name = quickAddName.trim();
    if (!name) return;
    setQuickAddBusy(true);
    try {
      const person = await onCreatePerson({ name, role: quickAddRole });
      if (person) {
        void commit({ ownerPersonId: person.id });
        setQuickAddName("");
        setQuickAddOpen(false);
      }
    } finally {
      setQuickAddBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Intake</h2>
        <p className="text-sm text-text-muted">
          Record what happened, how it was found, and how serious it is. Each field saves automatically when you
          move to the next one.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Input
          key={`${incident.id}-reference`}
          label="Reference (optional)"
          defaultValue={incident.reference ?? ""}
          placeholder="e.g. INC-2026-014"
          disabled={readOnly}
          onBlur={(e) => {
            const v = e.target.value.trim() || null;
            if (v !== incident.reference) void commit({ reference: v });
          }}
        />
        <Input
          key={`${incident.id}-title`}
          label="Title"
          defaultValue={incident.title}
          disabled={readOnly}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== incident.title) void commit({ title: v });
          }}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink-soft">Source</label>
          <select
            key={`${incident.id}-source`}
            defaultValue={incident.source ?? ""}
            disabled={readOnly}
            onChange={(e) => void commit({ source: (e.target.value || null) as IncidentSource | null })}
            className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors disabled:opacity-60"
          >
            <option value="">Not specified</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {INCIDENT_SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink-soft">Severity</label>
          <select
            key={`${incident.id}-severity`}
            defaultValue={incident.severity}
            disabled={readOnly}
            onChange={(e) => void commit({ severity: e.target.value as IncidentSeverity })}
            className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors disabled:opacity-60"
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {INCIDENT_SEVERITY_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Input
          key={`${incident.id}-occurredAt`}
          type="date"
          label="Occurred (optional)"
          defaultValue={toDateInput(incident.occurred_at)}
          disabled={readOnly}
          onBlur={(e) => {
            const v = e.target.value || null;
            if (v !== toDateInput(incident.occurred_at) || (v === "" && incident.occurred_at)) {
              void commit({ occurredAt: v });
            }
          }}
        />
        <Input
          key={`${incident.id}-detectedAt`}
          type="date"
          label="Detected (optional)"
          defaultValue={toDateInput(incident.detected_at)}
          disabled={readOnly}
          onBlur={(e) => {
            const v = e.target.value || null;
            if (v !== toDateInput(incident.detected_at) || (v === "" && incident.detected_at)) {
              void commit({ detectedAt: v });
            }
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-soft">Summary</label>
        <textarea
          key={`${incident.id}-summary`}
          defaultValue={incident.summary ?? ""}
          disabled={readOnly}
          rows={4}
          placeholder="What happened, in plain English?"
          onBlur={(e) => {
            const v = e.target.value.trim() || null;
            if (v !== incident.summary) void commit({ summary: v });
          }}
          className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors disabled:opacity-60"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-ink-soft">Owner (optional)</label>
        <div className="flex items-center gap-2 mt-1.5">
          <select
            key={`${incident.id}-owner`}
            defaultValue={incident.owner_person_id ?? ""}
            disabled={readOnly}
            onChange={(e) => void commit({ ownerPersonId: e.target.value || null })}
            className="flex-1 px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-60"
          >
            <option value="">Unassigned</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.role})
              </option>
            ))}
          </select>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setQuickAddOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line-2 text-xs text-foreground hover:border-accent/40 cursor-pointer shrink-0"
            >
              <UserPlus className="h-3.5 w-3.5" /> New
            </button>
          )}
        </div>
        {quickAddOpen && !readOnly && (
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

      {saving && <p className="text-xs text-text-muted">Saving...</p>}
      {fieldError && <p className="text-xs text-red-500">{fieldError}</p>}
    </div>
  );
}
