import type { ParsedDocument } from "./blocks";

export type DrafterDocType = "pra" | "register" | "policy" | "style_brief";

export interface DocTypeDetection {
  suggestedType: DrafterDocType;
  confidence: "high" | "low";
  reasons: string[];
  /** true when the upload cannot possibly be a register, regardless of what the user picks */
  registerRejected: boolean;
  registerRejectedReason?: string;
}

const CITE_ARTIFACT_RE = /\[cite:\s*\d+\]/i;

/**
 * Suggests a document type from format + content, and hard-rejects a
 * markdown/html "summary" of a register: a register must always be the raw
 * spreadsheet (SPEC.md "A register must always be the raw spreadsheet. A
 * markdown summary of a register is rejected as a register..."). The
 * rejection is enforced here in code, not left to the user's confirm step,
 * because a summary silently accepted as a register would drop columns
 * (e.g. Control Review Notes) and can carry citation artifacts like
 * "[cite: 6]" straight into the controls library.
 */
export function detectDocType(
  format: "docx" | "md" | "html" | "xlsx",
  parsed: ParsedDocument,
  rawText?: string
): DocTypeDetection {
  if (format === "xlsx") {
    return { suggestedType: "register", confidence: "high", reasons: ["xlsx uploads are register/library data"], registerRejected: false };
  }

  const headingTexts = parsed.blocks.filter((b) => b.type === "heading").map((b) => b.text.toLowerCase());
  const allText = (rawText ?? parsed.blocks.map((b) => ("text" in b ? b.text : "")).join(" ")).toLowerCase();

  // Deliberately does NOT match on REQ IDs alone: a legitimate approved PRA
  // cites REQ IDs in its Evidence field (SPEC.md), so that alone must never
  // flag it as a register summary. Only an explicit "this is a summary"
  // signal or a generation artifact counts.
  const citeArtifact = CITE_ARTIFACT_RE.test(rawText ?? "");
  const looksLikeRegisterSummary = citeArtifact || /register\s+summary|summary of the (requirements )?register/i.test(allText);

  if (looksLikeRegisterSummary) {
    const reason = citeArtifact
      ? 'Contains a citation artifact ("[cite: N]") typical of a generated summary'
      : "Reads like a summary of a requirements register (register content must be uploaded as the raw xlsx, not a text summary)";
    return {
      suggestedType: "register",
      confidence: "high",
      reasons: [reason],
      registerRejected: true,
      registerRejectedReason: `A register must be uploaded as the original spreadsheet, not a ${format} summary. ${reason}.`,
    };
  }

  const numberedSectionHeading = headingTexts.some((h) => /^\d+(\.\d+)*\s+\S/.test(h));
  const mentionsPra = /product risk assessment|\bpra\b/.test(allText);
  if (numberedSectionHeading && mentionsPra) {
    return {
      suggestedType: "pra",
      confidence: "high",
      reasons: ["Numbered section headings and PRA terminology found"],
      registerRejected: false,
    };
  }

  if (/style\s*brief|house\s*style|tone of voice/i.test(allText)) {
    return { suggestedType: "style_brief", confidence: "high", reasons: ["Mentions style brief / house style"], registerRejected: false };
  }

  if (/\bpolicy\b/.test(allText) && !numberedSectionHeading) {
    return { suggestedType: "policy", confidence: "low", reasons: ["Mentions policy without a numbered PRA-style skeleton"], registerRejected: false };
  }

  if (numberedSectionHeading) {
    return { suggestedType: "pra", confidence: "low", reasons: ["Numbered section headings found"], registerRejected: false };
  }

  return { suggestedType: "policy", confidence: "low", reasons: ["No strong signal; defaulting to policy for user confirmation"], registerRejected: false };
}
