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
    description:
      "Assesses the CONTROL TEXT ONLY (never the rationale). Judge the text AS A WHOLE: pass when it describes at least one concrete working step (who does what, when or to what) somewhere in it - a policy-flavoured sentence sitting alongside a described mechanism does not make it fail. Fail ONLY when the text, taken as a whole, merely states that a policy, standard, commitment or expectation exists, with no working step anywhere.",
  },
  {
    key: "trigger_actor_action_outcome",
    label: "Trigger, actor, action and outcome present",
    critical: true,
    description:
      "Computed deterministically from the `extraction` fields against the control text - your quote/pass/reason for THIS criterion are ignored. Still fill the `extraction` object carefully; it is what decides this criterion.",
  },
  {
    key: "rationale_explains_risk",
    label: "Rationale explains risk, not a register gap",
    critical: true,
    description: "Assesses the RATIONALE ONLY. The rationale explains the risk being addressed and the design choice, in 2 to 4 sentences, without describing a register gap or opening with a standard's name.",
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
    description:
      "Computed deterministically from the `extraction` fields against the section title - your quote/pass/reason for THIS criterion are ignored (used only as a fallback when the section title cannot be parsed). Still fill the `extraction` classifications carefully; they are what decide this criterion.",
  },
];

const CRITERION_KEYS = new Set(JUDGE_CRITERIA.map((c) => c.key));

/** The two criteria computed deterministically in code - see JUDGE-CRITERIA descriptions and evaluateTriggerActorActionOutcome/evaluateCorrectSection below. The model's own quote/pass/reason for these is recorded but never used. */
const DETERMINISTIC_CRITERION_KEYS = new Set(["trigger_actor_action_outcome", "correct_section"]);

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

export type LifecycleStage = "onboarding" | "ongoing_monitoring" | "periodic_review" | "exit" | "unspecified";
export type CustomerTypeExtraction = "natural_person" | "legal_person" | "both" | "unspecified";
export type TopicExtraction = "correspondent_banking" | "other";

/**
 * Filled by the judge model from the CONTROL TEXT ONLY (never the
 * rationale, never the section title) - the raw material the two
 * deterministic criteria below are computed FROM in code, rather than
 * trusted as a verdict. `trigger`/`actor`/`action`/`outcome` are verbatim
 * quotes (or null when the text does not state that element);
 * `lifecycleStage`/`customerType`/`topic` are classifications, each with its
 * own supporting verbatim quote (or null when unspecified/other).
 */
export interface JudgeExtraction {
  trigger: string | null;
  actor: string | null;
  action: string | null;
  outcome: string | null;
  lifecycleStage: LifecycleStage;
  lifecycleStageQuote: string | null;
  customerType: CustomerTypeExtraction;
  customerTypeQuote: string | null;
  topic: TopicExtraction;
  topicQuote: string | null;
}

