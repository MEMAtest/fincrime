"use client";

import { useState } from "react";
import Input from "@/components/ui/Input";
import type { AffectedPopulation, IncidentDTO } from "./types";

interface StepPopulationProps {
  incident: IncidentDTO;
  readOnly: boolean;
  /** affectedPopulation PATCHes replace the whole object server-side (see lib/repo/incidents.ts's updateIncident), so every save sends the full merged shape. */
  onSave: (affectedPopulation: AffectedPopulation) => Promise<{ ok: true } | { ok: false; message: string }>;
}

/** Non-negative float, or undefined while the field is empty. Clamped at the input boundary so the stored, displayed and any derived totals never disagree. */
function clampToNonNegative(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/** Non-negative integer, or undefined while the field is empty. customersAffected/transactionsAffected are counts, so a fractional value (e.g. "1.5") is rounded rather than stored as-is. */
function clampToNonNegativeInt(raw: string): number | undefined {
  const n = clampToNonNegative(raw);
  return n === undefined ? undefined : Math.round(n);
}

type NumericField = "customersAffected" | "transactionsAffected" | "valueGbp";

const INTEGER_FIELDS: readonly NumericField[] = ["customersAffected", "transactionsAffected"];

/** Step 3: the affected population - how many customers/transactions, the value involved, how it was identified, and any notes. */
export default function StepPopulation({ incident, readOnly, onSave }: StepPopulationProps) {
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pop = incident.affected_population ?? {};

  async function commit(patch: Partial<AffectedPopulation>) {
    if (readOnly) return;
    const merged: AffectedPopulation = { ...pop, ...patch };
    // Drop undefined keys explicitly rather than sending them, so clearing a
    // field actually clears it server-side instead of being dropped by
    // JSON.stringify and silently keeping the old value.
    for (const key of Object.keys(merged) as (keyof AffectedPopulation)[]) {
      if (merged[key] === undefined) delete merged[key];
    }
    setSaving(true);
    setFieldError(null);
    try {
      const result = await onSave(merged);
      if (!result.ok) setFieldError(result.message);
    } finally {
      setSaving(false);
    }
  }

  function commitNumeric(field: NumericField, raw: string) {
    const value = INTEGER_FIELDS.includes(field) ? clampToNonNegativeInt(raw) : clampToNonNegative(raw);
    if (value === pop[field]) return;
    void commit({ [field]: value } as Partial<AffectedPopulation>);
  }

  const totalExposure =
    typeof pop.customersAffected === "number" && typeof pop.valueGbp === "number"
      ? `${pop.customersAffected.toLocaleString("en-GB")} customers, £${pop.valueGbp.toLocaleString("en-GB")}`
      : null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Affected population</h2>
        <p className="text-sm text-text-muted">
          Scope the exposure: how many customers and transactions were affected, and what value was involved. Each
          field saves automatically when you move to the next one.
        </p>
      </div>

      <section className="glass-card rounded-xl p-5 space-y-4">
        <div className="grid sm:grid-cols-3 gap-4">
          {/* Each key includes the committed value, not just the field name: these are
              uncontrolled inputs (defaultValue only sets the initial render), so if a
              clamped/rounded value differs from what the user typed (e.g. "-5" -> 0), the
              input needs to remount to pick up the new defaultValue - otherwise it keeps
              showing "-5" while 0 is what actually got saved. */}
          <Input
            key={`${incident.id}-customersAffected-${pop.customersAffected ?? "empty"}`}
            type="number"
            label="Customers affected"
            min={0}
            step={1}
            defaultValue={pop.customersAffected ?? ""}
            disabled={readOnly}
            onBlur={(e) => commitNumeric("customersAffected", e.target.value)}
          />
          <Input
            key={`${incident.id}-transactionsAffected-${pop.transactionsAffected ?? "empty"}`}
            type="number"
            label="Transactions affected"
            min={0}
            step={1}
            defaultValue={pop.transactionsAffected ?? ""}
            disabled={readOnly}
            onBlur={(e) => commitNumeric("transactionsAffected", e.target.value)}
          />
          <Input
            key={`${incident.id}-valueGbp-${pop.valueGbp ?? "empty"}`}
            type="number"
            label="Value (GBP)"
            min={0}
            defaultValue={pop.valueGbp ?? ""}
            disabled={readOnly}
            onBlur={(e) => commitNumeric("valueGbp", e.target.value)}
          />
        </div>

        <Input
          key={`${incident.id}-identificationMethod`}
          label="How was the population identified? (optional)"
          defaultValue={pop.identificationMethod ?? ""}
          disabled={readOnly}
          placeholder="e.g. Query against the affected date range and product code"
          onBlur={(e) => {
            const v = e.target.value.trim() || undefined;
            if (v !== pop.identificationMethod) void commit({ identificationMethod: v });
          }}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink-soft">Notes (optional)</label>
          <textarea
            key={`${incident.id}-populationNotes`}
            defaultValue={pop.notes ?? ""}
            disabled={readOnly}
            rows={3}
            onBlur={(e) => {
              const v = e.target.value.trim() || undefined;
              if (v !== pop.notes) void commit({ notes: v });
            }}
            className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors disabled:opacity-60"
          />
        </div>

        {saving && <p className="text-xs text-text-muted">Saving...</p>}
        {fieldError && <p className="text-xs text-red-500">{fieldError}</p>}
      </section>

      {totalExposure && (
        <p className="text-xs text-text-muted">
          Recorded exposure: <span className="text-foreground font-medium">{totalExposure}</span>
        </p>
      )}
    </div>
  );
}
