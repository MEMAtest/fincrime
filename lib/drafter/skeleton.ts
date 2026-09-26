/**
 * Skeleton extraction from a confirmed approved-PRA document (SPEC.md
 * "Template and house style" - Skeleton extraction). Pure, deterministic:
 * reads the internal block structure (see lib/drafter/blocks.ts) produced
 * by any of the four parsers and proposes section numbers/titles, the
 * standard opening wording, the empty-section wording, the four
 * per-enhancement field labels, and existing enhancements as exemplar
 * candidates.
 *
 * The user reviews/edits this proposal before it becomes a versioned
 * Template (see app/api/drafter/templates). Approved PRA CONTENT (control
 * text/rationale) only ever becomes an exemplar (style input); it is never
 * copied into another product's draft as its own control text.
 */

import type { DocBlock, ParsedDocument } from "./blocks";

export type SkeletonCustomerType = "natural_person" | "legal_person" | "both" | null;

export interface SkeletonSection {
  number: string;
  title: string;
  lifecycleStage: string | null;
  customerType: SkeletonCustomerType;
  standardWording: string | null;
  emptySectionWording: string | null;
  backofficeControlMap: string | null;
}

export interface SkeletonFieldLabels {
  control_enhancement: string;
  control_enhancement_rationale: string;
  backoffice_control_impacted: string;
  evidence_of_delivery: string;
}

export interface SkeletonExemplarCandidate {
  sectionNumber: string;
  sectionType: string;
  controlText: string;
  rationale: string;
  backofficeControlLabel: string | null;
  evidence: string | null;
}

export interface ExtractedSkeleton {
  sections: SkeletonSection[];
  fieldLabels: SkeletonFieldLabels;
  exemplarCandidates: SkeletonExemplarCandidate[];
  warnings: string[];
}

const DEFAULT_FIELD_LABELS: SkeletonFieldLabels = {
  control_enhancement: "Control enhancement",
  control_enhancement_rationale: "Control enhancement rationale",
  backoffice_control_impacted: "Backoffice control impacted",
  evidence_of_delivery: "Evidence of delivery",
};

const FIELD_LABEL_KEYS: (keyof SkeletonFieldLabels)[] = [
  "control_enhancement",
  "control_enhancement_rationale",
  "backoffice_control_impacted",
  "evidence_of_delivery",
];

const CANONICAL_LABEL_TEXT: Record<keyof SkeletonFieldLabels, string> = {
  control_enhancement: "control enhancement",
  control_enhancement_rationale: "control enhancement rationale",
  backoffice_control_impacted: "backoffice control impacted",
  evidence_of_delivery: "evidence of delivery",
};

const SECTION_HEADING_RE = /^(\d+(?:\.\d+)+)\s+(.+)$/;
const EMPTY_SECTION_RE = /^no control enhancements apply/i;

