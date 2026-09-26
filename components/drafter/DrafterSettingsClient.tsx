"use client";

import { useEffect, useState } from "react";
import ToolFrame from "@/components/layout/ToolFrame";
import { drafterFetch } from "./drafterFetch";

interface Settings {
  filter_defaults: {
    applicability: string;
    obligation_vs_guidance_prefix: string;
    include_guidance: boolean;
    group_2lod_status: string;
    complete_for_pra_procedures_valid_only: boolean;
  };
  banned_phrases: { phrase: string; replacement: string }[];
  controlled_tags_risk_addressed: string[];
  controlled_tags_customer_type: string[];
  controlled_tags_lifecycle_stage: string[];
  contradiction_rules: { id: string; column_a: string; value_a: string; column_b: string; value_b_contains: string; severity: string }[];
  cost_cap_pence_per_pra: number;
  model_prices_per_million_tokens_usd_cents: { writer: { model?: string; in: number; out: number }; judge: { model?: string; in: number; out: number } };
  judge_agreement_threshold_pct: number;
  control_text_word_limits: { min: number; max: number };
}

/**
 * Keyed by `values.join("|")` from the caller so a fresh reload (e.g. after
 * saving) remounts this with the new server value as its initial state,
 * without an effect re-syncing local state from a prop (a classic
 * derived-state effect this codebase avoids - see BUILD-DECISIONS.md's
 * react-hooks/set-state-in-effect note).
 */
function TextListEditor({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(values.join("\n"));
  return (
    <textarea
      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono"
      rows={5}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(text.split("\n").map((v) => v.trim()).filter(Boolean))}
    />
  );
}

export default function DrafterSettingsClient() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function reload() {
    const res = await drafterFetch<{ settings: Settings }>("/api/drafter/settings");
    if (res.ok && "settings" in res.data) setSettings(res.data.settings);
  }

  useEffect(() => {
    (async () => {
      await reload();
    })();
  }, []);

  async function save(key: string, value: unknown) {
    const res = await drafterFetch<{ settings: Settings }>("/api/drafter/settings", {
      method: "PUT",
      body: JSON.stringify({ key, value }),
    });
    if (res.ok && "settings" in res.data) {
      setSettings(res.data.settings);
      setMessage(`Saved ${key}.`);
    } else if ("error" in res.data) {
      setMessage(res.data.error ?? "Could not save");
    }
  }

  if (!settings) {
    return (
      <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "PRA Drafter", href: "/drafter" }, { label: "Settings" }]}>
        <main className="flex-1 max-w-5xl mx-auto px-4 py-8 text-sm text-text-muted">Loading...</main>
      </ToolFrame>
    );
  }

  return (
    <ToolFrame breadcrumb={[{ label: "Home", href: "/" }, { label: "PRA Drafter", href: "/drafter" }, { label: "Settings" }]}>
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">Settings</h1>
          <p className="text-sm text-text-muted mb-6">
            Controlled lists, the default inclusion filter, contradiction rules, cost cap, per-role model prices and
            the judge agreement threshold. Every save is logged with your email.
          </p>

          {message && <div className="glass-card rounded-xl p-4 text-sm mb-6">{message}</div>}

          <section className="glass-card rounded-xl p-5 mb-6">
            <h2 className="font-medium text-foreground mb-3">Controlled tag lists</h2>
            <div className="mb-4">
              <label className="text-xs text-text-muted block mb-1">Risk addressed (one per line)</label>
              <TextListEditor
                key={settings.controlled_tags_risk_addressed.join("|")}
                values={settings.controlled_tags_risk_addressed}
                onChange={(v) => save("controlled_tags_risk_addressed", v)}
              />
            </div>
            <div className="mb-4">
              <label className="text-xs text-text-muted block mb-1">Customer type (one per line)</label>
              <TextListEditor
                key={settings.controlled_tags_customer_type.join("|")}
                values={settings.controlled_tags_customer_type}
                onChange={(v) => save("controlled_tags_customer_type", v)}
              />
            </div>
            <div className="mb-4">
              <label className="text-xs text-text-muted block mb-1">Lifecycle stage (one per line)</label>
              <TextListEditor
                key={settings.controlled_tags_lifecycle_stage.join("|")}
                values={settings.controlled_tags_lifecycle_stage}
                onChange={(v) => save("controlled_tags_lifecycle_stage", v)}
              />
            </div>
          </section>

          <section className="glass-card rounded-xl p-5 mb-6">
            <h2 className="font-medium text-foreground mb-3">Default inclusion filter</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="flex flex-col gap-1">
                Applicability
                <input
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5"
                  defaultValue={settings.filter_defaults.applicability}
                  onBlur={(e) => save("filter_defaults", { ...settings.filter_defaults, applicability: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                Group 2LOD status
                <input
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5"
                  defaultValue={settings.filter_defaults.group_2lod_status}
                  onBlur={(e) => save("filter_defaults", { ...settings.filter_defaults, group_2lod_status: e.target.value })}
                />
              </label>
            </div>
          </section>

          <section className="glass-card rounded-xl p-5 mb-6">
            <h2 className="font-medium text-foreground mb-3">Contradiction rules</h2>
            <ul className="space-y-2 text-xs">
              {settings.contradiction_rules.map((rule) => (
                <li key={rule.id} className="border border-white/10 rounded-lg p-3">
                  <span className="font-mono">{rule.column_a}</span> = &quot;{rule.value_a}&quot; AND{" "}
                  <span className="font-mono">{rule.column_b}</span> contains &quot;{rule.value_b_contains}&quot; &rarr;{" "}
                  <span className="uppercase">{rule.severity}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-text-muted mt-2">
              The app never resolves a contradiction itself - editing rule values here only changes what gets
              flagged.
            </p>
          </section>

          <section className="glass-card rounded-xl p-5 mb-6">
            <h2 className="font-medium text-foreground mb-3">Cost cap &amp; model prices</h2>
            <label className="flex flex-col gap-1 text-sm mb-3">
              Cost cap per PRA (USD)
              <input
                type="number"
                step="0.01"
                min="0"
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 max-w-xs"
                defaultValue={(settings.cost_cap_pence_per_pra / 100).toFixed(2)}
                onBlur={(e) => save("cost_cap_pence_per_pra", Math.round(Number(e.target.value) * 100))}
              />
            </label>
            <p className="text-xs text-text-muted">
              Writer: {settings.model_prices_per_million_tokens_usd_cents.writer.model} (
              {settings.model_prices_per_million_tokens_usd_cents.writer.in} in /{" "}
              {settings.model_prices_per_million_tokens_usd_cents.writer.out} out per 1M tokens)
              <br />
              Judge: {settings.model_prices_per_million_tokens_usd_cents.judge.model} (
              {settings.model_prices_per_million_tokens_usd_cents.judge.in} in /{" "}
              {settings.model_prices_per_million_tokens_usd_cents.judge.out} out per 1M tokens)
            </p>
          </section>

          <section className="glass-card rounded-xl p-5">
            <h2 className="font-medium text-foreground mb-3">Judge &amp; control text limits</h2>
            <label className="flex flex-col gap-1 text-sm mb-3">
              Judge agreement threshold (%)
              <input
                type="number"
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 max-w-xs"
                defaultValue={settings.judge_agreement_threshold_pct}
                onBlur={(e) => save("judge_agreement_threshold_pct", Number(e.target.value))}
              />
            </label>
            <p className="text-xs text-text-muted">
              Control text word limits: {settings.control_text_word_limits.min} to {settings.control_text_word_limits.max} words.
            </p>
          </section>
        </div>
      </main>
    </ToolFrame>
  );
}
