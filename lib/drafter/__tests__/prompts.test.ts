import { describe, it, expect } from "vitest";
import { buildWriterPrompt, draftInputsAreEmpty } from "../prompts";

const baseInput = {
  styleRules: ["One enhancement describes one mechanism."],
  bannedPhrases: [{ phrase: "severe", replacement: "significant" }],
  wordLimits: { min: 60, max: 150 },
  exemplars: [{ sectionType: "CDD", controlText: "Exemplar control text.", rationale: "Exemplar rationale text." }],
  productDescription: "A correspondent banking product for legal person customers.",
  sectionTitle: "2.2 Customer Due Diligence (CDD) - Onboarding - Legal Person",
  draftInputs: {
    obligationDescription: "Firms must verify beneficial owners before onboarding.",
    controlReviewNotes: "Current control checks beneficial ownership at onboarding via the register.",
    controlUpliftAmendment: null,
    remediationGaps: null,
  },
};

describe("buildWriterPrompt", () => {
  it("never includes the register's Rationale column - it has no parameter for it", () => {
    const built = buildWriterPrompt(baseInput);
    expect(built.user.toLowerCase()).not.toContain("rationale for decision");
    // "Rationale:" only ever appears inside an exemplar block (the exemplar's OWN approved rationale, shown as a style reference) - never as a
    // labelled draft-input block, which is where the register's "Rationale" column would appear if it were (wrongly) passed through.
    const beforeExemplars = built.user.split("Style exemplars")[0];
    expect(beforeExemplars).not.toContain("Rationale:");
  });

  it("uses Control Review Notes before Uplift and Remediation, in priority order", () => {
    const built = buildWriterPrompt({
      ...baseInput,
      draftInputs: {
        obligationDescription: null,
        controlReviewNotes: "Review notes text.",
        controlUpliftAmendment: "Uplift text.",
        remediationGaps: "Remediation text.",
      },
    });
    const notesIndex = built.user.indexOf("Review notes text.");
    const upliftIndex = built.user.indexOf("Uplift text.");
    const remediationIndex = built.user.indexOf("Remediation text.");
    expect(notesIndex).toBeGreaterThan(-1);
    expect(notesIndex).toBeLessThan(upliftIndex);
    expect(upliftIndex).toBeLessThan(remediationIndex);
  });

  it("omits empty draft input fields rather than sending blank labelled blocks", () => {
    const built = buildWriterPrompt(baseInput);
    expect(built.user).not.toContain("Control Uplift / Amendment:");
    expect(built.user).not.toContain("Remediation on identified gaps:");
  });

  it("includes 2-3 exemplars and the product description and section title", () => {
    const built = buildWriterPrompt(baseInput);
    expect(built.user).toContain("Exemplar control text.");
    expect(built.user).toContain(baseInput.productDescription);
    expect(built.user).toContain(baseInput.sectionTitle);
  });

  it("instructs JSON output with control_text, rationale and placeholders", () => {
    const built = buildWriterPrompt(baseInput);
    expect(built.system).toContain("control_text");
    expect(built.system).toContain("\"rationale\"");
    expect(built.system).toContain("placeholders");
  });

  it("collects allowed input texts for the fact boundary from exactly what the model was shown", () => {
    const built = buildWriterPrompt(baseInput);
    expect(built.allowedInputTexts).toContain(baseInput.productDescription);
    expect(built.allowedInputTexts).toContain("Current control checks beneficial ownership at onboarding via the register.");
  });
});

describe("draftInputsAreEmpty", () => {
  it("is true when all three draft input fields are empty", () => {
    expect(draftInputsAreEmpty({ obligationDescription: "context", controlReviewNotes: "", controlUpliftAmendment: null, remediationGaps: "  " })).toBe(true);
  });

  it("is false when at least one draft input field has content", () => {
    expect(draftInputsAreEmpty({ obligationDescription: null, controlReviewNotes: null, controlUpliftAmendment: "text", remediationGaps: null })).toBe(false);
  });
});
