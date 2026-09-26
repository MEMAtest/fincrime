import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isStubMode, isRoleConfigured, roleDisabledReason } from "../llm";

const ENV_KEYS = [
  "VERCEL_ENV",
  "PRA_MODEL_STUB",
  "PRA_WRITER_BASE_URL",
  "PRA_WRITER_API_KEY",
  "PRA_WRITER_MODEL",
  "PRA_JUDGE_BASE_URL",
  "PRA_JUDGE_API_KEY",
  "PRA_JUDGE_MODEL",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("stub mode", () => {
  it("is off by default", () => {
    expect(isStubMode()).toBe(false);
  });

  it("turns on with PRA_MODEL_STUB=1 outside production", () => {
    process.env.PRA_MODEL_STUB = "1";
    expect(isStubMode()).toBe(true);
  });

  it("refuses stub mode in production even if PRA_MODEL_STUB=1", () => {
    process.env.PRA_MODEL_STUB = "1";
    process.env.VERCEL_ENV = "production";
    expect(isStubMode()).toBe(false);
  });
});

describe("role configuration", () => {
  it("writer is disabled with no env set", () => {
    expect(isRoleConfigured("writer")).toBe(false);
    expect(roleDisabledReason("writer")).toMatch(/PRA_WRITER_BASE_URL/);
  });

  it("judge is disabled with no env set", () => {
    expect(isRoleConfigured("judge")).toBe(false);
    expect(roleDisabledReason("judge")).toMatch(/PRA_JUDGE_BASE_URL/);
  });

  it("writer is configured once all three env vars are set", () => {
    process.env.PRA_WRITER_BASE_URL = "https://example.test/v1";
    process.env.PRA_WRITER_API_KEY = "key";
    process.env.PRA_WRITER_MODEL = "some-model";
    expect(isRoleConfigured("writer")).toBe(true);
    expect(roleDisabledReason("writer")).toBeNull();
  });

  it("any role reports configured when stub mode is active", () => {
    process.env.PRA_MODEL_STUB = "1";
    expect(isRoleConfigured("writer")).toBe(true);
    expect(isRoleConfigured("judge")).toBe(true);
    expect(isRoleConfigured("tagger")).toBe(true);
  });
});
