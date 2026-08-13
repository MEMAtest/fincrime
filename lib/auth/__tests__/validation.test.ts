import { describe, expect, it } from "vitest";
import { isValidEmail, isValidPassword, isUuid, normalizeEmail, MIN_PASSWORD_LENGTH } from "../validation";

describe("isValidEmail", () => {
  it("accepts a normal email", () => {
    expect(isValidEmail("ademola@memaconsultants.com")).toBe(true);
  });
  it("rejects missing @", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
  });
  it("rejects missing domain dot", () => {
    expect(isValidEmail("a@b")).toBe(false);
  });
  it("rejects non-strings", () => {
    expect(isValidEmail(42)).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
  });
  it("rejects overly long values", () => {
    expect(isValidEmail(`${"a".repeat(260)}@b.com`)).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Ademola@MemaConsultants.com  ")).toBe("ademola@memaconsultants.com");
  });
});

describe("isValidPassword", () => {
  it("rejects a password shorter than the minimum", () => {
    expect(isValidPassword("a".repeat(MIN_PASSWORD_LENGTH - 1))).toBe(false);
  });
  it("accepts a password exactly at the minimum", () => {
    expect(isValidPassword("a".repeat(MIN_PASSWORD_LENGTH))).toBe(true);
  });
  it("rejects non-strings", () => {
    expect(isValidPassword(12345678901)).toBe(false);
  });
});

describe("isUuid", () => {
  it("accepts a valid uuid", () => {
    expect(isUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  });
  it("rejects a non-uuid", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
  });
});
