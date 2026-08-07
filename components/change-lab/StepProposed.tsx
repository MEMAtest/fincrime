"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CircleDot } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { RATING_ORDER, RATING_META, STATUS_ORDER, STATUS_META } from "@/components/controls/ControlBits";
import type { ControlRating, ControlStatus } from "@/data/controls/types";
import type { ControlChangeDTO, ControlFieldValues, PersonDTO, WorkspaceControlDTO } from "./types";

interface StepProposedProps {
  change: ControlChangeDTO;
  control: WorkspaceControlDTO;
  people: PersonDTO[];
  onSave: (fields: ControlFieldValues) => Promise<void>;
}

/** A text list field edited as a comma-separated string, parsed back to a string[] on save. */
function listToText(list: string[] | undefined): string {
  return (list ?? []).join(", ");
}
function textToList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
function listEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/**
 * Draft shape mirrors ControlFieldValues but every value is always present
 * (defaulted from the current control) so every input is controlled. What
 * actually gets PATCHed is computed by diffing this draft against `current`
 * (the live control's values) at save time - never by tracking a JSONB key
 * list, since the API layer merges `proposed` additively and never deletes a
 * key (see lib/repo/control-changes.ts updateControlChange). Comparing
 * values rather than key presence is also what keeps the "changed" markers
 * and count correct even if a field was proposed then reverted in an earlier
 * save (its stale key may still be in the DB, but it now equals `current`,
 * so it renders and counts as unchanged).
 */
interface Draft {
  objective: string;
  threshold: string;
  operatingFrequency: string;
  status: ControlStatus;
  effectivenessRating: ControlRating;
  systems: string;
  dataInputs: string;
  productApplicability: string;
  typologySlugs: string;
  ownerPersonId: string;
  approverPersonId: string;
}

function draftFromSources(control: WorkspaceControlDTO, proposed: ControlFieldValues): Draft {
  return {
    objective: (proposed.objective as string | undefined) ?? control.objective,
    threshold: (proposed.threshold as string | null | undefined) ?? control.threshold ?? "",
    operatingFrequency: (proposed.operatingFrequency as string | null | undefined) ?? control.operating_frequency ?? "",
    status: ((proposed.status as ControlStatus | undefined) ?? control.status) as ControlStatus,
    effectivenessRating:
      ((proposed.effectivenessRating as ControlRating | null | undefined) ?? control.effectiveness_rating ?? "not_assessed") as ControlRating,
    systems: listToText((proposed.systems as string[] | undefined) ?? control.systems),
    dataInputs: listToText((proposed.dataInputs as string[] | undefined) ?? control.data_inputs),
    productApplicability: listToText((proposed.productApplicability as string[] | undefined) ?? control.product_applicability),
    typologySlugs: listToText((proposed.typologySlugs as string[] | undefined) ?? control.typology_slugs),
    ownerPersonId: (proposed.ownerPersonId as string | null | undefined) ?? control.owner_person_id ?? "",
    approverPersonId: (proposed.approverPersonId as string | null | undefined) ?? control.approver_person_id ?? "",
  };
}

