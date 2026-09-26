import { parse, type HTMLElement, type Node } from "node-html-parser";
import type { DocBlock, ParsedDocument } from "../blocks";

const HEADING_RE = /^h([1-6])$/i;

/**
 * Parses HTML (e.g. a Confluence export) into the internal block structure.
 * Strips <script> and <style> before walking the tree, per SPEC.md.
 */
export function parseHtml(source: string): ParsedDocument {
  const root = parse(source);
  root.querySelectorAll("script, style").forEach((el) => el.remove());

  const blocks: DocBlock[] = [];
  const warnings: string[] = [];
  let position = 0;

  const body = root.querySelector("body") ?? root;

  function walk(node: Node): void {
    const el = node as HTMLElement;
    const tag = (el.tagName || "").toLowerCase();

    const headingMatch = HEADING_RE.exec(tag);
    if (headingMatch) {
      const text = el.text.trim().replace(/\s+/g, " ");
      if (text) blocks.push({ type: "heading", level: Number(headingMatch[1]), text, position: position++ });
      return;
    }

    if (tag === "p") {
      const text = el.text.trim().replace(/\s+/g, " ");
      if (text) blocks.push({ type: "paragraph", text, position: position++ });
      return;
    }

    if (tag === "ul" || tag === "ol") {
      const items = el
        .querySelectorAll("li")
        .map((li) => li.text.trim().replace(/\s+/g, " "))
        .filter(Boolean);
      if (items.length) blocks.push({ type: "list", ordered: tag === "ol", items, position: position++ });
      return;
    }

    if (tag === "table") {
      const rows = el.querySelectorAll("tr").map((tr) =>
        tr.querySelectorAll("th, td").map((cell) => ({ text: cell.text.trim().replace(/\s+/g, " ") }))
      );
      if (rows.length) blocks.push({ type: "table", rows, position: position++ });
      return;
    }

    // Recurse for container tags (div, section, body, etc.) that hold real
    // content elements without themselves mapping to a block type.
    for (const child of el.childNodes) {
      if ((child as HTMLElement).tagName) walk(child);
    }
  }

  for (const child of (body as HTMLElement).childNodes) {
    if ((child as HTMLElement).tagName) walk(child);
  }

  if (blocks.length === 0) warnings.push("No headings, paragraphs, lists or tables were found in this HTML file");

  return { blocks, warnings };
}
