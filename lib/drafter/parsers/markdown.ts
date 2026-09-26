import { marked, type Tokens } from "marked";
import type { DocBlock, ParsedDocument } from "../blocks";

/**
 * Parses markdown into the internal block structure. Markdown tables become
 * table blocks; headings keep their level; everything else not covered
 * (blockquotes, code fences, hr) is dropped with a warning rather than
 * silently merged into a paragraph, so a caller can see what was lost.
 */
export function parseMarkdown(source: string): ParsedDocument {
  const tokens = marked.lexer(source);
  const blocks: DocBlock[] = [];
  const warnings: string[] = [];
  let position = 0;

  for (const token of tokens) {
    if (token.type === "heading") {
      const t = token as Tokens.Heading;
      blocks.push({ type: "heading", level: t.depth, text: plain(t.text), position: position++ });
    } else if (token.type === "paragraph") {
      const t = token as Tokens.Paragraph;
      const text = plain(t.text);
      if (text.trim()) blocks.push({ type: "paragraph", text, position: position++ });
    } else if (token.type === "list") {
      const t = token as Tokens.List;
      blocks.push({
        type: "list",
        ordered: Boolean(t.ordered),
        items: t.items.map((item) => plain(item.text)),
        position: position++,
      });
    } else if (token.type === "table") {
      const t = token as Tokens.Table;
      const rows: { text: string }[][] = [];
      rows.push(t.header.map((cell) => ({ text: plain(cell.text) })));
      for (const row of t.rows) {
        rows.push(row.map((cell) => ({ text: plain(cell.text) })));
      }
      blocks.push({ type: "table", rows, position: position++ });
    } else if (token.type === "space") {
      // ignore
    } else {
      warnings.push(`Unsupported markdown block type "${token.type}" was skipped`);
    }
  }

  return { blocks, warnings };
}

function plain(text: string): string {
  // marked's inline text keeps markdown emphasis markers (**, _, `) for
  // "text" tokens depending on version; strip the common inline markers so
  // downstream skeleton/wording comparisons see plain prose.
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .trim();
}
