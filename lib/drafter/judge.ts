/**
 * Judge rubric (SPEC.md "Reviewer" - judge model, one call per enhancement).
 * Pure prompt-building and output-validation, no DB/model access - see
 * lib/drafter/judge-runner.ts for the DB-touching orchestration, matching
 * the draft-enhancement.ts / prompts.ts split.
 *
 * Rubric = the 6 SPEC.md criteria, with the critical flags SPEC.md gives:
 *
 * | Criterion                                   | Critical |
 * |----------------------------------------------|----------|
 * | mechanism_not_policy_restatement              | Yes      |
 * | trigger_actor_action_outcome                  | Yes      |
 * | rationale_explains_risk                       | Yes      |
 * | scope_stated                                  | No       |
 * | tone_measured                                 | No       |
 * | correct_section                               | Yes      |
 *
 * The judge checks style/structure only - it never re-checks facts (that is
 * the deterministic fact boundary's job) and it runs AFTER lint, per
 * SPEC.md "Every enhancement passes two checks ... code lint first, then a
 * judge model."
 */

export interface JudgeCriterionDef {
  key: string;
  label: string;
  critical: boolean;
  description: string;
}

export const JUDGE_CRITERIA: JudgeCriterionDef[] = [
  {
    key: "mechanism_not_policy_restatement",
    label: "Describes a mechanism, not a policy restatement",
    critical: true,
    description: "The text describes how the control actually works, not merely that a policy or procedure exists.",
  },
  {
    key: "trigger_actor_action_outcome",
    label: "Trigger, actor, action and outcome present",
    critical: true,
    description: "The text states what triggers the control, who/what acts, what the action is, and the resulting outcome.",
  },
  {
    key: "rationale_explains_risk",
    label: "Rationale explains risk, not a register gap",
    critical: true,
    description: "The rationale explains the risk being addressed and the design choice, in 2 to 4 sentences, without describing a register gap or opening with a standard's name.",
  },
  {
    key: "scope_stated",
    label: "Scope stated",
    critical: false,
    description: "The scope (who/what the control applies to) is stated, as a short list when there are several cases.",
  },
  {
    key: "tone_measured",
    label: "Tone measured",
    critical: false,
    description: "The tone is measured - no hyperbole, banned phrases or exaggerated claims.",
  },
  {
    key: "correct_section",
    label: "Sits under the right section",
    critical: true,
    description: "The control text and rationale fit the stated section (customer type / lifecycle stage), not a different one.",
  },
];

const CRITERION_KEYS = new Set(JUDGE_CRITERIA.map((c) => c.key));

export interface JudgeCriterionResult {
  quote: string;
  pass: boolean;
  reason: string;
  suggestedRewrite: string | null;
  /**
   * True when the fact boundary changed `suggestedRewrite` after the judge
   * returned it (an unsupported number/frequency/duration replaced with a
   * bracketed placeholder, per BUILD-DECISIONS "Fact boundary"). The panel
   * must show this, never apply the raw model rewrite silently.
   */
  rewriteAdjusted?: boolean;
  /** Roles/system names in the rewrite not present in the enhancement's inputs - flagged, never silently trusted or silently stripped. */
  rewriteFlags?: string[];
}

export interface JudgeResult {
  criteria: Record<string, JudgeCriterionResult>;
  overall: "pass" | "fail";
  modelName: string;
  promptVersion: string;
}

export interface JudgePromptInput {
  controlText: string;
  rationale: string;
  sectionTitle: string;
  styleRules: string[];
}

export interface BuiltJudgePrompt {
  system: string;
  user: string;
}

/**
 * The quote comes BEFORE the verdict in the JSON schema/prompt, per
 * SPEC.md "The quote comes before the verdict in the output" - this is
 * asked for explicitly (schema field order in the instructions) so the
 * model reasons from evidence to verdict, not the reverse.
 */
const WORKED_EXAMPLE = `Worked example.
Control text: "The onboarding system checks each new corporate customer against the sanctions list before an account is opened, and a compliance officer confirms any match before the customer is activated."
Rationale: "This control addresses the risk of onboarding a sanctioned entity by stopping activation until a human has confirmed the automated check, rather than relying on the screening tool alone."
Section: 2.1 Customer Due Diligence
Correct JSON response:
{"criteria": {
  "mechanism_not_policy_restatement": {"quote": "The onboarding system checks each new corporate customer against the sanctions list before an account is opened, and a compliance officer confirms any match before the customer is activated.", "pass": true, "reason": "Describes the actual check and confirmation steps, not just that a policy exists.", "suggested_rewrite": null},
  "trigger_actor_action_outcome": {"quote": "a compliance officer confirms any match before the customer is activated", "pass": true, "reason": "Trigger (a match), actor (compliance officer), action (confirms) and outcome (activation gated) are all present.", "suggested_rewrite": null},
  "rationale_explains_risk": {"quote": "This control addresses the risk of onboarding a sanctioned entity by stopping activation until a human has confirmed the automated check, rather than relying on the screening tool alone.", "pass": true, "reason": "States the risk and the design choice in one sentence, not a register gap.", "suggested_rewrite": null},
  "scope_stated": {"quote": "each new corporate customer", "pass": true, "reason": "Scope (corporate customers) is stated.", "suggested_rewrite": null},
  "tone_measured": {"quote": "The onboarding system checks each new corporate customer against the sanctions list before an account is opened", "pass": true, "reason": "Plain, measured description, no hyperbole.", "suggested_rewrite": null},
  "correct_section": {"quote": "The onboarding system checks each new corporate customer against the sanctions list before an account is opened", "pass": true, "reason": "Fits Customer Due Diligence at onboarding.", "suggested_rewrite": null}
}}
Notice every "quote" is copied character-for-character from the control text or rationale above - never paraphrased, shortened with "...", or invented. A passing criterion quotes the sentence that satisfies it; a failing criterion quotes the sentence that is the problem, and gives a suggested_rewrite.`;

