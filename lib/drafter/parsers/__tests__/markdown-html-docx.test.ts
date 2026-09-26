import { describe, it, expect } from "vitest";
import { parseMarkdown } from "../markdown";
import { parseHtml } from "../html";
import { parseDocx } from "../docx";
import { Document, Packer, Paragraph, HeadingLevel } from "docx";

describe("markdown parser", () => {
  it("keeps heading levels, paragraphs, lists and tables in order", () => {
    const md = `# Title\n\nIntro paragraph.\n\n## Section\n\n- one\n- two\n\n| A | B |\n|---|---|\n| 1 | 2 |\n`;
    const parsed = parseMarkdown(md);
    expect(parsed.blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "heading", "list", "table"]);
    const heading = parsed.blocks[0];
    expect(heading.type === "heading" && heading.level).toBe(1);
    const table = parsed.blocks[4];
    expect(table.type === "table" && table.rows[0].map((c) => c.text)).toEqual(["A", "B"]);
  });
});

describe("html parser", () => {
  it("strips script/style and maps headings, lists, tables", () => {
    const html = `<html><head><style>body{color:red}</style></head><body>
      <script>alert(1)</script>
      <h2>Section 2</h2>
      <p>A paragraph.</p>
      <ul><li>Item 1</li><li>Item 2</li></ul>
      <table><tr><th>Col</th></tr><tr><td>Val</td></tr></table>
    </body></html>`;
    const parsed = parseHtml(html);
    expect(parsed.blocks.some((b) => b.type === "heading" && b.level === 2 && b.text === "Section 2")).toBe(true);
    expect(parsed.blocks.some((b) => b.type === "list" && b.items.length === 2)).toBe(true);
    expect(parsed.blocks.some((b) => b.type === "table")).toBe(true);
    const asText = JSON.stringify(parsed.blocks);
    expect(asText).not.toContain("alert(1)");
  });
});

describe("docx parser", () => {
  it("parses a generated docx into headings and paragraphs", async () => {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: "2.1 Customer Due Diligence", heading: HeadingLevel.HEADING_2 }),
            new Paragraph("Body text for the section."),
          ],
        },
      ],
    });
    const buffer = Buffer.from(await Packer.toBuffer(doc));
    const parsed = await parseDocx(buffer);
    expect(parsed.blocks.some((b) => b.type === "heading" && b.text.includes("Customer Due Diligence"))).toBe(true);
    expect(parsed.blocks.some((b) => b.type === "paragraph" && b.text.includes("Body text"))).toBe(true);
  });
});
