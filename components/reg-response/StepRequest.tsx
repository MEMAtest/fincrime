"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import Input from "@/components/ui/Input";
import {
  REG_REQUEST_CHANNEL_LABEL,
  type PersonDTO,
  type PersonRole,
  type RegRequestChannel,
  type RegRequestDTO,
} from "./types";

const CHANNELS: RegRequestChannel[] = ["email", "portal", "letter", "meeting", "s165", "other"];
const PERSON_ROLES: PersonRole[] = ["owner", "reviewer", "approver"];

export interface RequestFields {
  title: string;
  reference: string | null;
  regulator: string;
  channel: RegRequestChannel | null;
  receivedAt: string | null;
  deadline: string | null;
  ownerPersonId: string | null;
  summary: string | null;
}

interface StepRequestProps {
  request: RegRequestDTO;
  people: PersonDTO[];
  readOnly: boolean;
  onSave: (fields: Partial<RequestFields>) => Promise<{ ok: true } | { ok: false; message: string }>;
  onCreatePerson: (input: { name: string; role: PersonRole; email?: string }) => Promise<PersonDTO | null>;
}

function toDateInput(v: string | null): string {
  if (!v) return "";
  return v.slice(0, 10);
}

/** Step 1: the request itself - reference, title, regulator, channel, received date, deadline, owner and a free-text summary. Each field saves on blur/change. */
export default function StepRequest({ request, people, readOnly, onSave, onCreatePerson }: StepRequestProps) {
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddRole, setQuickAddRole] = useState<PersonRole>("owner");
  const [quickAddBusy, setQuickAddBusy] = useState(false);

  async function commit(fields: Partial<RequestFields>) {
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
        <h2 className="text-2xl font-bold text-foreground mb-1">Request</h2>
        <p className="text-sm text-text-muted">
          Record what the regulator asked for, when, and through which channel. Each field saves automatically.
        </p>
      </div>

      <Input
        key={`${request.id}-title`}
        label="Title"
        defaultValue={request.title}
        disabled={readOnly}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== request.title) void commit({ title: v });
        }}
      />

      <div className="grid sm:grid-cols-2 gap-4">
        <Input
          key={`${request.id}-reference`}
          label="Reference (optional)"
          placeholder="e.g. FCA-2026-0417"
          defaultValue={request.reference ?? ""}
          disabled={readOnly}
          onBlur={(e) => {
            const v = e.target.value.trim() || null;
            if (v !== request.reference) void commit({ reference: v });
          }}
        />
        <Input
          key={`${request.id}-regulator`}
          label="Regulator"
          defaultValue={request.regulator}
          disabled={readOnly}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== request.regulator) void commit({ regulator: v });
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-soft">Channel</label>
        <select
          key={`${request.id}-channel`}
          defaultValue={request.channel ?? ""}
          disabled={readOnly}
          onChange={(e) => void commit({ channel: (e.target.value || null) as RegRequestChannel | null })}
          className="w-full sm:w-72 px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors disabled:opacity-60"
        >
          <option value="">Not specified</option>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {REG_REQUEST_CHANNEL_LABEL[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Input
          key={`${request.id}-receivedAt`}
          type="date"
          label="Received on"
          defaultValue={toDateInput(request.received_at)}
          disabled={readOnly}
          onBlur={(e) => {
            const v = e.target.value || null;
            const current = toDateInput(request.received_at) || null;
            if (v !== current) void commit({ receivedAt: v });
          }}
        />
        <Input
          key={`${request.id}-deadline`}
          type="date"
          label="Deadline"
          defaultValue={toDateInput(request.deadline)}
          disabled={readOnly}
          onBlur={(e) => {
            const v = e.target.value || null;
            const current = toDateInput(request.deadline) || null;
            if (v !== current) void commit({ deadline: v });
          }}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-ink-soft">Owner (optional)</label>
        <div className="flex items-center gap-2 mt-1.5">
          <select
            key={`${request.id}-owner-${request.owner_person_id ?? "none"}`}
            defaultValue={request.owner_person_id ?? ""}
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

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-soft">Summary (optional)</label>
        <textarea
          key={`${request.id}-summary`}
          defaultValue={request.summary ?? ""}
          disabled={readOnly}
          rows={4}
          placeholder="What is this request about, and what triggered it?"
          onBlur={(e) => {
            const v = e.target.value.trim() || null;
            if (v !== request.summary) void commit({ summary: v });
          }}
          className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors disabled:opacity-60"
        />
      </div>

      {saving && <p className="text-xs text-text-muted">Saving...</p>}
      {fieldError && <p className="text-xs text-red-500">{fieldError}</p>}
    </div>
  );
}