export function buildJudgePrompt(input: JudgePromptInput): BuiltJudgePrompt {
  const system = [
    "You are reviewing ONE control enhancement written for a Financial Crime Product Risk Assessment (PRA), against a fixed style/structure rubric. You judge style and structure only - never facts, numbers or whether the control is needed.",
    "For EACH of the 6 criteria below, return, in this exact field order: the exact sentence you quote from the control text or rationale as your evidence (quote first), then pass/fail, then your reason, then a suggested rewrite (only when failing; null when passing).",
    "The quote MUST be copied verbatim, character-for-character, from the control text or rationale given to you - the same words, spacing and punctuation, not a paraphrase, summary or partial fragment stitched together with '...'. Whether the criterion passes or fails, quote the actual sentence that is your evidence: for a PASS, quote the sentence that satisfies the criterion; for a FAIL, quote the sentence that is the problem.",
    "Never quote something that is not in the text given to you.",
    "A FAILING criterion must include a suggested_rewrite, UNLESS the only fix is a fact you were not given (a number, frequency, role or system name the text needs but the inputs do not supply) - in that case suggested_rewrite is null and the reason names exactly which fact is missing, so the user knows what to add.",
    "A suggested_rewrite must never invent or fill in a number, frequency, duration, threshold, role or system name that is not already in the control text, rationale or the inputs you were given - keep any existing bracketed placeholder (e.g. \"[frequency]\") in the rewrite exactly as a placeholder rather than filling it with a guessed fact.",
    "Criteria (exactly these 6 keys, no others):",
    ...JUDGE_CRITERIA.map((c, i) => `${i + 1}. ${c.key}: ${c.description}`),
    "Style rules the enhancement should already follow:",
    ...input.styleRules.map((r, i) => `${i + 1}. ${r}`),
    WORKED_EXAMPLE,
    'Respond with JSON only, in exactly this shape (all 6 keys present, no extra keys, no markdown fencing): {"criteria": {"mechanism_not_policy_restatement": {"quote": string, "pass": boolean, "reason": string, "suggested_rewrite": string|null}, "trigger_actor_action_outcome": {...same shape...}, "rationale_explains_risk": {...}, "scope_stated": {...}, "tone_measured": {...}, "correct_section": {...}}}.',
  ].join("\n");

  const user = [
    `Section: ${input.sectionTitle}`,
    `Control text: ${input.controlText}`,
    `Rationale: ${input.rationale}`,
  ].join("\n\n");

  return { system, user };
}

/**
 * One repair round (BUILD-DECISIONS/rehearsal fix): when the first judge
 * response fails `validateJudgeOutput`, re-ask ONCE with the specific
 * validation error and the previous (broken) response attached, asking the
 * model to return the complete corrected JSON. If the repaired response is
 * still invalid, judge-runner.ts leaves the result invalid - a repair
 * attempt never gets a free pass.
 */
export function buildJudgeRepairPrompt(input: JudgePromptInput, previousRawJson: string, validationError: string): BuiltJudgePrompt {
  const base = buildJudgePrompt(input);
  const user = [
    base.user,
    "Your previous response (below) was rejected as invalid. Return the COMPLETE corrected JSON in the exact same schema (all 6 criteria, quote before pass/fail) - fix the specific problem described, and re-check every quote is copied verbatim from the control text or rationale above.",
    `Validation error: ${validationError}`,
    `Previous (invalid) response: ${previousRawJson}`,
  ].join("\n\n");
  return { system: base.system, user };
}

/**
 * JSON Schema for the judge response, for providers that support
 * `response_format: {type: "json_schema", json_schema: {...}}` (structured
 * output) - falls back to `response_format: {type: "json_object"}` when a
 * provider rejects it (see llm.ts callDrafterModel). Strict mode + fixed
 * criterion keys removes the "missing a criteria object" / "unknown
 * criterion" / "missing a criterion key" failure modes seen in production
 * (minimax/minimax-m3 failed validation on 7/8 real enhancements) at the
 * source, rather than only catching them after the fact.
 */
