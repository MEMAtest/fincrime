import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { readFileSync } from "node:fs";
import path from "node:path";
import { guardZipBounds, MAX_ZIP_UNCOMPRESSED_BYTES, MAX_ZIP_ENTRIES } from "../zip-guard";

describe("guardZipBounds", () => {
  it("passes a normal small .docx fixture", async () => {
    const bytes = readFileSync(path.join(process.cwd(), "test/fixtures/drafter/approved-pra.docx"));
    const result = await guardZipBounds(bytes);
    expect(result.ok).toBe(true);
  });

  it("passes a normal small .xlsx fixture", async () => {
    const bytes = readFileSync(path.join(process.cwd(), "test/fixtures/drafter/register.xlsx"));
    const result = await guardZipBounds(bytes);
    expect(result.ok).toBe(true);
  });

  it("rejects a crafted high-ratio zip bomb (single entry, huge uncompressed size)", async () => {
    // A single highly-repetitive 250MB text file compresses to a few KB but
    // would inflate well past MAX_ZIP_UNCOMPRESSED_BYTES.
    const zip = new JSZip();
    const bombSize = MAX_ZIP_UNCOMPRESSED_BYTES + 10 * 1024 * 1024; // 10MB over the cap
    zip.file("bomb.xml", "A".repeat(bombSize), { compression: "DEFLATE", compressionOptions: { level: 9 } });
    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
    // Sanity check this really is a high-ratio "bomb": compressed far smaller than declared uncompressed size.
    expect(buffer.length).toBeLessThan(1024 * 1024);

    const result = await guardZipBounds(buffer);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/uncompressed/i);
  }, 30000);

  it("rejects a zip with more entries than the entry-count cap", async () => {
    const zip = new JSZip();
    for (let i = 0; i < MAX_ZIP_ENTRIES + 5; i++) {
      zip.file(`f${i}.txt`, "x");
    }
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const result = await guardZipBounds(buffer);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/entries/i);
  }, 30000);

  it("rejects something that is not a zip at all", async () => {
    const result = await guardZipBounds(Buffer.from("not a zip file at all"));
    expect(result.ok).toBe(false);
  });
});