export interface JudgeResult {
  criteria: Record<string, JudgeCriterionResult>;
  overall: "pass" | "fail";
  modelName: string;
  promptVersion: string;
  extraction?: JudgeExtraction;
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
Section: 2.1 Customer Due Diligence · Onboarding · Legal Person
Correct JSON response:
{"extraction": {
  "trigger": "any match", "actor": "a compliance officer", "action": "confirms any match", "outcome": "before the customer is activated",
  "lifecycle_stage": {"value": "onboarding", "quote": "before an account is opened"},
  "customer_type": {"value": "legal_person", "quote": "each new corporate customer"},
  "topic": {"value": "other", "quote": null}
},
"criteria": {
  "mechanism_not_policy_restatement": {"quote": "The onboarding system checks each new corporate customer against the sanctions list before an account is opened, and a compliance officer confirms any match before the customer is activated.", "pass": true, "reason": "Describes the actual check and confirmation steps, not just that a policy exists.", "suggested_rewrite": null},
  "trigger_actor_action_outcome": {"quote": "a compliance officer confirms any match before the customer is activated", "pass": true, "reason": "Trigger (a match), actor (compliance officer), action (confirms) and outcome (activation gated) are all present.", "suggested_rewrite": null},
  "rationale_explains_risk": {"quote": "This control addresses the risk of onboarding a sanctioned entity by stopping activation until a human has confirmed the automated check, rather than relying on the screening tool alone.", "pass": true, "reason": "States the risk and the design choice in one sentence, not a register gap.", "suggested_rewrite": null},
  "scope_stated": {"quote": "each new corporate customer", "pass": true, "reason": "Scope (corporate customers) is stated.", "suggested_rewrite": null},
  "tone_measured": {"quote": "The onboarding system checks each new corporate customer against the sanctions list before an account is opened", "pass": true, "reason": "Plain, measured description, no hyperbole.", "suggested_rewrite": null},
  "correct_section": {"quote": "each new corporate customer", "pass": true, "reason": "Fits Customer Due Diligence at onboarding for a legal person.", "suggested_rewrite": null}
}}
Notice every "quote" (in extraction or criteria) is copied character-for-character from the control text or rationale above - never paraphrased, shortened with "...", or invented. A passing criterion quotes the sentence that satisfies it; a failing criterion quotes the sentence that is the problem, and gives a suggested_rewrite. Your own verdict for trigger_actor_action_outcome and correct_section is recorded but NOT used - the platform computes those two deterministically from your extraction - so get the extraction right rather than the verdict.`;

export function buildJudgePrompt(input: JudgePromptInput): BuiltJudgePrompt {
  const system = [
    "You are reviewing ONE control enhancement written for a Financial Crime Product Risk Assessment (PRA), against a fixed style/structure rubric. You judge style and structure only - never facts, numbers or whether the control is needed.",
    "First, fill an `extraction` object from the CONTROL TEXT ONLY (never the rationale, never the section title): `trigger`, `actor`, `action`, `outcome` are each either an exact verbatim quote from the control text, or null when the text does not state that element.",
    "- `trigger`: the condition, event or timing that starts the control - e.g. 'When a customer is onboarded', 'Before the account is activated', 'Each week', 'If a match is found'. Look for a leading time/condition clause even when it is short.",
    "- `actor`: who or what system performs the action - e.g. 'a compliance officer', 'the screening system', 'a CDD analyst'.",
    "- `action`: the concrete step the actor takes - e.g. 'confirms the alert', 'reviews the file'.",
    "- `outcome`: the result the action produces - e.g. 'before the customer is activated', 'the relationship is declined', 'the risk assessment is updated'.",
    "Then classify `lifecycle_stage` (one of onboarding | ongoing_monitoring | periodic_review | exit | unspecified), `customer_type` (one of natural_person | legal_person | both | unspecified) and `topic` (one of correspondent_banking | other) as the text itself states or implies them - each with its own supporting verbatim quote from the control text (null when the value is unspecified/other and there is nothing to quote). Use `unspecified`/`other` honestly rather than guessing.",
    "For EACH of the 6 criteria below, return, in this exact field order: the exact sentence you quote from the control text or rationale as your evidence (quote first), then pass/fail, then your reason, then a suggested rewrite (only when failing; null when passing). Two of the six (trigger_actor_action_outcome, correct_section) are recorded but your verdict is IGNORED - the platform computes them deterministically from your `extraction` - so still fill them in the same shape, but your care should go into the extraction, not into second-guessing those two verdicts.",
    "The quote MUST be copied verbatim, character-for-character, from the control text or rationale given to you - the same words, spacing and punctuation, not a paraphrase, summary or partial fragment stitched together with '...'. Whether the criterion passes or fails, quote the actual sentence that is your evidence: for a PASS, quote the sentence that satisfies the criterion; for a FAIL, quote the sentence that is the problem.",
    "Never quote something that is not in the text given to you.",
    "A FAILING criterion must include a suggested_rewrite, UNLESS the only fix is a fact you were not given (a number, frequency, role or system name the text needs but the inputs do not supply) - in that case suggested_rewrite is null and the reason names exactly which fact is missing, so the user knows what to add.",
    "A suggested_rewrite must never invent or fill in a number, frequency, duration, threshold, role or system name that is not already in the control text, rationale or the inputs you were given - keep any existing bracketed placeholder (e.g. \"[frequency]\") in the rewrite exactly as a placeholder rather than filling it with a guessed fact.",
    "Criteria (exactly these 6 keys, no others):",
    ...JUDGE_CRITERIA.map((c, i) => `${i + 1}. ${c.key}: ${c.description}`),
    "Style rules the enhancement should already follow:",
    ...input.styleRules.map((r, i) => `${i + 1}. ${r}`),
    WORKED_EXAMPLE,
    'Respond with JSON only, in exactly this shape (both top-level keys present, no extra keys, no markdown fencing): {"extraction": {"trigger": string|null, "actor": string|null, "action": string|null, "outcome": string|null, "lifecycle_stage": {"value": "onboarding"|"ongoing_monitoring"|"periodic_review"|"exit"|"unspecified", "quote": string|null}, "customer_type": {"value": "natural_person"|"legal_person"|"both"|"unspecified", "quote": string|null}, "topic": {"value": "correspondent_banking"|"other", "quote": string|null}}, "criteria": {"mechanism_not_policy_restatement": {"quote": string, "pass": boolean, "reason": string, "suggested_rewrite": string|null}, "trigger_actor_action_outcome": {...same shape...}, "rationale_explains_risk": {...}, "scope_stated": {...}, "tone_measured": {...}, "correct_section": {...}}}.',
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

  const classificationSchema = (values: string[]) => ({
    type: "object",
    properties: {
      value: { type: "string", enum: values },
      quote: { type: ["string", "null"] },
    },
    required: ["value", "quote"],
    additionalProperties: false,
  });

  const extractionSchema = {
    type: "object",
    properties: {
      trigger: { type: ["string", "null"] },
      actor: { type: ["string", "null"] },
      action: { type: ["string", "null"] },
      outcome: { type: ["string", "null"] },
      lifecycle_stage: classificationSchema(["onboarding", "ongoing_monitoring", "periodic_review", "exit", "unspecified"]),
      customer_type: classificationSchema(["natural_person", "legal_person", "both", "unspecified"]),
      topic: classificationSchema(["correspondent_banking", "other"]),
    },
    required: ["trigger", "actor", "action", "outcome", "lifecycle_stage", "customer_type", "topic"],
    additionalProperties: false,
  };

  return {
    name: "pra_judge_result",
    strict: true,
    schema: {
      type: "object",
      properties: {
        extraction: extractionSchema,
        criteria: {
          type: "object",
          properties,
          required: JUDGE_CRITERIA.map((c) => c.key),
          additionalProperties: false,
        },
      },
      required: ["extraction", "criteria"],
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
  extraction: JudgeExtraction;
}

const LIFECYCLE_STAGES: LifecycleStage[] = ["onboarding", "ongoing_monitoring", "periodic_review", "exit", "unspecified"];
const CUSTOMER_TYPES: CustomerTypeExtraction[] = ["natural_person", "legal_person", "both", "unspecified"];
const TOPICS: TopicExtraction[] = ["correspondent_banking", "other"];

/**
 * Structurally validates the judge's `extraction` object: every key
 * present, correct types, enum values in range. Deliberately does NOT
 * verbatim-check `trigger`/`actor`/`action`/`outcome` against the control
 * text here - a hallucinated (non-verbatim) extraction quote is not treated
 * as an invalid/unusable response, it is treated as a FAILED
 * trigger_actor_action_outcome criterion (computed by
 * `evaluateTriggerActorActionOutcome`), so a model that extracts confidently
 * but wrongly still gets a real (failing) verdict rather than a discarded
 * review.
 */
function parseExtraction(raw: unknown): JudgeExtraction | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Judge response was missing an `extraction` object." };
  const body = raw as Record<string, unknown>;

  const stringOrNull = (v: unknown): string | null | undefined => {
    if (v === null) return null;
    if (typeof v === "string") return v.trim() ? v : null;
    return undefined;
  };

  const trigger = stringOrNull(body.trigger);
  const actor = stringOrNull(body.actor);
  const action = stringOrNull(body.action);
  const outcome = stringOrNull(body.outcome);
  if (trigger === undefined || actor === undefined || action === undefined || outcome === undefined) {
    return { error: "Extraction's trigger/actor/action/outcome must each be a string or null." };
  }

  function parseClassification<T extends string>(key: string, allowed: T[]): { value: T; quote: string | null } | { error: string } {
    const entry = body[key];
    if (!entry || typeof entry !== "object") return { error: `Extraction's "${key}" must be an object.` };
    const e = entry as Record<string, unknown>;
    const value = e.value;
    if (typeof value !== "string" || !allowed.includes(value as T)) {
      return { error: `Extraction's "${key}.value" must be one of ${allowed.join(", ")}.` };
    }
    const quote = stringOrNull(e.quote);
    if (quote === undefined) return { error: `Extraction's "${key}.quote" must be a string or null.` };
    return { value: value as T, quote };
  }

  const lifecycle = parseClassification("lifecycle_stage", LIFECYCLE_STAGES);
  if ("error" in lifecycle) return lifecycle;
  const customer = parseClassification("customer_type", CUSTOMER_TYPES);
  if ("error" in customer) return customer;
  const topic = parseClassification("topic", TOPICS);
  if ("error" in topic) return topic;

  return {
    trigger,
    actor,
    action,
    outcome,
    lifecycleStage: lifecycle.value,
    lifecycleStageQuote: lifecycle.quote,
    customerType: customer.value,
    customerTypeQuote: customer.quote,
    topic: topic.value,
    topicQuote: topic.quote,
  };
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
  const body = raw as { criteria?: unknown; extraction?: unknown };

  const extraction = parseExtraction(body.extraction);
  if ("error" in extraction) return { ok: false, reason: extraction.error };

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
    // trigger_actor_action_outcome and correct_section are computed IN CODE
    // from `extraction` - the model's own quote/pass/reason for these two
    // is recorded but never used (see applyDeterministicCriteria in
    // judge-runner.ts). Its natural evidence for correct_section is often
    // the SECTION TITLE, which is not part of `judgedText` - verbatim-
    // checking a field nobody reads would invalidate an otherwise-good
    // response over a criterion that can't fail the review. Still requires
    // a non-empty string (structural), just not verbatim-checked.
    if (!DETERMINISTIC_CRITERION_KEYS.has(def.key) && !isVerbatimQuote(judgedText, quote)) {
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

  return { ok: true, criteria: result, overall, extraction };
}

