"use client";

import { useMemo } from "react";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import { RatingBadge } from "@/components/controls/ControlBits";
import { CONTROL_CHANGE_TYPE_LABEL, type ControlChangeDTO, type ControlChangeType, type PersonDTO, type WorkspaceControlDTO } from "./types";

const CHANGE_TYPES = Object.keys(CONTROL_CHANGE_TYPE_LABEL) as ControlChangeType[];

interface StepControlProps {
  change: ControlChangeDTO;
  control: WorkspaceControlDTO;
  people: PersonDTO[];
  onSave: (fields: { title?: string; rationale?: string | null; changeType?: string | null }) => Promise<void>;
}

/** Step 1: a read-only summary of the "current version" the baseline was snapshotted from, plus the change's editable title/rationale/type. */
export default function StepControl({ change, control, people, onSave }: StepControlProps) {
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const owner = control.owner_person_id ? personById.get(control.owner_person_id) : undefined;
  const approver = control.approver_person_id ? personById.get(control.approver_person_id) : undefined;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">The control</h2>
        <p className="text-sm text-text-muted">
          This change targets a live control in your workspace. Its current values, snapshotted below, are the
          &quot;before&quot; side of every comparison in this journey (the baseline).
        </p>
      </div>

      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-semibold text-foreground">{control.name}</h3>
            <p className="text-sm text-text-muted mt-1">{control.objective}</p>
          </div>
          <Badge>Current version: v{control.version}</Badge>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 text-sm pt-2 border-t border-white/10">
          <Field label="Threshold" value={control.threshold || "Not set"} />
          <Field label="Operating frequency" value={control.operating_frequency || "Not set"} />
          <Field label="Owner" value={owner?.name ?? "Unassigned"} />
          <Field label="Approver" value={approver?.name ?? "Unassigned"} />
          <Field label="Status" value={control.status.replace(/_/g, " ")} />
          <div>
            <p className="text-[11px] uppercase tracking-wider text-text-muted mb-1">Effectiveness</p>
            <RatingBadge rating={control.effectiveness_rating ?? "not_assessed"} />
          </div>
          <Field label="Systems" value={control.systems.join(", ") || "None recorded"} />
          <Field label="Data inputs" value={control.data_inputs.join(", ") || "None recorded"} />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">This change</h3>
        <Input
          key={change.id}
          label="Title"
          defaultValue={change.title}
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== change.title) void onSave({ title: e.target.value.trim() });
          }}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink-soft">Change type</label>
          <select
            key={change.id}
            defaultValue={change.change_type ?? ""}
            onChange={(e) => void onSave({ changeType: e.target.value || null })}
            className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
          >
            <option value="">Not specified</option>
            {CHANGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONTROL_CHANGE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink-soft">Rationale</label>
          {/* Keyed on change.id only: keying on updated_at (or any server-echoed
              field) remounts this textarea after every save while the user is
              still typing, discarding whatever they haven't blurred away from
              yet. See components/pra/StepInherentRisks.tsx for the same note. */}
          <textarea
            key={change.id}
            defaultValue={change.rationale ?? ""}
            onBlur={(e) => {
              if (e.target.value !== (change.rationale ?? "")) void onSave({ rationale: e.target.value || null });
            }}
            rows={3}
            placeholder="Why is this change needed?"
            className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
          />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-text-muted mb-1">{label}</p>
      <p className="text-foreground capitalize">{value}</p>
    </div>
  );
}
