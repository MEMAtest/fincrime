import { describe, it, expect } from "vitest";
import {
  buildJudgePrompt,
  buildJudgeRepairPrompt,
  buildJudgeJsonSchema,
  isVerbatimQuote,
  validateJudgeOutput,
  parseSectionTitle,
  evaluateTriggerActorActionOutcome,
  evaluateCorrectSection,
  findTriggerClause,
  nonVerbatimExtractionFields,
  JUDGE_CRITERIA,
  type JudgeExtraction,
} from "../judge";

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

function nullExtractionRaw() {
  return {
    trigger: null,
    actor: null,
    action: null,
    outcome: null,
    lifecycle_stage: { value: "unspecified", quote: null },
    customer_type: { value: "unspecified", quote: null },
    topic: { value: "other", quote: null },
  };
}

function fullPassResponse(text: string) {
  const entry = { quote: text, pass: true, reason: "ok", suggested_rewrite: null };
  return {
    extraction: nullExtractionRaw(),
    criteria: Object.fromEntries(JUDGE_CRITERIA.map((c) => [c.key, { ...entry }])),
  };
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

describe("parseSectionTitle (deterministic correct_section)", () => {
  it("parses a well-formed title", () => {
    const parsed = parseSectionTitle("2.4 Correspondent Banking Due Diligence · Onboarding · Legal Person");
    expect(parsed).toEqual({ stage: "onboarding", customerType: "legal_person", correspondentBanking: true });
  });

  it("recognises 'Both' as a customer type", () => {
    const parsed = parseSectionTitle("2.3 Enhanced Due Diligence (EDD) · Ongoing Monitoring · Both");
    expect(parsed).toEqual({ stage: "ongoing_monitoring", customerType: "both", correspondentBanking: false });
  });

  it("returns null when the title cannot be split into exactly 3 parts", () => {
    expect(parseSectionTitle("2.1 Customer Due Diligence")).toBeNull();
  });

  it("returns null when the stage segment is not recognised", () => {
    expect(parseSectionTitle("2.1 Topic · Sometime · Both")).toBeNull();
  });

  it("returns null when the customer-type segment is not recognised", () => {
    expect(parseSectionTitle("2.1 Topic · Onboarding · Everyone")).toBeNull();
  });
});

function extraction(overrides: Partial<JudgeExtraction> = {}): JudgeExtraction {
  return {
    trigger: null,
    actor: null,
    action: null,
    outcome: null,
    lifecycleStage: "unspecified",
    lifecycleStageQuote: null,
    customerType: "unspecified",
    customerTypeQuote: null,
    topic: "other",
    topicQuote: null,
    ...overrides,
  };
}

describe("evaluateTriggerActorActionOutcome (computed in code, model verdict ignored)", () => {
  const controlText = "When a match is found, a compliance officer confirms the alert before the account is activated.";

  it("passes when all four are present and verbatim in the control text", () => {
    const result = evaluateTriggerActorActionOutcome(
      extraction({ trigger: "a match is found", actor: "a compliance officer", action: "confirms the alert", outcome: "the account is activated" }),
      controlText
    );
    expect(result.pass).toBe(true);
  });

  it("fails and names the missing element when one is not stated", () => {
    const result = evaluateTriggerActorActionOutcome(
      extraction({ trigger: "a match is found", actor: "a compliance officer", action: "confirms the alert", outcome: null }),
      controlText
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("outcome");
  });

  it("fails when an extracted quote is not actually verbatim in the control text (hallucinated extraction)", () => {
    const result = evaluateTriggerActorActionOutcome(
      extraction({ trigger: "a match is found", actor: "a compliance officer", action: "confirms the alert", outcome: "the customer receives a welcome email" }),
      controlText
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("outcome");
  });

  it("a contradictory model verdict for this criterion is never consulted - only the extraction decides", () => {
    // Same extraction, same verdict either way - proves the function's
    // signature does not even take the model's verdict as an input.
    const result = evaluateTriggerActorActionOutcome(
      extraction({ trigger: "a match is found", actor: "a compliance officer", action: "confirms the alert", outcome: "the account is activated" }),
      controlText
    );
    expect(result.pass).toBe(true);
  });
});

describe("evaluateCorrectSection (computed in code, model verdict ignored except as a parse fallback)", () => {
  const modelSaysPass = { quote: "some quote", pass: true, reason: "model reason", suggestedRewrite: null };
  const modelSaysFail = { quote: "some quote", pass: false, reason: "model reason", suggestedRewrite: "rewrite" };

  it("passes when lifecycle stage, customer type and topic all fit the section", () => {
    const result = evaluateCorrectSection(
      extraction({ lifecycleStage: "onboarding", customerType: "legal_person", topic: "other" }),
      "2.2 Customer Due Diligence (CDD) · Onboarding · Legal Person",
      modelSaysFail // the model's own verdict is ignored - result should still pass
    );
    expect(result.pass).toBe(true);
  });

  it("fails when the lifecycle stage conflicts", () => {
    const result = evaluateCorrectSection(
      extraction({ lifecycleStage: "exit", customerType: "unspecified", topic: "other" }),
      "2.2 Customer Due Diligence (CDD) · Onboarding · Legal Person",
      modelSaysPass // the model's own verdict is ignored - result should still fail
    );
    expect(result.pass).toBe(false);
    expect(result.reason.toLowerCase()).toContain("lifecycle stage");
  });

  it("treats periodic_review as compatible with an Ongoing Monitoring section", () => {
    const result = evaluateCorrectSection(
      extraction({ lifecycleStage: "periodic_review", customerType: "unspecified", topic: "other" }),
      "2.3 Enhanced Due Diligence (EDD) · Ongoing Monitoring · Both",
      modelSaysPass
    );
    expect(result.pass).toBe(true);
  });

  it("treats exit as compatible with an Ongoing Monitoring section", () => {
    const result = evaluateCorrectSection(
      extraction({ lifecycleStage: "exit", customerType: "unspecified", topic: "other" }),
      "2.3 Enhanced Due Diligence (EDD) · Ongoing Monitoring · Both",
      modelSaysPass
    );
    expect(result.pass).toBe(true);
  });

  it("a 'Both' section accepts any specified customer type", () => {
    const result = evaluateCorrectSection(
      extraction({ lifecycleStage: "unspecified", customerType: "natural_person", topic: "other" }),
      "2.3 Enhanced Due Diligence (EDD) · Ongoing Monitoring · Both",
      modelSaysPass
    );
    expect(result.pass).toBe(true);
  });

  it("fails when the customer type conflicts", () => {
    const result = evaluateCorrectSection(
      extraction({ lifecycleStage: "unspecified", customerType: "natural_person", topic: "other" }),
      "2.2 Customer Due Diligence (CDD) · Onboarding · Legal Person",
      modelSaysPass
    );
    expect(result.pass).toBe(false);
    expect(result.reason.toLowerCase()).toContain("customer type");
  });

  it("fails when the text is correspondent banking but the section is not", () => {
    const result = evaluateCorrectSection(
      extraction({ lifecycleStage: "unspecified", customerType: "unspecified", topic: "correspondent_banking" }),
      "2.2 Customer Due Diligence (CDD) · Onboarding · Legal Person",
      modelSaysPass
    );
    expect(result.pass).toBe(false);
  });

  it("fails when the section is correspondent banking but the text is not", () => {
    const result = evaluateCorrectSection(
      extraction({ lifecycleStage: "onboarding", customerType: "legal_person", topic: "other" }),
      "2.4 Correspondent Banking Due Diligence · Onboarding · Legal Person",
      modelSaysPass
    );
    expect(result.pass).toBe(false);
  });

  it("never fails purely on CDD-vs-EDD wording in the section title (EDD controls can sit under a CDD section)", () => {
    const result = evaluateCorrectSection(
      extraction({ lifecycleStage: "ongoing_monitoring", customerType: "legal_person", topic: "other" }),
      "2.2 Customer Due Diligence (CDD) · Ongoing Monitoring · Legal Person",
      modelSaysPass
    );
    expect(result.pass).toBe(true);
  });

  it("falls back to the model's own verdict when the section title cannot be parsed", () => {
    const result = evaluateCorrectSection(extraction({ lifecycleStage: "exit", customerType: "natural_person", topic: "correspondent_banking" }), "2.1 Customer Due Diligence", modelSaysFail);
    expect(result).toEqual(modelSaysFail);
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

describe("trigger clause detected in code", () => {
  it("finds a sentence-leading condition or timing clause verbatim", () => {
    expect(findTriggerClause("When a respondent bank applies to open a correspondent account, the team completes a questionnaire.")).toBe(
      "When a respondent bank applies to open a correspondent account"
    );
    expect(findTriggerClause("Each night, the system compares activity.")).toBe("Each night");
    expect(findTriggerClause("The system runs daily. Before any account is opened, an analyst approves it.")).toBe("Before any account is opened");
  });

  it("does not treat a mid-sentence 'before' or a subject-first sentence as a trigger", () => {
    expect(findTriggerClause("A CDD analyst reviews the chart before signing off and the file is held until resolved.")).toBeNull();
    expect(findTriggerClause("High-risk accounts are monitored on an ongoing basis.")).toBeNull();
  });

  it("passes TAAO when the model left trigger null but the text opens with a trigger clause", () => {
    const text = "When a respondent bank applies, the onboarding team completes a questionnaire before any account is opened.";
    const result = evaluateTriggerActorActionOutcome(
      extraction({ trigger: null, actor: "the onboarding team", action: "completes a questionnaire", outcome: "before any account is opened" }),
      text
    );
    expect(result.pass).toBe(true);
  });

  it("still fails TAAO when the actor is missing even though a trigger clause exists", () => {
    const text = "Before activation, ownership is verified against the registry and discrepancies are declined.";
    const result = evaluateTriggerActorActionOutcome(
      extraction({ trigger: null, actor: null, action: "is verified against the registry", outcome: "discrepancies are declined" }),
      text
    );
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("actor");
  });

  it("lists extraction fields that were not copied verbatim", () => {
    const text = "When a match is found, a compliance officer confirms the alert.";
    expect(nonVerbatimExtractionFields(extraction({ trigger: "a match is found", actor: "the compliance team", action: "confirms the alert", outcome: null }), text)).toEqual(["actor"]);
  });
});