/** Step 2: side-by-side current vs proposed for every whitelisted control field. Only edited fields are sent to the API. */
export default function StepProposed({ change, control, people, onSave }: StepProposedProps) {
  const [draft, setDraft] = useState<Draft>(() => draftFromSources(control, change.proposed));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const changedKeys = useMemo(() => {
    const keys = new Set<string>();
    if (draft.objective !== control.objective) keys.add("objective");
    if (draft.threshold !== (control.threshold ?? "")) keys.add("threshold");
    if (draft.operatingFrequency !== (control.operating_frequency ?? "")) keys.add("operatingFrequency");
    if (draft.status !== control.status) keys.add("status");
    if (draft.effectivenessRating !== (control.effectiveness_rating ?? "not_assessed")) keys.add("effectivenessRating");
    if (!listEqual(textToList(draft.systems), control.systems)) keys.add("systems");
    if (!listEqual(textToList(draft.dataInputs), control.data_inputs)) keys.add("dataInputs");
    if (!listEqual(textToList(draft.productApplicability), control.product_applicability)) keys.add("productApplicability");
    if (!listEqual(textToList(draft.typologySlugs), control.typology_slugs)) keys.add("typologySlugs");
    if (draft.ownerPersonId !== (control.owner_person_id ?? "")) keys.add("ownerPersonId");
    if (draft.approverPersonId !== (control.approver_person_id ?? "")) keys.add("approverPersonId");
    return keys;
  }, [draft, control]);

  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const personLabel = (id: string) => (id ? personById.get(id)?.name ?? "Unknown person" : "Unassigned");

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    setSavedAt(null);
    try {
      // Build the PATCH body from ONLY the changed keys - an unedited field
      // must never appear here, so it can never overwrite a previously saved
      // proposed value for that field with the current control's value.
      const fields: ControlFieldValues = {};
      if (changedKeys.has("objective")) fields.objective = draft.objective;
      if (changedKeys.has("threshold")) fields.threshold = draft.threshold || null;
      if (changedKeys.has("operatingFrequency")) fields.operatingFrequency = draft.operatingFrequency || null;
      if (changedKeys.has("status")) fields.status = draft.status;
      if (changedKeys.has("effectivenessRating")) fields.effectivenessRating = draft.effectivenessRating;
      if (changedKeys.has("systems")) fields.systems = textToList(draft.systems);
      if (changedKeys.has("dataInputs")) fields.dataInputs = textToList(draft.dataInputs);
      if (changedKeys.has("productApplicability")) fields.productApplicability = textToList(draft.productApplicability);
      if (changedKeys.has("typologySlugs")) fields.typologySlugs = textToList(draft.typologySlugs);
      if (changedKeys.has("ownerPersonId")) fields.ownerPersonId = draft.ownerPersonId || null;
      if (changedKeys.has("approverPersonId")) fields.approverPersonId = draft.approverPersonId || null;

      if (Object.keys(fields).length === 0) return;
      await onSave(fields);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-1">Proposed change</h2>
          <p className="text-sm text-text-muted">
            Edit only the fields you want to change. Anything left alone stays exactly as it is on the live control.
          </p>
        </div>
        <Badge variant={changedKeys.size > 0 ? "warning" : "default"}>
          {changedKeys.size} field{changedKeys.size === 1 ? "" : "s"} changed
        </Badge>
      </div>

      <div className="space-y-3">
        <FieldRow label="Objective" changed={changedKeys.has("objective")} current={control.objective}>
          <textarea
            value={draft.objective}
            onChange={(e) => set("objective", e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </FieldRow>

        <FieldRow label="Threshold" changed={changedKeys.has("threshold")} current={control.threshold || "Not set"}>
          <input
            value={draft.threshold}
            onChange={(e) => set("threshold", e.target.value)}
            placeholder="e.g. >£10,000 in 24h"
            className="w-full px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </FieldRow>

        <FieldRow
          label="Operating frequency"
          changed={changedKeys.has("operatingFrequency")}
          current={control.operating_frequency || "Not set"}
        >
          <input
            value={draft.operatingFrequency}
            onChange={(e) => set("operatingFrequency", e.target.value)}
            placeholder="e.g. Real-time, Daily batch"
            className="w-full px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </FieldRow>

        <FieldRow label="Status" changed={changedKeys.has("status")} current={STATUS_META[control.status as ControlStatus]?.label ?? control.status}>
          <select
            value={draft.status}
            onChange={(e) => set("status", e.target.value as ControlStatus)}
            className="w-full px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
        </FieldRow>

        <FieldRow
          label="Effectiveness rating"
          changed={changedKeys.has("effectivenessRating")}
          current={RATING_META[control.effectiveness_rating ?? "not_assessed"].label}
        >
          <select
            value={draft.effectivenessRating}
            onChange={(e) => set("effectivenessRating", e.target.value as ControlRating)}
            className="w-full px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          >
            {RATING_ORDER.slice().reverse().map((r) => (
              <option key={r} value={r}>
                {RATING_META[r].label}
              </option>
            ))}
          </select>
        </FieldRow>

        <FieldRow label="Systems" changed={changedKeys.has("systems")} current={control.systems.join(", ") || "None"}>
          <input
            value={draft.systems}
            onChange={(e) => set("systems", e.target.value)}
            placeholder="Comma-separated, e.g. Actimize, Salesforce"
            className="w-full px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </FieldRow>

        <FieldRow label="Data inputs" changed={changedKeys.has("dataInputs")} current={control.data_inputs.join(", ") || "None"}>
          <input
            value={draft.dataInputs}
            onChange={(e) => set("dataInputs", e.target.value)}
            placeholder="Comma-separated, e.g. Transaction data, KYC data"
            className="w-full px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </FieldRow>

        <FieldRow
          label="Product applicability"
          changed={changedKeys.has("productApplicability")}
          current={control.product_applicability.join(", ") || "None"}
        >
          <input
            value={draft.productApplicability}
            onChange={(e) => set("productApplicability", e.target.value)}
            placeholder="Comma-separated product names"
            className="w-full px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </FieldRow>

        <FieldRow label="Typology slugs" changed={changedKeys.has("typologySlugs")} current={control.typology_slugs.join(", ") || "None"}>
          <input
            value={draft.typologySlugs}
            onChange={(e) => set("typologySlugs", e.target.value)}
            placeholder="Comma-separated typology slugs"
            className="w-full px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </FieldRow>

        <FieldRow label="Owner" changed={changedKeys.has("ownerPersonId")} current={personLabel(control.owner_person_id ?? "")}>
          <select
            value={draft.ownerPersonId}
            onChange={(e) => set("ownerPersonId", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          >
            <option value="">Unassigned</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.role})
              </option>
            ))}
          </select>
        </FieldRow>

        <FieldRow
          label="Approver"
          changed={changedKeys.has("approverPersonId")}
          current={personLabel(control.approver_person_id ?? "")}
        >
          <select
            value={draft.approverPersonId}
            onChange={(e) => set("approverPersonId", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          >
            <option value="">Unassigned</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.role})
              </option>
            ))}
          </select>
        </FieldRow>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving || changedKeys.size === 0}>
          {saving ? "Saving..." : "Save proposed change"}
        </Button>
        {savedAt && <span className="text-xs text-text-muted">Saved.</span>}
      </div>
    </div>
  );
}

function FieldRow({
  label,
  current,
  changed,
  children,
}: {
  label: string;
  current: string;
  changed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl p-4 border ${changed ? "border-accent/40 bg-accent/[0.04]" : "border-white/10 bg-white/[0.02]"}`}>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wider">{label}</p>
        {changed && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-accent">
            <CircleDot className="h-3 w-3" /> Changed
          </span>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-3 items-start">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Current</p>
          <p className="text-sm text-text-muted">{current}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1 flex items-center gap-1">
            <ArrowRight className="h-2.5 w-2.5" /> Proposed
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}
