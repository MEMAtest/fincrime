import { describe, it, expect } from "vitest";
import { lintEnhancement, lintStatus, isPlaceholderOnlyText } from "../lint";

const GOOD_TEXT =
  "The system checks each new correspondent relationship against the applicable due diligence control before it is onboarded, and a nominated reviewer confirms the outcome is recorded before any transactions are processed under the new relationship, closing the gap at the point of greatest exposure for the firm and its customers across every jurisdiction served by this product line today and going forward.";

describe("lintEnhancement", () => {
  it("flags a banned phrase with its replacement", () => {
    const issues = lintEnhancement({ controlText: GOOD_TEXT, rationale: "This is non-negotiable.", bannedPhrases: [{ phrase: "non-negotiable", replacement: "required" }] });
    const hit = issues.find((i) => i.rule === "banned_phrase");
    expect(hit?.replacement).toBe("required");
  });

  it("flags a REQ ID outside the evidence field", () => {
    const issues = lintEnhancement({ controlText: `${GOOD_TEXT} REQ-0012.`, rationale: "" });
    expect(issues.some((i) => i.rule === "req_id_outside_evidence" && i.match === "REQ-0012")).toBe(true);
  });

  it("flags an article reference outside the evidence field", () => {
    const issues = lintEnhancement({ controlText: `${GOOD_TEXT} Art. 19 (1).`, rationale: "" });
    expect(issues.some((i) => i.rule === "req_id_outside_evidence")).toBe(true);
  });

  it("flags an em dash", () => {
    const issues = lintEnhancement({ controlText: `${GOOD_TEXT}—example`, rationale: "" });
    expect(issues.some((i) => i.rule === "dash")).toBe(true);
  });

  it("flags an en dash", () => {
    const issues = lintEnhancement({ controlText: `${GOOD_TEXT}–example`, rationale: "" });
    expect(issues.some((i) => i.rule === "dash")).toBe(true);
  });

  it("flags 'will' and 'was' for a tense check", () => {
    const issues = lintEnhancement({ controlText: GOOD_TEXT, rationale: "This was designed and will be delivered." });
    expect(issues.filter((i) => i.rule === "tense")).toHaveLength(2);
  });

  it("flags control text under the word limit", () => {
    const issues = lintEnhancement({ controlText: "Too short.", rationale: "" });
    expect(issues.some((i) => i.rule === "word_count")).toBe(true);
  });

  it("flags control text over the word limit", () => {
    const issues = lintEnhancement({ controlText: `${GOOD_TEXT} ${GOOD_TEXT} ${GOOD_TEXT}`, rationale: "" });
    expect(issues.some((i) => i.rule === "word_count")).toBe(true);
  });

  it("does not flag word count when control text is within limits", () => {
    const issues = lintEnhancement({ controlText: GOOD_TEXT, rationale: "" });
    expect(issues.some((i) => i.rule === "word_count")).toBe(false);
  });

  it("flags an unfilled placeholder", () => {
    const issues = lintEnhancement({ controlText: `${GOOD_TEXT} [unsupported figure: verify]`, rationale: "" });
    expect(issues.some((i) => i.rule === "unfilled_placeholder")).toBe(true);
  });

  it("flags a formula error carried through as text", () => {
    const issues = lintEnhancement({ controlText: GOOD_TEXT, rationale: "#REF!" });
    expect(issues.some((i) => i.rule === "formula_error")).toBe(true);
  });

  it("isPlaceholderOnlyText is true only when the whole text is one bracketed placeholder", () => {
    expect(isPlaceholderOnlyText("[Agreed wording not held for this control]")).toBe(true);
    expect(isPlaceholderOnlyText("  [Agreed wording not held for this control]  ")).toBe(true);
    expect(isPlaceholderOnlyText(`${GOOD_TEXT} [figure]`)).toBe(false);
    expect(isPlaceholderOnlyText(GOOD_TEXT)).toBe(false);
  });

  it("does not flag word count on a placeholder-only control text (prod walkthrough item 3: no double-counted 'needs input' + 'below 60-150 words')", () => {
    const issues = lintEnhancement({ controlText: "[Agreed wording not held for this control]", rationale: "" });
    expect(issues.some((i) => i.rule === "word_count")).toBe(false);
  });

  it("lintStatus is pass with no issues, minor with only warnings, critical with any critical", () => {
    expect(lintStatus([])).toBe("pass");
    expect(lintStatus([{ rule: "dash", severity: "warning", message: "x" }])).toBe("minor");
    expect(lintStatus([{ rule: "dash", severity: "warning", message: "x" }, { rule: "banned_phrase", severity: "critical", message: "y" }])).toBe(
      "critical"
    );
  });
});
