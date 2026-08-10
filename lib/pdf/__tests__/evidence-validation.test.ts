import { describe, expect, it } from "vitest";
import { isValidExportEvidence, isNumOrNullOrUndef, isStrOrNullOrUndef } from "../evidence-validation";

/**
 * Regression coverage for the must-fix defect: a pack export 400ing
 * whenever an evidence item lacks fileName/fileSizeBytes, because
 * JSON.stringify drops an `undefined` key entirely. Two real scenarios hit
 * this shape - prod not yet having migration 009 (e.file_name genuinely
 * undefined), and a rolling deploy where an old browser bundle sends the
 * pre-migration evidence shape - so a MISSING key must always be accepted,
 * while a present-but-wrong-typed value must still be rejected.
 */
describe("isValidExportEvidence", () => {
  const base = { title: "Sample export", type: "sample_export", description: null, linkUrl: null };

  it("accepts an evidence item with fileName/fileSizeBytes entirely absent (pre-migration / rolling-deploy shape)", () => {
    expect(isValidExportEvidence({ ...base })).toBe(true);
  });

  it("accepts explicit null fileName/fileSizeBytes (link-only evidence)", () => {
    expect(isValidExportEvidence({ ...base, fileName: null, fileSizeBytes: null })).toBe(true);
  });

  it("accepts a real attached file", () => {
    expect(isValidExportEvidence({ ...base, fileName: "sample.pdf", fileSizeBytes: 1024 })).toBe(true);
  });

  it("rejects a present-but-wrong-typed fileName", () => {
    expect(isValidExportEvidence({ ...base, fileName: 42 })).toBe(false);
  });

  it("rejects a present-but-wrong-typed fileSizeBytes", () => {
    expect(isValidExportEvidence({ ...base, fileSizeBytes: "1024" })).toBe(false);
  });

  it("rejects a non-finite fileSizeBytes", () => {
    expect(isValidExportEvidence({ ...base, fileSizeBytes: Number.POSITIVE_INFINITY })).toBe(false);
  });

  it("still requires title and type", () => {
    expect(isValidExportEvidence({ ...base, title: undefined })).toBe(false);
    expect(isValidExportEvidence({ ...base, type: undefined })).toBe(false);
  });

  it("rejects a null or non-object item", () => {
    expect(isValidExportEvidence(null)).toBe(false);
    expect(isValidExportEvidence("evidence")).toBe(false);
  });
});

describe("isStrOrNullOrUndef / isNumOrNullOrUndef", () => {
  it("accept undefined, null and the correct type", () => {
    expect(isStrOrNullOrUndef(undefined)).toBe(true);
    expect(isStrOrNullOrUndef(null)).toBe(true);
    expect(isStrOrNullOrUndef("x")).toBe(true);
    expect(isNumOrNullOrUndef(undefined)).toBe(true);
    expect(isNumOrNullOrUndef(null)).toBe(true);
    expect(isNumOrNullOrUndef(5)).toBe(true);
  });

  it("reject the wrong type", () => {
    expect(isStrOrNullOrUndef(5)).toBe(false);
    expect(isNumOrNullOrUndef("5")).toBe(false);
  });
});