// --- Deterministic criteria (SPEC: "code does everything that can be done
// deterministically") -------------------------------------------------

export interface ParsedSectionTitle {
  stage: LifecycleStage;
  customerType: CustomerTypeExtraction;
  correspondentBanking: boolean;
}

function parseStage(raw: string): LifecycleStage | null {
  switch (raw.trim().toLowerCase()) {
    case "onboarding":
      return "onboarding";
    case "ongoing monitoring":
      return "ongoing_monitoring";
    case "periodic review":
      return "periodic_review";
    case "exit":
      return "exit";
    default:
      return null;
  }
}

function parseCustomerType(raw: string): CustomerTypeExtraction | null {
  switch (raw.trim().toLowerCase()) {
    case "natural person":
      return "natural_person";
    case "legal person":
      return "legal_person";
    case "both":
      return "both";
    default:
      return null;
  }
}

/**
 * Parses a section title of the form "N.N Topic · Stage · Customer type"
 * (e.g. "2.4 Correspondent Banking Due Diligence · Onboarding · Legal
 * Person"). Returns null when the title does not have this shape or its
 * stage/customer-type segment is not one of the recognised values - callers
 * must fall back to the model's own verdict in that case, never guess.
 */
export function parseSectionTitle(title: string): ParsedSectionTitle | null {
  const parts = title.split("·").map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length !== 3) return null;
  const [topicPart, stagePart, customerPart] = parts;
  const stage = parseStage(stagePart);
  const customerType = parseCustomerType(customerPart);
  if (!stage || !customerType) return null;
  return { stage, customerType, correspondentBanking: /correspondent banking/i.test(topicPart) };
}

