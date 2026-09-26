import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RunOutcome } from "../src/run.js";
import { run } from "../src/run.js";

const FIXTURE = path.resolve(import.meta.dirname, "../fixtures/buggy-site");
const FAKE = path.resolve(import.meta.dirname, "fake-claude.mjs");

interface LogEntry {
  kind: string;
  args: string[];
  props?: string[];
  shots?: string[];
  shotsExist?: boolean;
  tools?: string[];
  calls?: { name: string; isError: boolean; types: string[]; text: string }[];
}

describe("qabot with the Claude Code backend (no API key)", () => {
  let outcome: RunOutcome;
  let entries: LogEntry[];
  const env = { ...process.env };
  const logFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "qabot-cc-")), "calls.jsonl");

  beforeAll(async () => {
    fs.chmodSync(FAKE, 0o755);
    process.env.QABOT_CLAUDE_BIN = FAKE;
    process.env.FAKE_CLAUDE_LOG = logFile;
    delete process.env.ANTHROPIC_API_KEY;
    outcome = await run({
      target: FIXTURE,
      overrides: {
        out: fs.mkdtempSync(path.join(os.tmpdir(), "qabot-cc-out-")),
        checks: { externalLinks: false, visual: false },
        ai: { provider: "claude-code", uxReviewPages: 1, explorerSteps: 8 },
      },
    });
    entries = fs.readFileSync(logFile, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  }, 180_000);

  afterAll(() => {
    process.env = env;
  });

  it("runs headless with locked-down flags", () => {
    for (const e of entries) {
      expect(e.args).toEqual(expect.arrayContaining(["-p", "--output-format", "json", "--no-session-persistence", "--permission-mode", "dontAsk", "--strict-mcp-config"]));
      expect(e.args[e.args.indexOf("--model") + 1]).toBe("sonnet");
    }
    expect(outcome.report.ai?.backend).toBe("claude-code");
  });

  it("hands screenshots to the UX review as readable files and merges its findings", () => {
    const ux = entries.find((e) => e.props?.includes("page_purpose"));
    expect(ux?.args[ux.args.indexOf("--tools") + 1]).toBe("Read");
    expect(ux?.shots?.length).toBeGreaterThan(0);
    expect(ux?.shotsExist).toBe(true);
    expect(outcome.report.findings.some((f) => f.source === "ai-ux" && /call to action/.test(f.title))).toBe(true);
    expect(outcome.report.ai?.uxScores?.[0]?.score).toBe(58);
  });

  it("serves the browser to Claude Code over MCP with the safety rails on", () => {
    const ex = entries.find((e) => e.kind === "explore")!;
    expect(ex.tools).toEqual(expect.arrayContaining(["screenshot", "click_text", "fill", "page_signals", "report_issue", "finish"]));
    expect(ex.args[ex.args.indexOf("--tools") + 1]).toBe("");
    const calls = ex.calls!;
    expect(calls.find((c) => c.name === "screenshot")?.types).toEqual(["image"]);
    expect(calls.find((c) => c.name === "click_text")?.isError).toBe(false);
    expect(calls.find((c) => c.name === "page_signals")?.text).toContain("Team API failed");
    expect(calls.find((c) => c.name === "fill")?.isError).toBe(false);
    expect(calls.find((c) => c.name === "navigate" && /Refused/.test(c.text))).toBeTruthy();
    const issue = outcome.report.findings.find((f) => f.source === "ai-explorer");
    expect(issue?.title).toBe("Contact form gives no feedback after Send");
    expect(issue?.occurrences[0].screenshot).toMatch(/explorer\/issue-1\.png/);
    expect(outcome.report.ai?.explorer?.summary).toBe("Explored home, about and contact.");
  });

  it("uses triage and reports usage without an API key", () => {
    expect(outcome.report.ai?.executiveSummary).toMatch(/Fake triage via Claude Code/);
    expect(outcome.report.ai?.releaseRecommendation).toBe("block");
    expect(outcome.report.ai?.usage.costUsd).toBeGreaterThan(0);
    expect(outcome.report.warnings.some((w) => /API key/i.test(w))).toBe(false);
  });
});
