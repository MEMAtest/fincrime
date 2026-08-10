"use client";

import { useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { RatingBadge } from "@/components/controls/ControlBits";
import { getControlBySlug } from "@/data/controls";
import {
  CONTROL_TEST_METHOD_LABEL,
  type ControlTestDTO,
  type ControlTestMethod,
  type PersonDTO,
  type PersonRole,
  type WorkspaceControlDTO,
} from "./types";

const METHODS = Object.keys(CONTROL_TEST_METHOD_LABEL) as ControlTestMethod[];
const PERSON_ROLES: PersonRole[] = ["owner", "reviewer", "approver"];

function fmtDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export interface ScopeFields {
  title: string;
  method: ControlTestMethod | null;
  periodStart: string | null;
  periodEnd: string | null;
  testerPersonId: string | null;
}

interface StepScopeProps {
  test: ControlTestDTO;
  control: WorkspaceControlDTO;
  people: PersonDTO[];
  readOnly: boolean;
  onSave: (fields: ScopeFields) => Promise<void>;
  onCreatePerson: (input: { name: string; role: PersonRole; email?: string }) => Promise<PersonDTO | null>;
}

/** Step 1: the live control under test (read-only) plus editable scope fields (title/method/period/tester). Surfaces the library control's testPlan as the suggested procedure. */
export default function StepScope({ test, control, people, readOnly, onSave, onCreatePerson }: StepScopeProps) {
  const [title, setTitle] = useState(test.title);
  const [method, setMethod] = useState<ControlTestMethod | "">(test.method ?? "");
  const [periodStart, setPeriodStart] = useState(test.period_start ?? "");
  const [periodEnd, setPeriodEnd] = useState(test.period_end ?? "");
  const [testerPersonId, setTesterPersonId] = useState(test.tester_person_id ?? "");
  const [saving, setSaving] = useState(false);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddRole, setQuickAddRole] = useState<PersonRole>("owner");
  const [quickAddBusy, setQuickAddBusy] = useState(false);

  const libraryControl = useMemo(
    () => (control.control_slug ? getControlBySlug(control.control_slug) : undefined),
    [control.control_slug]
  );

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        title: title.trim() || test.title,
        method: method || null,
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        testerPersonId: testerPersonId || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const submitQuickAdd = async () => {
    const name = quickAddName.trim();
    if (!name) return;
    setQuickAddBusy(true);
    try {
      const person = await onCreatePerson({ name, role: quickAddRole });
      if (person) {
        setTesterPersonId(person.id);
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
          The live control under test, and the scope of this test cycle: method, period and who is running it.
        </p>
      </div>

      <section className="glass-card rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-foreground">{control.name}</h3>
          <RatingBadge rating={control.effectiveness_rating ?? "not_assessed"} />
        </div>
        <p className="text-sm text-text-muted">{control.objective}</p>
        <div className="grid sm:grid-cols-3 gap-3 text-xs text-text-muted pt-2 border-t border-white/10">
          <p>Version: <span className="text-foreground">v{control.version}</span></p>
          <p>Last tested: <span className="text-foreground">{fmtDate(control.last_tested_at)}</span></p>
          <p>Next due: <span className="text-foreground">{fmtDate(control.next_test_due)}</span></p>
        </div>
        {libraryControl && libraryControl.testPlan.length > 0 && (
          <div className="pt-3 border-t border-white/10">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
              Suggested test procedure (from the control library)
            </p>
            <ol className="space-y-1.5 list-decimal list-inside">
              {libraryControl.testPlan.map((step, i) => (
                <li key={i} className="text-sm text-foreground">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <section className="glass-card rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Test scope</h3>

        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={readOnly} />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink-soft">Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as ControlTestMethod | "")}
            disabled={readOnly}
            className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors disabled:opacity-60"
          >
            <option value="">Not specified</option>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {CONTROL_TEST_METHOD_LABEL[m]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            type="date"
            label="Period start"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            disabled={readOnly}
          />
          <Input
            type="date"
            label="Period end"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            disabled={readOnly}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-ink-soft">Tester</label>
          <div className="flex items-center gap-2 mt-1.5">
            <select
              value={testerPersonId}
              onChange={(e) => setTesterPersonId(e.target.value)}
              disabled={readOnly}
              className="flex-1 px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-60"
            >
              <option value="">Select a person...</option>
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

        {!readOnly && (
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save scope"}
          </Button>
        )}
      </section>
    </div>
  );
}
