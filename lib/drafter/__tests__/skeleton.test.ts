import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseMarkdown } from "../parsers/markdown";
import { extractSkeleton } from "../skeleton";

const FIXTURE = path.join(process.cwd(), "test/fixtures/drafter/approved-pra.md");

describe("extractSkeleton (markdown fixture)", () => {
  const source = readFileSync(FIXTURE, "utf8");
  const parsed = parseMarkdown(source);
  const result = extractSkeleton(parsed);

  it("finds every numbered section heading", () => {
    expect(result.sections.map((s) => s.number)).toEqual(["2.1", "2.2", "2.3", "2.4"]);
  });

  it("parses title, lifecycle stage and customer type for a full heading", () => {
    const s22 = result.sections.find((s) => s.number === "2.2")!;
    expect(s22.title).toBe("Customer Due Diligence (CDD)");
    expect(s22.lifecycleStage).toBe("Onboarding");
    expect(s22.customerType).toBe("legal_person");
  });

  it("parses the legal-person-only section used for the EDD assignment test elsewhere", () => {
    const s24 = result.sections.find((s) => s.number === "2.4")!;
    expect(s24.customerType).toBe("legal_person");
    expect(s24.title).toBe("Correspondent Banking Due Diligence");
  });

  it("parses a 'both' customer type section", () => {
    const s23 = result.sections.find((s) => s.number === "2.3")!;
    expect(s23.customerType).toBe("both");
  });

  it("keeps the standard opening wording intact", () => {
    const s21 = result.sections.find((s) => s.number === "2.1")!;
    expect(s21.standardWording).toBe("The following control enhancements apply to onboarding checks for natural person customers.");
  });

  it("keeps the empty-section wording intact and does not produce an exemplar for it", () => {
    const s23 = result.sections.find((s) => s.number === "2.3")!;
    expect(s23.emptySectionWording).toBe("No control enhancements apply to this section for the current product.");
    expect(result.exemplarCandidates.some((e) => e.sectionNumber === "2.3")).toBe(false);
  });

  it("extracts every field label intact", () => {
    expect(result.fieldLabels).toEqual({
      control_enhancement: "Control enhancement",
      control_enhancement_rationale: "Control enhancement rationale",
      backoffice_control_impacted: "Backoffice control impacted",
      evidence_of_delivery: "Evidence of delivery",
    });
  });

  it("extracts existing enhancements as exemplar candidates with full text intact", () => {
    const candidate = result.exemplarCandidates.find((e) => e.sectionNumber === "2.2")!;
    expect(candidate.controlText).toContain("beneficial owners");
    expect(candidate.rationale).toContain("ultimately in control");
    expect(candidate.backofficeControlLabel).toBe("Customer Due Diligence");
    expect(candidate.evidence).toBe("REQ-0011, Art. 13 (1) (b)");
  });

  it("maps each section to its back office control from its exemplar", () => {
    const s21 = result.sections.find((s) => s.number === "2.1")!;
    expect(s21.backofficeControlMap).toBe("Customer Due Diligence");
    const s24 = result.sections.find((s) => s.number === "2.4")!;
    expect(s24.backofficeControlMap).toBe("Correspondent Banking Due Diligence");
  });

  it("produces 4 exemplar candidates total (one per non-empty section, 2.2 has one)", () => {
    expect(result.exemplarCandidates).toHaveLength(3);
  });
});