/** A text's lifecycle stage is compatible with a section's stage per SPEC: periodic_review and exit both sit comfortably under an "Ongoing Monitoring" section. */
function stageCompatible(textStage: LifecycleStage, sectionStage: LifecycleStage): boolean {
  if (textStage === sectionStage) return true;
  if (sectionStage === "ongoing_monitoring" && (textStage === "periodic_review" || textStage === "exit")) return true;
  return false;
}

/**
 * trigger_actor_action_outcome, computed IN CODE from the judge's
 * `extraction` (never the model's own verdict for this criterion): passes
 * only when all four of trigger/actor/action/outcome are present AND each
 * is a verbatim quote from the CONTROL TEXT. Naming the missing/bad
 * element(s) in the reason, per the task brief.
 */
export function evaluateTriggerActorActionOutcome(extraction: JudgeExtraction, controlText: string): JudgeCriterionResult {
  const fields: Array<{ key: "trigger" | "actor" | "action" | "outcome"; label: string }> = [
    { key: "trigger", label: "trigger" },
    { key: "action", label: "action" },
    { key: "actor", label: "actor" },
    { key: "outcome", label: "outcome" },
  ];

  const missing: string[] = [];
  const notVerbatim: string[] = [];
  const validQuotes: string[] = [];

  for (const f of fields) {
    const value = extraction[f.key];
    if (!value || !value.trim()) {
      missing.push(f.label);
      continue;
    }
    if (!isVerbatimQuote(controlText, value)) {
      notVerbatim.push(f.label);
      continue;
    }
    validQuotes.push(value);
  }

  const pass = missing.length === 0 && notVerbatim.length === 0;
  const quote = validQuotes[0] ?? extraction.trigger ?? extraction.actor ?? extraction.action ?? extraction.outcome ?? "(not stated in the control text)";

  let reason: string;
  if (pass) {
    reason = `Trigger (${extraction.trigger}), actor (${extraction.actor}), action (${extraction.action}) and outcome (${extraction.outcome}) are all present and verbatim in the control text.`;
  } else {
    const parts: string[] = [];
    if (missing.length) parts.push(`missing ${missing.join(", ")}`);
    if (notVerbatim.length) parts.push(`extracted ${notVerbatim.join(", ")} not found verbatim in the control text`);
    reason = `Control text is ${parts.join("; ")}.`;
  }

  return { quote, pass, reason, suggestedRewrite: null };
}

