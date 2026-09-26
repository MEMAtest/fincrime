/**
 * Word export (SPEC.md "Word export"). Builds a real .docx using the
 * existing `docx` dependency: real Word heading styles (so outline view and
 * a TOC work), the template's field labels and order, placeholders kept in
 * square brackets and highlighted, review flags never exported, and an
 * optional open-items appendix. Reuses the approved PRA's own styles.xml
 * when it was uploaded as .docx, via docx's `externalStyles`, falling back
 * cleanly (the library's own default styles) otherwise.
 */
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import JSZip from "jszip";
import type { SkeletonFieldLabels } from "./skeleton";

export interface ExportEnhancementInput {
  sectionNumber: string;
  sectionTitle: string;
  isEmpty: boolean;
  emptySectionWording: string | null;
  enhancements: {
    sortOrder: number;
    controlText: string | null;
    rationale: string | null;
    backofficeControlLabel: string | null;
    evidenceRefs: { label: string; value: string }[];
    isGap: boolean;
  }[];
}

export interface ExportOpenItem {
  itemType: string;
  description: string;
}

export interface BuildExportInput {
  product: string;
  legalEntity: string | null;
  fieldLabels: SkeletonFieldLabels;
  sections: ExportEnhancementInput[];
  includeOpenItemsAppendix: boolean;
  openItems: ExportOpenItem[];
  externalStylesXml?: string | null;
}

const PLACEHOLDER_RE = /\[[^\]]*\]/g;

/** Splits text into runs, highlighting bracketed placeholders (SPEC.md: "placeholders in square brackets and highlighted"). */
function runsWithPlaceholdersHighlighted(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(PLACEHOLDER_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) runs.push(new TextRun(text.slice(lastIndex, index)));
    runs.push(new TextRun({ text: match[0], highlight: "yellow" }));
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) runs.push(new TextRun(text.slice(lastIndex)));
  if (runs.length === 0) runs.push(new TextRun(""));
  return runs;
}

function labelledParagraph(label: string, text: string): Paragraph[] {
  return [
    new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true })] }),
    new Paragraph({ children: runsWithPlaceholdersHighlighted(text || "") }),
  ];
}

export function buildExportDocument(input: BuildExportInput): Document {
  const children: Paragraph[] = [
    new Paragraph({ text: `${input.product} - Product Risk Assessment (draft)`, heading: HeadingLevel.TITLE }),
  ];
  if (input.legalEntity) {
    children.push(new Paragraph({ children: [new TextRun({ text: `Legal entity: ${input.legalEntity}` })] }));
  }

  for (const section of input.sections) {
    children.push(new Paragraph({ text: `${section.sectionNumber} ${section.sectionTitle}`, heading: HeadingLevel.HEADING_1 }));

    if (section.isEmpty || section.enhancements.length === 0) {
      children.push(new Paragraph({ children: runsWithPlaceholdersHighlighted(section.emptySectionWording || "No controls apply to this section.") }));
      continue;
    }

    section.enhancements
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((enh, i) => {
        children.push(new Paragraph({ text: `${section.sectionNumber}.${i + 1}`, heading: HeadingLevel.HEADING_2 }));
        children.push(...labelledParagraph(input.fieldLabels.control_enhancement, enh.controlText ?? ""));
        children.push(...labelledParagraph(input.fieldLabels.control_enhancement_rationale, enh.rationale ?? ""));
        children.push(...labelledParagraph(input.fieldLabels.backoffice_control_impacted, enh.backofficeControlLabel ?? ""));
        const evidenceText = enh.evidenceRefs.map((r) => `${r.label}: ${r.value}`).join("; ");
        children.push(...labelledParagraph(input.fieldLabels.evidence_of_delivery, evidenceText));
      });
  }

  if (input.includeOpenItemsAppendix && input.openItems.length > 0) {
    children.push(new Paragraph({ text: "Appendix: open items", heading: HeadingLevel.HEADING_1 }));
    for (const item of input.openItems) {
      children.push(new Paragraph({ text: `[${item.itemType}] ${item.description}` }));
    }
  }

  return new Document({
    externalStyles: input.externalStylesXml ?? undefined,
    sections: [{ children }],
  });
}

export async function renderExportDocxBuffer(input: BuildExportInput): Promise<Buffer> {
  const doc = buildExportDocument(input);
  return Packer.toBuffer(doc);
}

/** Extracts word/styles.xml from an original .docx's bytes, for `externalStyles`. Returns null on anything but a well-formed docx (falls back cleanly per SPEC.md). */
export async function extractStylesXmlFromDocx(bytes: Buffer): Promise<string | null> {
  try {
    const zip = await JSZip.loadAsync(bytes);
    const stylesFile = zip.file("word/styles.xml");
    if (!stylesFile) return null;
    return await stylesFile.async("text");
  } catch {
    return null;
  }
}

/** Builds the export filename per SPEC.md "Word export": "<product> PRA draft <YYYY-MM-DD> v<version>". */
export function buildExportFilename(product: string, version: number, date = new Date()): string {
  const iso = date.toISOString().slice(0, 10);
  const safeProduct = product.trim().replace(/[\\/:*?"<>|]/g, "-");
  return `${safeProduct} PRA draft ${iso} v${version}.docx`;
}
