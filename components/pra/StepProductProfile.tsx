"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import Input from "@/components/ui/Input";
import { CUSTOMER_LABEL } from "@/data/typologies/labels";
import type { CustomerType } from "@/data/typologies/types";
import { JURISDICTION_LABEL, JURISDICTION_ORDER, type Jurisdiction } from "@/data/kyc/types";
import type { ProfileDraft } from "./types";

const CUSTOMER_OPTIONS: CustomerType[] = [
  "individuals",
  "smes",
  "corporates",
  "high_net_worth",
  "politically_exposed",
  "non_profit",
  "agents_intermediaries",
];

const label = "text-[11px] uppercase tracking-wider text-text-muted";

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

interface StepProductProfileProps {
  draft: ProfileDraft;
  onChange: (next: ProfileDraft) => void;
}

/** Step 1: name, description, customers, channels (free-text chips), jurisdictions. */
export default function StepProductProfile({ draft, onChange }: StepProductProfileProps) {
  const [channelInput, setChannelInput] = useState("");
  const channelInputId = useId();

  const addChannel = () => {
    const value = channelInput.trim();
    if (!value || draft.channels.includes(value)) {
      setChannelInput("");
      return;
    }
    onChange({ ...draft, channels: [...draft.channels, value] });
    setChannelInput("");
  };

  const removeChannel = (value: string) => {
    onChange({ ...draft, channels: draft.channels.filter((c) => c !== value) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Product profile</h2>
        <p className="text-sm text-text-muted">
          Describe the product being assessed. This profile seeds the inherent risk step and appears on the
          committee pack.
        </p>
      </div>

      <Input
        label="Product name"
        value={draft.name}
        onChange={(e) => onChange({ ...draft, name: e.target.value })}
        placeholder="e.g. Cross-border remittance"
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink-soft">Description</label>
        <textarea
          value={draft.description}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
          placeholder="What is this product, who is it for, and how does money move through it?"
        />
      </div>

      <div>
        <span className={label}>Customer types</span>
        <div className="mt-2 grid sm:grid-cols-2 gap-2">
          {CUSTOMER_OPTIONS.map((value) => {
            const selected = draft.customers.includes(value);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ ...draft, customers: toggleValue(draft.customers, value) })}
                className={`text-left px-3.5 py-2.5 rounded-lg border text-sm transition-colors cursor-pointer ${
                  selected
                    ? "border-accent bg-accent/5 text-accent font-medium"
                    : "border-line-2 bg-surface text-foreground hover:border-accent/40"
                }`}
              >
                {CUSTOMER_LABEL[value]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className={label}>Jurisdictions</span>
        <div className="mt-2 grid sm:grid-cols-2 gap-2">
          {JURISDICTION_ORDER.map((value: Jurisdiction) => {
            const selected = draft.jurisdictions.includes(value);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ ...draft, jurisdictions: toggleValue(draft.jurisdictions, value) })}
                className={`text-left px-3.5 py-2.5 rounded-lg border text-sm transition-colors cursor-pointer ${
                  selected
                    ? "border-accent bg-accent/5 text-accent font-medium"
                    : "border-line-2 bg-surface text-foreground hover:border-accent/40"
                }`}
              >
                {JURISDICTION_LABEL[value]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor={channelInputId} className="text-sm font-medium text-ink-soft">
          Channels
        </label>
        <p className="text-xs text-text-muted mt-0.5 mb-2">
          How customers access this product (e.g. mobile app, API, branch). Free text.
        </p>
        <div className="flex gap-2">
          <input
            id={channelInputId}
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addChannel();
              }
            }}
            placeholder="Type a channel and press Enter"
            className="flex-1 px-3.5 py-2.5 rounded-lg border border-line-2 bg-surface text-foreground text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
          />
          <button
            type="button"
            onClick={addChannel}
            className="px-4 rounded-lg border border-line-2 text-sm text-foreground hover:border-accent/40 transition-colors cursor-pointer"
          >
            Add
          </button>
        </div>
        {draft.channels.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {draft.channels.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03] text-xs text-foreground"
              >
                {c}
                <button
                  type="button"
                  onClick={() => removeChannel(c)}
                  aria-label={`Remove ${c}`}
                  className="text-text-muted hover:text-red-500 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
