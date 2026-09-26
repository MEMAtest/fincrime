import { describe, it, expect } from "vitest";
import { detectDocType } from "../doc-type-detect";
import { parseMarkdown } from "../parsers/markdown";

describe("detectDocType", () => {
  it("suggests register for any xlsx upload", () => {
    const result = detectDocType("xlsx", { blocks: [], warnings: [] });
    expect(result.suggestedType).toBe("register");
    expect(result.registerRejected).toBe(false);
  });

  it("rejects a markdown register summary containing a citation artifact", () => {
    const md = "# Summary\n\nREQ-0001 is covered [cite: 6].";
    const parsed = parseMarkdown(md);
    const result = detectDocType("md", parsed, md);
    expect(result.registerRejected).toBe(true);
    expect(result.registerRejectedReason).toMatch(/original spreadsheet/i);
  });

  it("suggests pra for numbered PRA-style sections", () => {
    const md = "# Product Risk Assessment\n\n## 2.2 Customer Due Diligence (CDD)\n\nText.";
    const parsed = parseMarkdown(md);
    const result = detectDocType("md", parsed, md);
    expect(result.suggestedType).toBe("pra");
  });

  it("suggests style_brief when the content says so", () => {
    const md = "# House Style Brief\n\nTone of voice rules.";
    const parsed = parseMarkdown(md);
    const result = detectDocType("md", parsed, md);
    expect(result.suggestedType).toBe("style_brief");
  });
});
