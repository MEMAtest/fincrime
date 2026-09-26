import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { isStubMode, isRoleConfigured, roleDisabledReason, callDrafterModel, PROMPT_VERSIONS } from "../llm";

const ENV_KEYS = [
  "VERCEL_ENV",
  "PRA_MODEL_STUB",
  "PRA_MODEL_STUB_FILE",
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

describe("PRA_MODEL_STUB_FILE fixtures", () => {
  let dir: string;

  beforeEach(() => {
    process.env.PRA_MODEL_STUB = "1";
    dir = mkdtempSync(path.join(tmpdir(), "drafter-stub-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns the default entry for a prompt kind when nothing matches", async () => {
    const file = path.join(dir, "stub.json");
    writeFileSync(
      file,
      JSON.stringify({
        writer: {
          [PROMPT_VERSIONS.writer_enhancement]: {
            default: { response: { control_text: "Default fixture text.", rationale: "Default rationale.", placeholders: [] } },
          },
        },
      })
    );
    process.env.PRA_MODEL_STUB_FILE = file;

    const result = await callDrafterModel({
      role: "writer",
      promptVersion: PROMPT_VERSIONS.writer_enhancement,
      systemPrompt: "system",
      userPrompt: "no matching needle here",
      temperature: 0.2,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect((result.json as { control_text: string }).control_text).toBe("Default fixture text.");
  });

  it("matches an entry by matchIncludes substrings, e.g. to push a bad output for one REQ ID", async () => {
    const file = path.join(dir, "stub.json");
    writeFileSync(
      file,
      JSON.stringify({
        writer: {
          [PROMPT_VERSIONS.writer_enhancement]: {
            default: { response: { control_text: "Good default.", rationale: "ok", placeholders: [] } },
            entries: [
              {
                matchIncludes: ["REQ-0002"],
                response: { control_text: "Invented: reviewed every 4 hours by the Shadow Compliance Unit.", rationale: "bad", placeholders: [] },
              },
            ],
          },
        },
      })
    );
    process.env.PRA_MODEL_STUB_FILE = file;

    const result = await callDrafterModel({
      role: "writer",
      promptVersion: PROMPT_VERSIONS.writer_enhancement,
      systemPrompt: "system",
      userPrompt: "Draft for REQ-0002 obligations.",
      temperature: 0.2,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect((result.json as { control_text: string }).control_text).toContain("Shadow Compliance Unit");
  });

  it("fails visibly (never a silent pass) when the matched entry is malformed JSON", async () => {
    const file = path.join(dir, "stub.json");
    writeFileSync(
      file,
      JSON.stringify({
        judge: {
          [PROMPT_VERSIONS.judge_rubric]: {
            default: { malformed: true },
          },
        },
      })
    );
    process.env.PRA_MODEL_STUB_FILE = file;

    const result = await callDrafterModel({
      role: "judge",
      promptVersion: PROMPT_VERSIONS.judge_rubric,
      systemPrompt: "system",
      userPrompt: "anything",
      temperature: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not valid JSON/i);
  });

  it("falls back to the built-in default response when no stub file is configured", async () => {
    delete process.env.PRA_MODEL_STUB_FILE;
    const result = await callDrafterModel({
      role: "writer",
      promptVersion: PROMPT_VERSIONS.writer_enhancement,
      systemPrompt: "system",
      userPrompt: "anything",
      temperature: 0.2,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect((result.json as { control_text: string }).control_text).toMatch(/^\[STUB /);
  });
});
