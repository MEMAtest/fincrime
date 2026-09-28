import { query } from "@/lib/db";
import { writeDrafterAudit } from "./drafter-audit";

export interface FilterDefaults {
  applicability: string;
  obligation_vs_guidance_prefix: string;
  include_guidance: boolean;
  group_2lod_status: string;
  complete_for_pra_procedures_valid_only: boolean;
}

export interface BannedPhrase {
  phrase: string;
  replacement: string;
}

export interface ContradictionRule {
  id: string;
  column_a: string;
  value_a: string;
  column_b: string;
  value_b_contains: string;
  severity: "blocking" | "warning";
}

export interface ModelPrice {
  model?: string;
  in: number;
  out: number;
}

export interface ModelPrices {
  writer: ModelPrice;
  judge: ModelPrice;
}

export interface DrafterSettings {
  filter_defaults: FilterDefaults;
  banned_phrases: BannedPhrase[];
  controlled_tags_risk_addressed: string[];
  controlled_tags_customer_type: string[];
  controlled_tags_lifecycle_stage: string[];
  contradiction_rules: ContradictionRule[];
  cost_cap_pence_per_pra: number;
  model_prices_per_million_tokens_usd_cents: ModelPrices;
  judge_agreement_threshold_pct: number;
  judge_calibration_min_items: number;
  control_text_word_limits: { min: number; max: number };
}

const SETTINGS_KEYS = [
  "filter_defaults",
  "banned_phrases",
  "controlled_tags_risk_addressed",
  "controlled_tags_customer_type",
  "controlled_tags_lifecycle_stage",
  "contradiction_rules",
  "cost_cap_pence_per_pra",
  "model_prices_per_million_tokens_usd_cents",
  "judge_agreement_threshold_pct",
  "judge_calibration_min_items",
  "control_text_word_limits",
] as const;

export async function getAllDrafterSettings(): Promise<DrafterSettings> {
  const rows = await query<{ key: string; value: unknown }>(`SELECT key, value FROM drafter_settings`);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return byKey as unknown as DrafterSettings;
}

export async function getDrafterSetting<K extends (typeof SETTINGS_KEYS)[number]>(
  key: K
): Promise<DrafterSettings[K] | null> {
  const rows = await query<{ value: unknown }>(`SELECT value FROM drafter_settings WHERE key = $1`, [key]);
  return (rows[0]?.value as DrafterSettings[K] | undefined) ?? null;
}

export async function setDrafterSetting(
  key: (typeof SETTINGS_KEYS)[number],
  value: unknown,
  actor: string
): Promise<void> {
  await query(
    `INSERT INTO drafter_settings (key, value, updated_by) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [key, JSON.stringify(value), actor]
  );
  await writeDrafterAudit(actor, "settings.update", "drafter_settings", null, { key });
}

export function isValidSettingsKey(key: string): key is (typeof SETTINGS_KEYS)[number] {
  return (SETTINGS_KEYS as readonly string[]).includes(key);
}
