import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseDocx } from "../parsers/docx";
import { extractSkeleton } from "../skeleton";

const FIXTURE = path.join(process.cwd(), "test/fixtures/drafter/approved-pra.docx");

describe("extractSkeleton (docx fixture)", () => {
  it("finds every heading, field label, standard and empty wording intact from the .docx pair", async () => {
    const bytes = readFileSync(FIXTURE);
    const parsed = await parseDocx(bytes);
    const result = extractSkeleton(parsed);

    expect(result.sections.map((s) => s.number)).toEqual(["2.1", "2.2", "2.3", "2.4"]);
    const s23 = result.sections.find((s) => s.number === "2.3")!;
    expect(s23.emptySectionWording).toMatch(/no control enhancements apply/i);
    expect(result.fieldLabels.control_enhancement.toLowerCase()).toBe("control enhancement");
    expect(result.exemplarCandidates.length).toBeGreaterThanOrEqual(3);
  });
});
