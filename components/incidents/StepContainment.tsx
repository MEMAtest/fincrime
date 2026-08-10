"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import Input from "@/components/ui/Input";
import type { IncidentDTO } from "./types";

export interface ContainmentFields {
  containment: string | null;
  containedAt: string | null;
}

interface StepContainmentProps {
  incident: IncidentDTO;
  readOnly: boolean;
  onSave: (fields: Partial<ContainmentFields>) => Promise<{ ok: true } | { ok: false; message: string }>;
}

function toDateInput(v: string | null): string {
  if (!v) return "";
  return v.slice(0, 10);
}

/** Step 2: containment - what was done to stop the bleeding, and when, distinct from root cause which comes later. */
export default function StepContainment({ incident, readOnly, onSave }: StepContainmentProps) {
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function commit(fields: Partial<ContainmentFields>) {
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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Containment</h2>
        <p className="text-sm text-text-muted">
          Record what was done to stop the incident getting worse, and when.
        </p>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/5 border border-accent/20 text-sm text-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-accent" />
        <span>
          Containment is stopping the bleeding: suspending an affected process, blocking a route, freezing an
          account. It is not the same as root cause - that comes later, once the immediate exposure is under
          control.
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-soft">Containment narrative</label>
        <textarea
          key={`${incident.id}-containment`}
          defaultValue={incident.containment ?? ""}
          disabled={readOnly}
          rows={5}
          placeholder="What was done to stop this getting worse?"
          onBlur={(e) => {
            const v = e.target.value.trim() || null;
            if (v !== incident.containment) void commit({ containment: v });
          }}
          className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors disabled:opacity-60"
        />
      </div>

      <Input
        key={`${incident.id}-containedAt`}
        type="date"
        label="Contained on (optional)"
        defaultValue={toDateInput(incident.contained_at)}
        disabled={readOnly}
        onBlur={(e) => {
          const v = e.target.value || null;
          if (v !== toDateInput(incident.contained_at) || (v === "" && incident.contained_at)) {
            void commit({ containedAt: v });
          }
        }}
      />

      {saving && <p className="text-xs text-text-muted">Saving...</p>}
      {fieldError && <p className="text-xs text-red-500">{fieldError}</p>}
    </div>
  );
}
