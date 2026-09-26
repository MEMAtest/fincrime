import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { query } from "@/lib/db";
import { centsToStoredUnits, fractionalCentsToStoredUnits, formatUsdFromStoredUnits } from "./money";

/**
 * PRA Drafter model provider interface. See
 * docs/pra-drafter/BUILD-DECISIONS.md "Models". One OpenAI-compatible chat
 * endpoint per role, configured entirely by env. No approved host is
 * configured yet, so a role with missing env is DISABLED, not routed to a
 * fallback key - this app must never send client material to Groq or any
 * other unapproved host.
 */

export type DrafterModelRole = "writer" | "judge" | "tagger";

export const PROMPT_VERSIONS = {
  writer_enhancement: "pra-writer-enhancement-v1",
  judge_rubric: "pra-judge-rubric-v1",
  tag_suggestion: "pra-tag-suggestion-v1",
} as const;

interface RoleConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

// Owner decision 2026-09-26: host is OpenRouter. Default model names below;
// a role's API key falls back to a single shared OPENROUTER_API_KEY when
// its own per-role key env is unset. BASE_URL still comes from env (see
// OPENROUTER_BASE_URL_DEFAULT in the repo's env example / .env.local) so a
// deploy always states explicitly which host it talks to.
// Judge default changed 2026-09-26 after a real-call bake-off
// (docs/pra-drafter/JUDGE-BAKEOFF.md): minimax/minimax-m3 (the previous
// default) failed validation on 7/8 real production enhancements. Winner is
// qwen/qwen3-30b-a3b (12/12 valid JSON, 12/12 verdict agreement with the
// expected labels, cheapest and fastest of the four candidates tried) -
// note "qwen/qwen3.8-flash" named in the original bake-off brief has no
// OpenRouter endpoint under a zero-data-retention policy (HTTP 404,
// "Filter by Data Policy"), so qwen3-30b-a3b was substituted as the
// cheap-Chinese-model candidate.
const DEFAULT_MODELS: Record<"writer" | "judge", string> = {
  writer: "openai/gpt-5.6-luna",
  judge: "qwen/qwen3-30b-a3b",
};

function envRoleConfig(role: "writer" | "judge"): RoleConfig | null {
  const prefix = role === "writer" ? "PRA_WRITER" : "PRA_JUDGE";
  const baseUrl = (process.env[`${prefix}_BASE_URL`] || process.env.OPENROUTER_BASE_URL || "").trim();
  const apiKey = (process.env[`${prefix}_API_KEY`] || process.env.OPENROUTER_API_KEY || "").trim();
  const model = (process.env[`${prefix}_MODEL`] || DEFAULT_MODELS[role]).trim();
  if (!baseUrl || !apiKey || !model) return null;
  return { baseUrl, apiKey, model };
}

/** Tag suggestions use the writer config per BUILD-DECISIONS. */
function configForRole(role: DrafterModelRole): RoleConfig | null {
  if (role === "judge") return envRoleConfig("judge");
  return envRoleConfig("writer");
}

export function isStubMode(): boolean {
  if (process.env.VERCEL_ENV === "production") return false; // refused in prod, always
  return process.env.PRA_MODEL_STUB === "1";
}

export function isRoleConfigured(role: DrafterModelRole): boolean {
  if (isStubMode()) return true;
  return configForRole(role) !== null;
}

/**
 * A clear, user-facing reason a role's model step is unavailable. UI should
 * show this rather than attempting the call and surfacing a raw error.
 */
/** The model name that WOULD be used for a role right now (stub name in stub mode), for calibration-banner lookups that don't want to make a call. */
export function currentModelName(role: "writer" | "judge"): string {
  if (isStubMode()) return "stub";
  return configForRole(role)?.model ?? "unconfigured";
}

export function roleDisabledReason(role: DrafterModelRole): string | null {
  if (isRoleConfigured(role)) return null;
  const envNames =
    role === "judge"
      ? "PRA_JUDGE_BASE_URL / PRA_JUDGE_API_KEY / PRA_JUDGE_MODEL"
      : "PRA_WRITER_BASE_URL / PRA_WRITER_API_KEY / PRA_WRITER_MODEL";
  return `No approved model host is configured for this role yet (set ${envNames}). This step is disabled; every deterministic step still works.`;
}

