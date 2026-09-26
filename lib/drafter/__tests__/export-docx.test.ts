import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { buildExportDocument, buildExportFilename, renderExportDocxBuffer } from "../export-docx";

const FIELD_LABELS = {
  control_enhancement: "Control enhancement",
  control_enhancement_rationale: "Control enhancement rationale",
  backoffice_control_impacted: "Backoffice control impacted",
  evidence_of_delivery: "Evidence of delivery",
};

describe("buildExportFilename", () => {
  it("matches '<product> PRA draft <YYYY-MM-DD> v<version>'", () => {
    const name = buildExportFilename("Correspondent Banking", 3, new Date("2026-09-26T00:00:00Z"));
    expect(name).toBe("Correspondent Banking PRA draft 2026-09-26 v3.docx");
  });

  it("sanitises characters that are invalid in a filename", () => {
    const name = buildExportFilename('A/B: "Product"?', 1, new Date("2026-01-01T00:00:00Z"));
    expect(name).not.toMatch(/[\\/:*?"<>|]/);
  });
});

describe("renderExportDocxBuffer", () => {
  const input = {
    product: "Correspondent Banking",
    legalEntity: "Acme Bank plc",
    fieldLabels: FIELD_LABELS,
    sections: [
      {
        sectionNumber: "2.1",
        sectionTitle: "Customer Due Diligence",
        isEmpty: false,
        emptySectionWording: null,
        enhancements: [
          {
            sortOrder: 0,
            controlText: "The team screens every new relationship before onboarding, noting a [pending confirmation] placeholder.",
            rationale: "This addresses onboarding risk.",
            backofficeControlLabel: "Customer Due Diligence",
            evidenceRefs: [{ label: "Regulatory requirement ID", value: "REQ-0001" }],
            isGap: false,
          },
        ],
      },
      {
        sectionNumber: "2.3",
        sectionTitle: "Enhanced Due Diligence",
        isEmpty: true,
        emptySectionWording: "No enhanced due diligence controls apply to this product.",
        enhancements: [],
      },
    ],
    includeOpenItemsAppendix: true,
    openItems: [{ itemType: "placeholder", description: "pending confirmation - awaiting evidence" }],
    externalStylesXml: null,
  };

  it("builds a Document without throwing", () => {
    expect(() => buildExportDocument(input)).not.toThrow();
  });

  it("produces a real, unzippable .docx whose document.xml contains the field labels, section headings styled Heading1/2, a highlighted placeholder, the open-items appendix, and never a review-flag word", async () => {
    const buffer = await renderExportDocxBuffer(input);
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file("word/document.xml")!.async("text");

    for (const label of Object.values(FIELD_LABELS)) {
      expect(documentXml).toContain(label);
    }

    // Word heading styles - docx maps HeadingLevel.HEADING_1/2 to these style ids.
    expect(documentXml).toMatch(/w:val="Heading1"/);
    expect(documentXml).toMatch(/w:val="Heading2"/);

    // Placeholder kept in square brackets and highlighted.
    expect(documentXml).toContain("[pending confirmation]");
    expect(documentXml).toMatch(/<w:highlight w:val="yellow"\/>/);

    // Empty section wording present for the section with no enhancements.
    expect(documentXml).toContain("No enhanced due diligence controls apply to this product.");

    // Open items appendix included.
    expect(documentXml).toContain("Appendix: open items");
    expect(documentXml).toContain("pending confirmation - awaiting evidence");

    // Review flags (lint/judge status words) must never be exported.
    for (const bannedWord of ["not_reviewed", "review_result", "lintStatus", "judgeStale"]) {
      expect(documentXml).not.toContain(bannedWord);
    }
  });

  it("omits the open-items appendix when the caller opts out", async () => {
    const buffer = await renderExportDocxBuffer({ ...input, includeOpenItemsAppendix: false });
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file("word/document.xml")!.async("text");
    expect(documentXml).not.toContain("Appendix: open items");
  });
});