/**
 * correct_section, computed IN CODE from the judge's `extraction` and the
 * parsed section title - the model's own verdict for this criterion is
 * ignored, except as a fallback when the title cannot be parsed. CDD vs EDD
 * wording is never compared (only lifecycle stage / customer type / the
 * correspondent-banking topic flag), per SPEC "EDD controls can sit under
 * the customer-type CDD section".
 */
export function evaluateCorrectSection(
  extraction: JudgeExtraction,
  sectionTitle: string,
  modelCriterion: JudgeCriterionResult
): JudgeCriterionResult {
  const parsed = parseSectionTitle(sectionTitle);
  if (!parsed) return modelCriterion;

  const mismatches: string[] = [];
  let mismatchQuote: string | null = null;

  if (extraction.lifecycleStage !== "unspecified" && !stageCompatible(extraction.lifecycleStage, parsed.stage)) {
    mismatches.push(`the text's lifecycle stage (${extraction.lifecycleStage}) does not fit the section's stage (${parsed.stage})`);
    mismatchQuote = mismatchQuote ?? extraction.lifecycleStageQuote;
  }

  if (
    extraction.customerType !== "unspecified" &&
    extraction.customerType !== "both" &&
    parsed.customerType !== "both" &&
    extraction.customerType !== parsed.customerType
  ) {
    mismatches.push(`the text's customer type (${extraction.customerType}) does not fit the section's customer type (${parsed.customerType})`);
    mismatchQuote = mismatchQuote ?? extraction.customerTypeQuote;
  }

  const textIsCorrespondent = extraction.topic === "correspondent_banking";
  if (textIsCorrespondent !== parsed.correspondentBanking) {
    mismatches.push(
      textIsCorrespondent
        ? "the text describes correspondent banking but the section is not a correspondent banking section"
        : "the section is a correspondent banking section but the text does not describe correspondent banking"
    );
    mismatchQuote = mismatchQuote ?? extraction.topicQuote;
  }

  const pass = mismatches.length === 0;
  const quote = pass ? modelCriterion.quote : mismatchQuote ?? modelCriterion.quote;
  const reason = pass ? "Lifecycle stage, customer type and topic all fit the stated section." : `Wrong section: ${mismatches.join("; ")}.`;

  return { quote, pass, reason, suggestedRewrite: pass ? null : modelCriterion.suggestedRewrite };
}