export interface DrafterChatCallInput {
  role: DrafterModelRole;
  promptVersion: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  praId?: string;
  enhancementId?: string;
  /**
   * Structured-output schema for providers that support
   * `response_format: {type:"json_schema", json_schema:{...strict}}`. If the
   * provider rejects it, callDrafterModel retries the SAME call once with
   * `response_format: {type:"json_object"}` before giving up.
   */
  jsonSchema?: { name: string; strict: boolean; schema: Record<string, unknown> };
  /** Overrides the model actually called for this one request (used by the judge bake-off harness to try several candidates without touching env config). */
  modelOverride?: string;
  /** Overrides the USD-cents-per-1M-token price used for cost calc on this one call (paired with modelOverride, since drafter_settings' prices are keyed by role, not by model). */
  priceOverride?: { in: number; out: number };
}

export interface DrafterChatCallResult {
  ok: true;
  json: unknown;
  promptTokens: number;
  completionTokens: number;
  costEstimatePence: number;
  latencyMs: number;
  modelName: string;
}

export interface DrafterChatCallError {
  ok: false;
  error: string;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

interface RolePrice {
  model?: string;
  in: number; // USD cents per 1M input tokens
  out: number; // USD cents per 1M output tokens
}

/**
 * Prices are stored in USD cents per 1M tokens (drafter_settings key
 * `model_prices_per_million_tokens_usd_cents`), matching how OpenRouter
 * publishes per-model pricing. `cost_estimate_pence` on drafter_model_calls
 * is therefore USD-cent-equivalent, not GBP pence - the column name predates
 * the OpenRouter decision and is kept as-is to avoid a second migration;
 * treat it as "smallest currency unit of the configured prices".
 */
async function rolePrice(role: DrafterModelRole): Promise<RolePrice> {
  const priceRole = role === "judge" ? "judge" : "writer";
  const rows = await query<{ value: { writer: RolePrice; judge: RolePrice } }>(
    `SELECT value FROM drafter_settings WHERE key = 'model_prices_per_million_tokens_usd_cents'`
  );
  const prices = rows[0]?.value ?? { writer: { in: 0, out: 0 }, judge: { in: 0, out: 0 } };
  return priceRole === "judge" ? prices.judge ?? { in: 0, out: 0 } : prices.writer ?? { in: 0, out: 0 };
}

/**
 * Cost cap check: sums drafter_model_calls.cost_estimate_pence for a PRA and
 * compares against the configured cap. Call BEFORE making a model call for
 * that PRA; if this returns false, the caller must not call the model and
 * should show the cap message instead.
 */
/**
 * `spentPence`/`capPence` here are both in the STORED UNITS documented in
 * ./money.ts (1/10,000 of a USD cent), NOT whole cents despite the field
 * names (kept as-is to avoid touching every caller) - use
 * `formatUsdFromStoredUnits` to display either one.
 */
export async function isUnderCostCap(praId: string): Promise<{ underCap: boolean; spentPence: number; capPence: number }> {
  const capRows = await query<{ value: number }>(
    `SELECT value FROM drafter_settings WHERE key = 'cost_cap_pence_per_pra'`
  );
  const capPenceCents = capRows[0]?.value ?? 0;
  const capPence = centsToStoredUnits(capPenceCents);

  const spentRows = await query<{ total: string | null }>(
    `SELECT SUM(cost_estimate_pence) AS total FROM drafter_model_calls WHERE pra_id = $1`,
    [praId]
  );
  const spentPence = Number(spentRows[0]?.total ?? 0);

  return { underCap: capPence <= 0 || spentPence < capPence, spentPence, capPence };
}

/** Human-readable "spent $X of $Y cap" message, from an `isUnderCostCap` result. */
export function formatCostCapMessage(capCheck: { spentPence: number; capPence: number }): string {
  return `spent ${formatUsdFromStoredUnits(capCheck.spentPence)}, cap ${formatUsdFromStoredUnits(capCheck.capPence)}`;
}

/**
 * Default (unconfigured-fixture) canned JSON for the stub provider, used
 * when PRA_MODEL_STUB_FILE is unset or has no matching entry.
 */
function defaultStubResponse(role: DrafterModelRole, userPrompt: string): unknown {
  const inputHash = sha256(userPrompt).slice(0, 8);
  if (role === "writer") {
    return {
      control_text: `[STUB ${inputHash}] The system checks each new relationship against the applicable control before it is onboarded, and a nominated reviewer confirms the outcome is recorded.`,
      rationale: `[STUB ${inputHash}] This addresses the identified risk by ensuring the check happens before exposure begins, rather than after the event, and keeps the decision auditable.`,
      placeholders: [],
    };
  }
  if (role === "judge") {
    return {
      criteria: {
        mechanism_not_policy_restatement: { pass: true, quote: "", reason: "stub", critical: true },
        trigger_actor_action_outcome: { pass: true, quote: "", reason: "stub", critical: true },
        rationale_explains_risk: { pass: true, quote: "", reason: "stub", critical: true },
        scope_stated: { pass: true, quote: "", reason: "stub", critical: false },
        tone_measured: { pass: true, quote: "", reason: "stub", critical: false },
        correct_section: { pass: true, quote: "", reason: "stub", critical: true },
      },
      overall: "pass",
    };
  }
  return { tags: [] };
}

/**
 * Shape of a PRA_MODEL_STUB_FILE fixture file. Keyed by role, then by
 * prompt kind (the promptVersion string, e.g. "pra-writer-enhancement-v1"),
 * then by a lookup table of canned entries so a rehearsal can push both
 * realistic-good and deliberately-bad outputs through the real pipeline
 * without touching code:
 *
 * {
 *   "writer": {
 *     "pra-writer-enhancement-v1": {
 *       "default": { "response": { control_text: "...", ... } },
 *       "entries": [
 *         { "matchIncludes": ["REQ-0002"], "response": { ...bad output with invented numbers... } },
 *         { "matchIncludes": ["REQ-0099"], "malformed": true }
 *       ]
 *     }
 *   }
 * }
 *
 * Matching: the userPrompt is scanned for the FIRST entry whose every
 * `matchIncludes` substring is present (in order given); "default" is used
 * when nothing matches. `malformed: true` returns literally-broken JSON
 * text so the malformed-JSON path (retry once, then a visible failure) is
 * exercised end to end - this must never be swallowed into a silent pass.
 */
interface StubFileEntry {
  matchIncludes?: string[];
  response?: unknown;
  malformed?: boolean;
}
interface StubFilePromptKind {
  default?: { response?: unknown; malformed?: boolean };
  entries?: StubFileEntry[];
}
type StubFile = Partial<Record<DrafterModelRole, Record<string, StubFilePromptKind>>>;

let cachedStubFile: { path: string; data: StubFile } | null = null;

function loadStubFile(): StubFile | null {
  const path = (process.env.PRA_MODEL_STUB_FILE || "").trim();
  if (!path) return null;
  if (cachedStubFile && cachedStubFile.path === path) return cachedStubFile.data;
  try {
    const raw = readFileSync(path, "utf8");
    const data = JSON.parse(raw) as StubFile;
    cachedStubFile = { path, data };
    return data;
  } catch (error) {
    console.error(`PRA_MODEL_STUB_FILE could not be read/parsed at "${path}":`, error);
    return null;
  }
}

/**
 * Raw stub content (as a JSON string) for one call. Reads PRA_MODEL_STUB_FILE
 * when set and a matching entry exists; a `malformed: true` entry returns a
 * deliberately-broken string. Falls back to defaultStubResponse otherwise.
 */
function stubRawContent(role: DrafterModelRole, promptVersion: string, userPrompt: string): string {
  const file = loadStubFile();
  const promptKind = file?.[role]?.[promptVersion];
  if (promptKind) {
    const matched = (promptKind.entries ?? []).find(
      (entry) => (entry.matchIncludes ?? []).length > 0 && entry.matchIncludes!.every((needle) => userPrompt.includes(needle))
    );
    const chosen = matched ?? promptKind.default;
    if (chosen) {
      if (chosen.malformed) return "{ this is not valid JSON ::: [[[";
      if (chosen.response !== undefined) return JSON.stringify(chosen.response);
    }
  }
  return JSON.stringify(defaultStubResponse(role, userPrompt));
}

/**
 * Makes one chat call for the given role and logs it to drafter_model_calls.
 * Refuses (returns ok:false) when the role is not configured and stub mode
 * is not active/available. Stub mode itself is refused when
 * VERCEL_ENV === "production", regardless of PRA_MODEL_STUB.
 */
export async function callDrafterModel(
  input: DrafterChatCallInput
): Promise<DrafterChatCallResult | DrafterChatCallError> {
  const start = Date.now();
  const inputHash = sha256(`${input.systemPrompt}\n---\n${input.userPrompt}`);

  if (!isRoleConfigured(input.role)) {
    const reason = roleDisabledReason(input.role) ?? "Model role not configured.";
    await logCall(input, "unconfigured", inputHash, null, 0, 0, 0, Date.now() - start, reason);
    return { ok: false, error: reason };
  }

  if (isStubMode()) {
    // Malformed JSON from the stub file must behave exactly like a real
    // provider returning broken JSON: retry once, then fail visibly and log
    // it. Never silently substitute a default "pass" response - that would
    // be exactly the "absence renders as a pass" failure mode this repo has
    // been bitten by before.
    let json: unknown = null;
    let parseError: string | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = stubRawContent(input.role, input.promptVersion, input.userPrompt);
      try {
        json = JSON.parse(raw);
        parseError = null;
        break;
      } catch (error) {
        parseError = error instanceof Error ? error.message : "Invalid JSON from stub";
      }
    }
    const latencyMs = Date.now() - start;
    if (parseError) {
      const message = `Stub model response was not valid JSON after 1 retry: ${parseError}`;
      await logCall(input, "stub", inputHash, null, 0, 0, 0, latencyMs, message);
      return { ok: false, error: message };
    }
    await logCall(input, "stub", inputHash, json, 0, 0, 0, latencyMs, null);
    return { ok: true, json, promptTokens: 0, completionTokens: 0, costEstimatePence: 0, latencyMs, modelName: "stub" };
  }

