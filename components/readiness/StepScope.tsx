"use client";

import { useState } from "react";
import { Lock, UserPlus } from "lucide-react";
import Input from "@/components/ui/Input";
import type { AssessmentListItem } from "@/components/pra/types";
import {
  ENTITY_LABEL,
  JURISDICTION_LABEL,
} from "@/data/kyc/types";
import {
  RISK_LEVEL_LABEL,
  type PersonDTO,
  type PersonRole,
  type ReadinessAssessmentDTO,
  type RiskLevel,
} from "./types";

const RISK_LEVELS: RiskLevel[] = ["low", "medium", "high"];
const PERSON_ROLES: PersonRole[] = ["owner", "reviewer", "approver"];

export interface ScopeFields {
  title: string;
  riskLevel: RiskLevel;
  productId: string | null;
  productNote: string | null;
  targetLaunchDate: string | null;
  ownerPersonId: string | null;
}

interface StepScopeProps {
  assessment: ReadinessAssessmentDTO;
  people: PersonDTO[];
  praAssessments: AssessmentListItem[];
  readOnly: boolean;
  onSave: (fields: Partial<ScopeFields>) => Promise<{ ok: true } | { ok: false; message: string }>;
  onCreatePerson: (input: { name: string; role: PersonRole; email?: string }) => Promise<PersonDTO | null>;
}

function toDateInput(v: string | null): string {
  if (!v) return "";
  return v.slice(0, 10);
}

/**
 * Step 1: the assessment's scope. Title, risk level, product link (or a
 * free-text product note), target launch date and owner are all editable.
 * Entity type and jurisdiction are shown read-only: the API refuses PATCHing
 * either field on ANY readiness assessment (see PATCH /api/readiness/[id]),
 * because the obligation register generated in step 2 is derived from this
 * exact (entityType, jurisdiction) pair and would silently no longer match
 * its stated basis if either changed - so the UI never lets the user try.
 */
export default function StepScope({ assessment, people, praAssessments, readOnly, onSave, onCreatePerson }: StepScopeProps) {
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [useProductNote, setUseProductNote] = useState(!assessment.product_id && Boolean(assessment.product_note));

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddRole, setQuickAddRole] = useState<PersonRole>("owner");
  const [quickAddBusy, setQuickAddBusy] = useState(false);

  async function commit(fields: Partial<ScopeFields>) {
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
        <h2 className="text-2xl font-bold text-foreground mb-1">Scope</h2>
        <p className="text-sm text-text-muted">
          Confirm what is being assessed and who owns it. Each field saves automatically when you move to the next
          one.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-soft flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-text-muted" /> Entity type &amp; jurisdiction
        </label>
        <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5 rounded-lg border border-line-2 bg-white/[0.02] text-sm text-foreground">
          <span className="font-medium">{ENTITY_LABEL[assessment.entity_type] ?? assessment.entity_type}</span>
          <span className="text-text-muted">in</span>
          <span className="font-medium">{JURISDICTION_LABEL[assessment.jurisdiction] ?? assessment.jurisdiction}</span>
        </div>
        <p className="text-xs text-text-muted">
          Fixed at creation. The obligation register in the next step is generated from this exact pair, so changing
          it here would leave the register no longer matching its stated basis - start a new assessment instead if
          the entity type or jurisdiction needs to change.
        </p>
      </div>

      <Input
        key={`${assessment.id}-title`}
        label="Title"
        defaultValue={assessment.title}
        disabled={readOnly}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== assessment.title) void commit({ title: v });
        }}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-soft">Risk level</label>
        <div className="grid grid-cols-3 gap-2">
          {RISK_LEVELS.map((r) => (
            <button
              key={r}
              type="button"
              disabled={readOnly}
              onClick={() => void commit({ riskLevel: r })}
              className={`px-3 py-2.5 rounded-lg border text-sm text-center transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                assessment.risk_level === r
                  ? "border-accent bg-accent/5 text-accent font-medium"
                  : "border-line-2 bg-surface text-foreground hover:border-accent/40"
              }`}
            >
              {RISK_LEVEL_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-ink-soft">Product</label>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => setUseProductNote(false)}
            className={`px-2.5 py-1 rounded-full border cursor-pointer disabled:cursor-not-allowed ${
              !useProductNote ? "bg-accent/10 text-accent border-accent/30" : "bg-surface text-text-muted border-line-2"
            }`}
          >
            Link a PRA product
          </button>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => setUseProductNote(true)}
            className={`px-2.5 py-1 rounded-full border cursor-pointer disabled:cursor-not-allowed ${
              useProductNote ? "bg-accent/10 text-accent border-accent/30" : "bg-surface text-text-muted border-line-2"
            }`}
          >
            Free-text note instead
          </button>
        </div>

        {!useProductNote ? (
          <select
            key={`${assessment.id}-productId`}
            defaultValue={assessment.product_id ?? ""}
            disabled={readOnly}
            onChange={(e) => void commit({ productId: e.target.value || null })}
            className="w-full px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-60"
          >
            <option value="">Not linked</option>
            {praAssessments.map((a) => (
              <option key={a.id} value={a.productId}>
                {a.productName}
              </option>
            ))}
          </select>
        ) : (
          <Input
            key={`${assessment.id}-productNote`}
            defaultValue={assessment.product_note ?? ""}
            placeholder="e.g. New embedded-finance card product, not yet in a PRA"
            disabled={readOnly}
            onBlur={(e) => {
              const v = e.target.value.trim() || null;
              if (v !== assessment.product_note) void commit({ productNote: v, productId: null });
            }}
          />
        )}
      </div>

      <Input
        key={`${assessment.id}-targetLaunchDate`}
        type="date"
        label="Target launch date (optional)"
        defaultValue={toDateInput(assessment.target_launch_date)}
        disabled={readOnly}
        onBlur={(e) => {
          const v = e.target.value || null;
          if (v !== toDateInput(assessment.target_launch_date) || (v === "" && assessment.target_launch_date)) {
            void commit({ targetLaunchDate: v });
          }
        }}
      />

      <div>
        <label className="text-sm font-medium text-ink-soft">Owner (optional)</label>
        <div className="flex items-center gap-2 mt-1.5">
          <select
            key={`${assessment.id}-owner`}
            defaultValue={assessment.owner_person_id ?? ""}
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
