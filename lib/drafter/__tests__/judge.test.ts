import { describe, it, expect } from "vitest";
import { buildJudgePrompt, buildJudgeRepairPrompt, buildJudgeJsonSchema, isVerbatimQuote, validateJudgeOutput, JUDGE_CRITERIA } from "../judge";

describe("buildJudgePrompt", () => {
  it("puts the quote field before the verdict field in the schema instructions", () => {
    const { system } = buildJudgePrompt({ controlText: "x", rationale: "y", sectionTitle: "2.1 CDD", styleRules: [] });
    const quoteIndex = system.indexOf('"quote"');
    const passIndex = system.indexOf('"pass"');
    expect(quoteIndex).toBeGreaterThan(-1);
    expect(passIndex).toBeGreaterThan(-1);
    expect(quoteIndex).toBeLessThan(passIndex);
  });

  it("lists all 6 SPEC.md criteria", () => {
    expect(JUDGE_CRITERIA).toHaveLength(6);
    expect(JUDGE_CRITERIA.filter((c) => c.critical).map((c) => c.key)).toEqual([
      "mechanism_not_policy_restatement",
      "trigger_actor_action_outcome",
      "rationale_explains_risk",
      "correct_section",
    ]);
  });
});

function fullPassResponse(text: string) {
  const entry = { quote: text, pass: true, reason: "ok", suggested_rewrite: null };
  return { criteria: Object.fromEntries(JUDGE_CRITERIA.map((c) => [c.key, { ...entry }])) };
}

describe("validateJudgeOutput", () => {
  const text = "The system screens every relationship before onboarding.";

  it("accepts a full pass with quotes found in the text", () => {
    const result = validateJudgeOutput(fullPassResponse(text), text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.overall).toBe("pass");
  });

  it("fails overall when a critical criterion fails, even if non-critical ones pass", () => {
    const raw = fullPassResponse(text);
    (raw.criteria as Record<string, { pass: boolean }>).correct_section.pass = false;
    const result = validateJudgeOutput(raw, text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.overall).toBe("fail");
  });

  it("passes overall (minor) when only a non-critical criterion fails", () => {
    const raw = fullPassResponse(text);
    (raw.criteria as Record<string, { pass: boolean }>).tone_measured.pass = false;
    const result = validateJudgeOutput(raw, text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.overall).toBe("pass");
      expect(result.criteria.tone_measured.pass).toBe(false);
    }
  });

  it("is invalid (never a pass) when a quote is not found verbatim in the text", () => {
    const raw = fullPassResponse(text);
    (raw.criteria as Record<string, { quote: string }>).scope_stated.quote = "this sentence does not appear anywhere";
    const result = validateJudgeOutput(raw, text);
    expect(result.ok).toBe(false);
  });

  it("is invalid when an unknown criterion is present", () => {
    const raw = fullPassResponse(text) as { criteria: Record<string, unknown> };
    raw.criteria.made_up_criterion = { quote: text, pass: true, reason: "x", suggested_rewrite: null };
    const result = validateJudgeOutput(raw, text);
    expect(result.ok).toBe(false);
  });

  it("is invalid when a criterion is missing", () => {
    const raw = fullPassResponse(text) as { criteria: Record<string, unknown> };
    delete raw.criteria.tone_measured;
    const result = validateJudgeOutput(raw, text);
    expect(result.ok).toBe(false);
  });

  it("is invalid on a non-object / malformed shape", () => {
    expect(validateJudgeOutput(null, text).ok).toBe(false);
    expect(validateJudgeOutput("not an object", text).ok).toBe(false);
    expect(validateJudgeOutput({}, text).ok).toBe(false);
  });

  it("is invalid when a quote is missing or empty", () => {
    const raw = fullPassResponse(text);
    (raw.criteria as Record<string, { quote: string }>).scope_stated.quote = "";
    expect(validateJudgeOutput(raw, text).ok).toBe(false);
  });
});

describe("isVerbatimQuote (defect: judge quote-matching too strict on cosmetic re-typing)", () => {
  const text = "The system checks each customer's file before onboarding is confirmed.";

  it("matches an exact substring", () => {
    expect(isVerbatimQuote(text, "checks each customer's file")).toBe(true);
  });

  it("matches when the model re-typed a smart apostrophe or smart quotes", () => {
    expect(isVerbatimQuote(text, "checks each customer’s file")).toBe(true);
  });

  it("matches when the model collapsed/expanded whitespace", () => {
    expect(isVerbatimQuote(text, "checks each  customer's   file")).toBe(true);
  });

  it("matches a quote missing the source's trailing punctuation", () => {
    expect(isVerbatimQuote(text, "before onboarding is confirmed")).toBe(true);
  });

  it("still rejects a paraphrase or a fragment not actually present", () => {
    expect(isVerbatimQuote(text, "the customer is checked before being let in")).toBe(false);
  });

  it("still rejects an empty quote", () => {
    expect(isVerbatimQuote(text, "")).toBe(false);
  });
});

describe("buildJudgeJsonSchema", () => {
  it("requires all 6 criterion keys with no additional properties, for strict structured output", () => {
    const schema = buildJudgeJsonSchema();
    expect(schema.strict).toBe(true);
    const properties = schema.schema.properties as { criteria: { required: string[]; additionalProperties: boolean } };
    const criteriaSchema = properties.criteria;
    expect(criteriaSchema.required).toEqual(JUDGE_CRITERIA.map((c) => c.key));
    expect(criteriaSchema.additionalProperties).toBe(false);
  });
});

describe("buildJudgeRepairPrompt", () => {
  it("includes the validation error and the previous response so the model can fix the specific problem", () => {
    const input = { controlText: "x", rationale: "y", sectionTitle: "2.1 CDD", styleRules: [] };
    const { user } = buildJudgeRepairPrompt(input, '{"criteria": {}}', 'Judge response is missing criterion "tone_measured".');
    expect(user).toContain('Judge response is missing criterion "tone_measured".');
    expect(user).toContain('{"criteria": {}}');
  });
});