  const config = configForRole(input.role);
  if (!config) {
    const reason = roleDisabledReason(input.role) ?? "Model role not configured.";
    return { ok: false, error: reason };
  }
  const modelName = input.modelOverride?.trim() || config.model;

  async function postChat(responseFormat: Record<string, unknown>): Promise<Response> {
    return fetch(`${config!.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config!.apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        temperature: input.temperature,
        response_format: responseFormat,
        // OpenRouter provider preferences: this app sends internal client
        // material, so every request must forbid training/retention.
        provider: { data_collection: "deny", zdr: true },
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt },
        ],
      }),
    });
  }

  try {
    // Prefer structured output (response_format: json_schema, strict) when
    // a schema was given - it constrains the model's output shape at
    // generation time rather than only catching a bad shape after the
    // fact, which is what actually caused most of the "criterion X missing
    // a quote" / "missing a criteria object" failures seen in production
    // for minimax/minimax-m3. Not every OpenRouter-routed provider accepts
    // json_schema, so a schema-request failure falls back to json_object
    // once, on the SAME call (not counted as the one judge repair round).
    let response = input.jsonSchema
      ? await postChat({ type: "json_schema", json_schema: input.jsonSchema })
      : await postChat({ type: "json_object" });

    if (!response.ok && input.jsonSchema) {
      const firstErrorText = await response.text();
      if (/response_format|json_schema|schema/i.test(firstErrorText)) {
        response = await postChat({ type: "json_object" });
      } else {
        await logCall(input, modelName, inputHash, null, 0, 0, 0, Date.now() - start, `HTTP ${response.status}: ${firstErrorText}`);
        return { ok: false, error: `Model call failed (HTTP ${response.status})` };
      }
    }

    if (!response.ok) {
      const text = await response.text();
      await logCall(input, modelName, inputHash, null, 0, 0, 0, Date.now() - start, `HTTP ${response.status}: ${text}`);
      return { ok: false, error: `Model call failed (HTTP ${response.status})` };
    }

    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content ?? "{}";
    const json = JSON.parse(content);
    const promptTokens = body?.usage?.prompt_tokens ?? 0;
    const completionTokens = body?.usage?.completion_tokens ?? 0;
    const price = input.priceOverride ?? (await rolePrice(input.role));
    // price.in/out are USD cents per 1M tokens, so this is a cost in
    // (fractional) USD cents - a real call typically costs a small
    // fraction of one cent. Rounding straight to whole cents here (the
    // previous behaviour) truncated every normal call to 0 and made total
    // spend display as "$0.00" even after dozens of real calls - see
    // ./money.ts for the fix (store in finer-grained "stored units").
    const costEstimateCents = (promptTokens / 1_000_000) * price.in + (completionTokens / 1_000_000) * price.out;
    const costEstimatePence = fractionalCentsToStoredUnits(costEstimateCents);
    const latencyMs = Date.now() - start;

    await logCall(input, modelName, inputHash, json, promptTokens, completionTokens, costEstimatePence, latencyMs, null);

    return { ok: true, json, promptTokens, completionTokens, costEstimatePence, latencyMs, modelName };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown model call error";
    await logCall(input, modelName, inputHash, null, 0, 0, 0, Date.now() - start, message);
    return { ok: false, error: message };
  }
}

async function logCall(
  input: DrafterChatCallInput,
  modelName: string,
  inputHash: string,
  output: unknown,
  promptTokens: number,
  completionTokens: number,
  costEstimatePence: number,
  latencyMs: number,
  error: string | null
): Promise<void> {
  await query(
    `INSERT INTO drafter_model_calls
      (role, model_name, prompt_version, input_hash, output, prompt_tokens, completion_tokens, cost_estimate_pence, latency_ms, pra_id, enhancement_id, error)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      input.role,
      modelName,
      input.promptVersion,
      inputHash,
      output ? JSON.stringify(output) : null,
      promptTokens,
      completionTokens,
      costEstimatePence,
      latencyMs,
      input.praId ?? null,
      input.enhancementId ?? null,
      error,
    ]
  );
}