/** Splits a heading's remainder ("Title · Stage · Customer type") on middle dot or hyphen separators. */
function splitHeadingParts(remainder: string): string[] {
  return remainder
    .split(/\s*[··]\s*|\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function detectCustomerType(part: string | undefined): SkeletonCustomerType {
  if (!part) return null;
  const lower = part.toLowerCase();
  if (lower.includes("both")) return "both";
  if (lower.includes("legal")) return "legal_person";
  if (lower.includes("natural")) return "natural_person";
  return null;
}

/** Matches a paragraph's leading "<Label>:" prefix against a field label key, returning the label text and remainder. */
function matchFieldLabel(text: string): { key: keyof SkeletonFieldLabels; label: string; value: string } | null {
  const colonIndex = text.indexOf(":");
  if (colonIndex === -1) return null;
  const label = text.slice(0, colonIndex).trim();
  const value = text.slice(colonIndex + 1).trim();
  const labelLower = label.toLowerCase();
  for (const key of FIELD_LABEL_KEYS) {
    if (labelLower === CANONICAL_LABEL_TEXT[key]) {
      return { key, label, value };
    }
  }
  return null;
}

export function extractSkeleton(parsed: ParsedDocument): ExtractedSkeleton {
  const sections: SkeletonSection[] = [];
  const exemplarCandidates: SkeletonExemplarCandidate[] = [];
  const warnings: string[] = [...parsed.warnings];
  const fieldLabels: SkeletonFieldLabels = { ...DEFAULT_FIELD_LABELS };
  const seenFieldLabelKeys = new Set<string>();

  // Group blocks by section: a section starts at any heading whose text
  // matches "<number> <rest>" with a dotted number (e.g. "2.2 ..."), and
  // runs until the next such heading (any level >= that heading's level).
  type SectionBucket = { section: SkeletonSection; blocks: DocBlock[] };
  const buckets: SectionBucket[] = [];
  let current: SectionBucket | null = null;

  for (const block of parsed.blocks) {
    if (block.type === "heading") {
      const match = SECTION_HEADING_RE.exec(block.text.trim());
      if (match) {
        const [, number, remainder] = match;
        const parts = splitHeadingParts(remainder);
        const title = parts[0] ?? remainder.trim();
        const lifecycleStage = parts.length >= 3 ? parts[1] : parts.length === 2 && !detectCustomerType(parts[1]) ? parts[1] : null;
        const customerType = detectCustomerType(parts[parts.length - 1]);
        const section: SkeletonSection = {
          number,
          title,
          lifecycleStage,
          customerType,
          standardWording: null,
          emptySectionWording: null,
          backofficeControlMap: null,
        };
        current = { section, blocks: [] };
        buckets.push(current);
        continue;
      }
    }
    if (current) current.blocks.push(block);
  }

  if (buckets.length === 0) {
    warnings.push("No numbered section headings (e.g. \"2.2 Title\") were found in this document.");
  }

  for (const bucket of buckets) {
    const { section, blocks } = bucket;
    let pendingEnhancement: Partial<Record<keyof SkeletonFieldLabels, string>> = {};

    const flushEnhancement = () => {
      if (pendingEnhancement.control_enhancement) {
        exemplarCandidates.push({
          sectionNumber: section.number,
          sectionType: section.title,
          controlText: pendingEnhancement.control_enhancement,
          rationale: pendingEnhancement.control_enhancement_rationale ?? "",
          backofficeControlLabel: pendingEnhancement.backoffice_control_impacted ?? null,
          evidence: pendingEnhancement.evidence_of_delivery ?? null,
        });
        if (!section.backofficeControlMap && pendingEnhancement.backoffice_control_impacted) {
          section.backofficeControlMap = pendingEnhancement.backoffice_control_impacted;
        }
      }
      pendingEnhancement = {};
    };

    for (const block of blocks) {
      if (block.type !== "paragraph") continue;
      const text = block.text.trim();
      if (!text) continue;

      if (EMPTY_SECTION_RE.test(text)) {
        section.emptySectionWording = text;
        continue;
      }

      const fieldMatch = matchFieldLabel(text);
      if (fieldMatch) {
        if (!seenFieldLabelKeys.has(fieldMatch.key)) {
          fieldLabels[fieldMatch.key] = fieldMatch.label;
          seenFieldLabelKeys.add(fieldMatch.key);
        }
        // A new "Control enhancement:" line starts the next enhancement.
        if (fieldMatch.key === "control_enhancement" && pendingEnhancement.control_enhancement) {
          flushEnhancement();
        }
        pendingEnhancement[fieldMatch.key] = fieldMatch.value;
        continue;
      }

      // First non-label, non-empty-wording paragraph in the section (before
      // any enhancement fields) is the standard opening wording.
      if (!section.standardWording && Object.keys(pendingEnhancement).length === 0 && exemplarCandidates.every((e) => e.sectionNumber !== section.number)) {
        section.standardWording = text;
      }
    }
    flushEnhancement();
    sections.push(section);
  }

  return { sections, fieldLabels, exemplarCandidates, warnings };
}
