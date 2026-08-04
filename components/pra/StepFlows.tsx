"use client";

import { ArrowDown, ArrowRight, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { Actor } from "@/data/partner-flows/types";
import type { FlowLeg } from "./types";

const ACTOR_OPTIONS: { value: Actor; label: string }[] = [
  { value: "your_firm", label: "Your Firm" },
  { value: "partner", label: "Partner" },
  { value: "correspondent_bank", label: "Correspondent Bank" },
  { value: "beneficiary_bank", label: "Beneficiary Bank" },
  { value: "end_customer", label: "End Customer" },
  { value: "platform_operator", label: "Platform Operator" },
  { value: "fx_provider", label: "FX Provider" },
];

const CUSTOM_SENTINEL = "__custom__";

const selectCls =
  "px-2.5 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors";

function ActorField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const preset = ACTOR_OPTIONS.find((o) => o.value === value);
  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
      <select
        value={preset ? value : CUSTOM_SENTINEL}
        onChange={(e) => onChange(e.target.value === CUSTOM_SENTINEL ? "" : e.target.value)}
        className={selectCls}
      >
        {ACTOR_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value={CUSTOM_SENTINEL}>Other (type your own)</option>
      </select>
      {!preset && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Custom actor"
          className="px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
        />
      )}
    </div>
  );
}

function makeLegId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `leg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface StepFlowsProps {
  legs: FlowLeg[];
  onChange: (next: FlowLeg[]) => void;
}

/** Step 2: an ordered list of flow legs (from actor -> to actor + optional note). */
export default function StepFlows({ legs, onChange }: StepFlowsProps) {
  const addLeg = () => {
    const previous = legs[legs.length - 1];
    onChange([
      ...legs,
      { id: makeLegId(), from: previous?.to ?? "your_firm", to: "partner", note: "" },
    ]);
  };

  const updateLeg = (id: string, patch: Partial<FlowLeg>) => {
    onChange(legs.map((leg) => (leg.id === id ? { ...leg, ...patch } : leg)));
  };

  const removeLeg = (id: string) => {
    onChange(legs.filter((leg) => leg.id !== id));
  };

  const moveLeg = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= legs.length) return;
    const next = [...legs];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Flows</h2>
        <p className="text-sm text-text-muted">
          Map the product as an ordered chain of legs: who sends to whom, in order. This gives reviewers a plain
          picture of where money and data move.
        </p>
      </div>

      {legs.length === 0 && (
        <div className="glass-card rounded-xl p-6 text-center text-sm text-text-muted">
          No flow legs yet. Add the first leg to start mapping how this product moves money or data.
        </div>
      )}

      <div className="space-y-3">
        {legs.map((leg, index) => (
          <div key={leg.id} className="glass-card rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1 pt-2 shrink-0">
                <span className="text-xs font-mono text-text-muted w-5 text-center">{index + 1}</span>
                <button
                  type="button"
                  onClick={() => moveLeg(index, -1)}
                  disabled={index === 0}
                  aria-label="Move leg up"
                  className="text-text-muted hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveLeg(index, 1)}
                  disabled={index === legs.length - 1}
                  aria-label="Move leg down"
                  className="text-text-muted hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-center gap-2">
                  <ActorField value={leg.from} onChange={(v) => updateLeg(leg.id, { from: v })} />
                  <ArrowRight className="h-4 w-4 text-text-muted shrink-0" />
                  <ActorField value={leg.to} onChange={(v) => updateLeg(leg.id, { to: v })} />
                </div>
                <input
                  value={leg.note ?? ""}
                  onChange={(e) => updateLeg(leg.id, { note: e.target.value })}
                  placeholder="Optional note (e.g. data shared, payment rail, SLA)"
                  className="w-full px-3 py-2 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
                />
              </div>

              <button
                type="button"
                onClick={() => removeLeg(leg.id)}
                aria-label="Remove leg"
                className="text-text-muted hover:text-red-500 transition-colors shrink-0 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addLeg}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-line-2 text-sm text-text-muted hover:text-accent hover:border-accent/40 transition-colors cursor-pointer"
      >
        <Plus className="h-4 w-4" /> Add leg
      </button>
    </div>
  );
}
