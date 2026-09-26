import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RunOutcome } from "../src/run.js";
import { run } from "../src/run.js";
import { startMockAnthropic, type MockServer } from "./mock-anthropic.js";

const FIXTURE = path.resolve(import.meta.dirname, "../fixtures/buggy-site");

describe("qabot against the seeded buggy site (Anthropic API backend)", () => {
  let mock: MockServer;
  let outcome: RunOutcome;
  const env = { ...process.env };

  beforeAll(async () => {
    mock = await startMockAnthropic();
    process.env.ANTHROPIC_BASE_URL = mock.url;
    process.env.ANTHROPIC_API_KEY = "test-key";
    outcome = await run({
      target: FIXTURE,
      overrides: {
        out: fs.mkdtempSync(path.join(os.tmpdir(), "qabot-e2e-")),
        checks: { externalLinks: false, visual: false },
        ai: { provider: "api", model: "claude-opus-5", uxReviewPages: 1, explorerSteps: 8 },
      },
    });
  }, 180_000);

  afterAll(async () => {
    process.env = env;
    await mock?.close();
  });

  const rules = () => new Set(outcome.report.findings.map((f) => f.ruleId));

  it("catches the seeded functional bugs", () => {
    const r = rules();
    expect(r).toContain("interaction-exception"); // "Get started" throws
    expect(r).toContain("link-broken-internal"); // /pricing.html, /careers.html
    expect(r).toContain("ui-broken-image");
    expect(r).toContain("content-suspicious-nan");
    expect(r).toContain("content-suspicious-invalid-date");
    expect(r).toContain("ui-dead-click"); // "Learn more"
    expect(r).toContain("link-broken-anchor"); // #features
  });

  it("catches the seeded UI, responsive and accessibility bugs", () => {
    const r = rules();
    expect(r).toContain("responsive-horizontal-scroll");
    expect(r).toContain("a11y-focus-indicator");
    expect(r).toContain("a11y-zoom-disabled");
    expect(r).toContain("axe:image-alt");
    expect(r).toContain("axe:color-contrast");
    expect(r).toContain("a11y-small-tap-targets");
  });

  it("points findings at source files", () => {
    const exc = outcome.report.findings.find((f) => f.ruleId === "interaction-exception");
    expect(exc?.files).toContain("index.html");
  });

  it("drives the computer-use explorer with protocol-valid tool results", () => {
    expect(mock.violations).toEqual([]);
    const explorer = outcome.report.ai?.explorer;
    expect(explorer?.summary).toBe("Tested home and about pages.");
    expect(explorer?.steps.some((s) => s.kind === "action" && s.text.startsWith("left_click"))).toBe(true);
    const found = outcome.report.findings.find((f) => f.source === "ai-explorer");
    expect(found?.title).toMatch(/Invalid Date/);
    expect(found?.occurrences[0].screenshot).toMatch(/explorer\/issue-1\.png/);
    // page_signals must surface the console error the About page logs on load.
    const explorerRequests = mock.requests.filter((r) => r.tools?.some((t) => t.type === "computer_toolset_20260801"));
    const signals = JSON.stringify(explorerRequests.at(-1)?.messages);
    expect(signals).toContain("Team API failed");
  });

  it("merges AI UX findings and triage into the report", () => {
    expect(outcome.report.findings.some((f) => f.source === "ai-ux")).toBe(true);
    expect(outcome.report.ai?.executiveSummary).toMatch(/Mock triage/);
    expect(outcome.report.ai?.releaseRecommendation).toBe("ship_with_fixes");
    expect(outcome.report.ai?.usage.requests).toBeGreaterThan(3);
  });

  it("writes HTML, Markdown and JSON reports and fails the build", () => {
    for (const f of ["index.html", "report.md", "report.json"]) expect(fs.existsSync(path.join(outcome.outDir, f))).toBe(true);
    expect(outcome.exitCode).toBe(1);
    expect(outcome.report.verdict).toBe("fail");
  });
});
