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
export function buildJudgePrompt(input: JudgePromptInput): BuiltJudgePrompt {
  const system = [
    "You are reviewing ONE control enhancement written for a Financial Crime Product Risk Assessment (PRA), against a fixed style/structure rubric. You judge style and structure only - never facts, numbers or whether the control is needed.",
    "For EACH of the 6 criteria below, return, in this exact field order: the exact sentence you quote from the control text or rationale as your evidence (quote first), then pass/fail, then your reason, then a suggested rewrite (only when failing; null when passing).",
    "The quote MUST be an exact, verbatim substring of the control text or rationale given to you. Never quote something not in the text.",
    "Criteria:",
    ...JUDGE_CRITERIA.map((c, i) => `${i + 1}. ${c.key}: ${c.description}`),
    "Style rules the enhancement should already follow:",
    ...input.styleRules.map((r, i) => `${i + 1}. ${r}`),
    'Respond with JSON only, in this exact shape: {"criteria": {"<criterion_key>": {"quote": string, "pass": boolean, "reason": string, "suggested_rewrite": string|null}, ...one entry per criterion...}}. Use exactly the criterion keys given above, no others.',
  ].join("\n");

  const user = [
    `Section: ${input.sectionTitle}`,
    `Control text: ${input.controlText}`,
    `Rationale: ${input.rationale}`,
  ].join("\n\n");

  return { system, user };
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
    if (!judgedText.includes(quote)) {
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