export function buildJudgeJsonSchema(): { name: string; strict: boolean; schema: Record<string, unknown> } {
  const criterionSchema = {
    type: "object",
    properties: {
      quote: { type: "string" },
      pass: { type: "boolean" },
      reason: { type: "string" },
      suggested_rewrite: { type: ["string", "null"] },
    },
    required: ["quote", "pass", "reason", "suggested_rewrite"],
    additionalProperties: false,
  };
  const properties: Record<string, unknown> = {};
  for (const c of JUDGE_CRITERIA) properties[c.key] = criterionSchema;
  return {
    name: "pra_judge_result",
    strict: true,
    schema: {
      type: "object",
      properties: {
        criteria: {
          type: "object",
          properties,
          required: JUDGE_CRITERIA.map((c) => c.key),
          additionalProperties: false,
        },
      },
      required: ["criteria"],
      additionalProperties: false,
    },
  };
}

/**
 * Normalises whitespace and "smart" typographic quotes/apostrophes so a
 * quote that is verbatim in meaning but differs only in how a model
 * re-typed curly quotes or collapsed/expanded whitespace is not rejected as
 * fabricated. This is NOT fuzzy matching - it never accepts a paraphrase,
 * a shortened fragment, or a quote missing/adding actual words; it only
 * neutralises cosmetic re-typing on BOTH sides of the comparison.
 */
function normaliseForMatch(text: string): string {
  return text
    .replace(/[‘’ʼ‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Strips one trailing sentence-ending punctuation run, so a quote that omits (or adds) a trailing "." still matches - still an exact match of every word, just tolerant of where the sentence boundary punctuation landed. */
function stripTrailingPunctuation(text: string): string {
  return text.replace(/[.,;:!?]+$/, "").trim();
}

/**
 * True when `quote` is a verbatim (word-for-word) substring of `haystack`,
 * after normalising whitespace/smart-quotes on both sides and allowing a
 * trailing punctuation mismatch. Never a fuzzy/partial match - every other
 * character must agree exactly.
 */
export function isVerbatimQuote(haystack: string, quote: string): boolean {
  if (!quote || !quote.trim()) return false;
  const normalisedHaystack = normaliseForMatch(haystack);
  const normalisedQuote = normaliseForMatch(quote);
  if (normalisedHaystack.includes(normalisedQuote)) return true;
  const trimmedQuote = stripTrailingPunctuation(normalisedQuote);
  if (trimmedQuote && normalisedHaystack.includes(trimmedQuote)) return true;
  return false;
}

export interface JudgeValidationError {
  ok: false;
  reason: string;
}

export interface JudgeValidationOk {
  ok: true;
  criteria: Record<string, JudgeCriterionResult>;
  overall: "pass" | "fail";
}

/**
 * Validates a raw judge JSON response against the full text it was judging.
 * Per SPEC.md/BUILD-DECISIONS: unknown criteria, a missing quote, or a quote
 * that is not found verbatim in the judged text are all treated as a
 * FAILED/INVALID review - never silently treated as a pass. This is the
 * guard against "absence renders as a pass".
 */
export function validateJudgeOutput(raw: unknown, judgedText: string): JudgeValidationOk | JudgeValidationError {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "Judge response was not a JSON object." };
  const body = raw as { criteria?: unknown };
  if (!body.criteria || typeof body.criteria !== "object") {
    return { ok: false, reason: "Judge response was missing a `criteria` object." };
  }
  const criteriaRaw = body.criteria as Record<string, unknown>;
  const keys = Object.keys(criteriaRaw);

  // Every expected criterion must be present.
  for (const def of JUDGE_CRITERIA) {
    if (!(def.key in criteriaRaw)) {
      return { ok: false, reason: `Judge response is missing criterion "${def.key}".` };
    }
  }
  // No unknown criteria.
  for (const key of keys) {
    if (!CRITERION_KEYS.has(key)) {
      return { ok: false, reason: `Judge response included an unknown criterion "${key}".` };
    }
  }

  const result: Record<string, JudgeCriterionResult> = {};
  for (const def of JUDGE_CRITERIA) {
    const entry = criteriaRaw[def.key] as Record<string, unknown>;
    if (!entry || typeof entry !== "object") {
      return { ok: false, reason: `Criterion "${def.key}" was not an object.` };
    }
    const quote = entry.quote;
    if (typeof quote !== "string" || quote.trim().length === 0) {
      return { ok: false, reason: `Criterion "${def.key}" was missing a quote.` };
    }
    if (!isVerbatimQuote(judgedText, quote)) {
      return { ok: false, reason: `Criterion "${def.key}" quoted text not found verbatim in the enhancement: "${quote}".` };
    }
    const pass = entry.pass;
    if (typeof pass !== "boolean") {
      return { ok: false, reason: `Criterion "${def.key}" was missing a boolean pass/fail.` };
    }
    const reason = typeof entry.reason === "string" ? entry.reason : "";
    const suggestedRewrite = typeof entry.suggested_rewrite === "string" ? entry.suggested_rewrite : null;
    result[def.key] = { quote, pass, reason, suggestedRewrite };
  }

  // Overall pass only if every CRITICAL criterion passes.
  const overall: "pass" | "fail" = JUDGE_CRITERIA.every((def) => !def.critical || result[def.key].pass) ? "pass" : "fail";

  return { ok: true, criteria: result, overall };
}
