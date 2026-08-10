import { describe, expect, it } from "vitest";
import { contentTypeMatchesMagicBytes, sanitiseFileName } from "../file-validation";

describe("sanitiseFileName", () => {
  it("strips path separators", () => {
    expect(sanitiseFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitiseFileName("C:\\Users\\me\\report.pdf")).toBe("report.pdf");
  });

  it("collapses unsafe characters", () => {
    expect(sanitiseFileName("my file (final) v2.pdf")).toBe("my_file__final__v2.pdf");
  });

  it("preserves the extension when truncating a long name", () => {
    const longName = `${"a".repeat(200)}.pdf`;
    const result = sanitiseFileName(longName);
    expect(result.length).toBeLessThanOrEqual(150);
    expect(result.endsWith(".pdf")).toBe(true);
  });

  it("preserves a long/unusual but plausible extension length within bounds", () => {
    const longName = `${"a".repeat(160)}.docx`;
    const result = sanitiseFileName(longName);
    expect(result.endsWith(".docx")).toBe(true);
  });

  it("falls back to a plain truncation when there is no short trailing extension", () => {
    const longNameNoExt = "a".repeat(200);
    const result = sanitiseFileName(longNameNoExt);
    expect(result.length).toBeLessThanOrEqual(150);
  });

  it("never returns empty", () => {
    expect(sanitiseFileName("")).toBe("file");
    expect(sanitiseFileName("///")).toBe("file");
  });
});

function bytesFrom(nums: number[], padTo = 16): Uint8Array {
  const arr = new Uint8Array(padTo);
  arr.set(nums);
  return arr;
}

describe("contentTypeMatchesMagicBytes", () => {
  it("accepts a genuine PDF header", () => {
    expect(contentTypeMatchesMagicBytes("application/pdf", bytesFrom([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(true);
  });

  it("rejects bytes that do not match the declared PDF type", () => {
    expect(contentTypeMatchesMagicBytes("application/pdf", bytesFrom([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });

  it("accepts a genuine PNG header", () => {
    expect(
      contentTypeMatchesMagicBytes("image/png", bytesFrom([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ).toBe(true);
  });

  it("accepts a genuine JPEG header", () => {
    expect(contentTypeMatchesMagicBytes("image/jpeg", bytesFrom([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
  });

  it("rejects a PDF declared as a JPEG (the mismatch this check exists for)", () => {
    expect(contentTypeMatchesMagicBytes("image/jpeg", bytesFrom([0x25, 0x50, 0x44, 0x46]))).toBe(false);
  });

  it("accepts a zip-based docx/xlsx local-file-header signature for both office types", () => {
    const zipHeader = bytesFrom([0x50, 0x4b, 0x03, 0x04]);
    expect(contentTypeMatchesMagicBytes("application/vnd.openxmlformats-officedocument.wordprocessingml.document", zipHeader)).toBe(
      true
    );
    expect(
      contentTypeMatchesMagicBytes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", zipHeader)
    ).toBe(true);
  });

  it("rejects non-zip bytes declared as docx", () => {
    expect(
      contentTypeMatchesMagicBytes(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        bytesFrom([0x25, 0x50, 0x44, 0x46])
      )
    ).toBe(false);
  });

  it("accepts anything for csv/txt, which have no reliable signature", () => {
    expect(contentTypeMatchesMagicBytes("text/csv", bytesFrom([0x61, 0x62, 0x63]))).toBe(true);
    expect(contentTypeMatchesMagicBytes("text/plain", bytesFrom([]))).toBe(true);
  });

  it("rejects a content type not on the allowlist outright", () => {
    expect(contentTypeMatchesMagicBytes("application/x-msdownload", bytesFrom([0x4d, 0x5a]))).toBe(false);
  });
});
