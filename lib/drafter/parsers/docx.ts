import mammoth from "mammoth";
import { parseHtml } from "./html";
import type { ParsedDocument } from "../blocks";

/**
 * Parses .docx via mammoth, converting to HTML first (mammoth maps Word
 * heading styles to h1-h6 and preserves lists/tables) and then re-using the
 * HTML block walker. Tracked changes: mammoth's default conversion already
 * reflects the document as it would print - i.e. accepted content only,
 * unaccepted insertions/deletions are not surfaced as separate markup - so
 * no extra handling is needed to "ignore unaccepted tracked changes" per
 * SPEC.md; mammoth's messages are surfaced as parser warnings.
 */
export async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  const result = await mammoth.convertToHtml({ buffer });
  const parsed = parseHtml(result.value);
  const warnings = [
    ...parsed.warnings,
    ...result.messages.filter((m) => m.type === "warning").map((m) => `mammoth: ${m.message}`),
  ];
  return { blocks: parsed.blocks, warnings };
}
