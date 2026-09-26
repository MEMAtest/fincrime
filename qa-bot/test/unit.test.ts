import { describe, expect, it } from "vitest";
import { mapKey } from "../src/ai/explorer.js";
import { detectLeak } from "../src/checks/api-probe.js";
import { consoleFinding, networkFinding, type PageCtx } from "../src/checks/rules.js";
import { mergeConfig, defaultConfig } from "../src/config.js";
import { exportedMethods, normalizeParamSyntax } from "../src/discover/api.js";
import { segmentsToPath } from "../src/discover/routes.js";
import { computeScores, FindingSink, meetsThreshold } from "../src/findings.js";
import { extractServerErrors } from "../src/target/launch.js";
import { runScript } from "../src/target/detect.js";

const ctx: PageCtx = { url: "http://localhost:3000/x", viewport: "desktop", isLocal: true, isDevServer: true };

describe("route discovery", () => {
  it("maps Next.js app-router folders to URL paths", () => {
    expect(segmentsToPath(["(marketing)", "pricing"], {}).path).toBe("/pricing");
    expect(segmentsToPath(["blog", "[slug]"], {})).toMatchObject({ path: "/blog/[slug]", dynamic: true });
    expect(segmentsToPath(["blog", "[slug]"], { slug: "hello world" }).path).toBe("/blog/hello%20world");
    expect(segmentsToPath(["docs", "[[...path]]"], {}).path).toBe("/docs");
    expect(segmentsToPath(["@modal", "login"], {}).skip).toBe(true);
    expect(segmentsToPath(["_components"], {}).skip).toBe(true);
    expect(segmentsToPath(["(.)photo"], {}).skip).toBe(true);
  });

  it("reads exported HTTP methods from route handlers", () => {
    const src = `export async function GET() {}\nexport const POST = handler;\nexport { h as DELETE, other };\nexport function helper() {}`;
    expect(exportedMethods(src).sort()).toEqual(["DELETE", "GET", "POST"]);
  });

  it("normalises framework parameter syntax", () => {
    expect(normalizeParamSyntax("/users/:id/posts/{postId}/<int:n>")).toBe("/users/qabot-probe-id/posts/qabot-probe-id/qabot-probe-id");
  });

  it("builds package-manager script commands", () => {
    expect(runScript("npm", "dev", "-p 3000")).toBe("npm run dev -- -p 3000");
    expect(runScript("pnpm", "dev", "--port 3000")).toBe("pnpm run dev --port 3000");
    expect(runScript("yarn", "dev")).toBe("yarn dev");
  });
});

describe("findings", () => {
  it("merges repeats across pages and keeps the worst severity", () => {
    const sink = new FindingSink();
    const base = { ruleId: "console-error", title: "Console error: boom 12", category: "functional" as const, description: "", source: "browser" as const };
    sink.add({ ...base, severity: "medium", key: "boom 12", occurrence: { url: "/a" } });
    sink.add({ ...base, severity: "high", key: "boom 99", occurrence: { url: "/b" } });
    const all = sink.all();
    expect(all).toHaveLength(1);
    expect(all[0].severity).toBe("high");
    expect(sink.occurrenceCount(all[0].id)).toBe(2);
  });

  it("honours ignore rules by glob and by title", () => {
    const sink = new FindingSink(["axe:*", "favicon"]);
    expect(sink.add({ ruleId: "axe:region", title: "x", severity: "low", category: "accessibility", description: "", source: "browser" })).toBeUndefined();
    expect(sink.add({ ruleId: "missing-favicon", title: "favicon.ico returns 404", severity: "low", category: "visual", description: "", source: "browser" })).toBeUndefined();
    expect(sink.all()).toHaveLength(0);
  });

  it("scores and thresholds", () => {
    const sink = new FindingSink();
    sink.add({ ruleId: "a", title: "a", severity: "critical", category: "backend", description: "", source: "api" });
    const s = computeScores(sink.all(), (id) => sink.occurrenceCount(id), ["backend", "seo"]);
    expect(s.byCategory.seo).toBe(100);
    expect(s.byCategory.backend).toBeLessThan(70);
    expect(meetsThreshold("critical", "high")).toBe(true);
    expect(meetsThreshold("medium", "high")).toBe(false);
    expect(meetsThreshold("critical", "none")).toBe(false);
  });

  it("deep-merges config overrides", () => {
    const cfg = mergeConfig(defaultConfig(), { ai: { explorerSteps: 5 }, checks: { a11y: false } });
    expect(cfg.ai.explorerSteps).toBe(5);
    expect(cfg.ai.provider).toBe("auto");
    expect(cfg.checks.a11y).toBe(false);
    expect(cfg.checks.layout).toBe(true);
  });
});

describe("signal classification", () => {
  it("drops dev noise and escalates crashes", () => {
    expect(consoleFinding(ctx, "error", "[HMR] connected")).toBeUndefined();
    expect(consoleFinding(ctx, "error", "Failed to load resource: 404")).toBeUndefined();
    expect(consoleFinding(ctx, "error", "Hydration failed because the server rendered HTML didn't match the client")?.severity).toBe("high");
    expect(consoleFinding(ctx, "warning", "Each child in a list should have a unique \"key\" prop")?.severity).toBe("low");
  });

  it("classifies failed requests by origin and type", () => {
    const origin = "http://localhost:3000";
    expect(networkFinding(ctx, { url: `${origin}/api/x`, method: "GET", status: 500, resourceType: "fetch" }, origin)).toMatchObject({ severity: "high", category: "backend" });
    expect(networkFinding(ctx, { url: `${origin}/app.js`, method: "GET", status: 404, resourceType: "script" }, origin)?.severity).toBe("high");
    expect(networkFinding(ctx, { url: "https://cdn.example.com/a.js", method: "GET", status: 404, resourceType: "script" }, origin)?.severity).toBe("low");
    expect(networkFinding(ctx, { url: `${origin}/_next/webpack-hmr`, method: "GET", failure: "x", resourceType: "websocket" }, origin)).toBeUndefined();
    expect(networkFinding(ctx, { url: `${origin}/_vercel/insights/script.js`, method: "GET", status: 404, resourceType: "script" }, origin)?.severity).toBe("info");
  });

  it("spots leaked internals in API errors", () => {
    expect(detectLeak("Error: boom\n    at handler (/app/src/route.ts:10:5)")).toBe("JavaScript stack trace");
    expect(detectLeak('error: relation "users" does not exist')).toBe("database error");
    expect(detectLeak('{"error":"Not found"}')).toBeUndefined();
  });

  it("extracts distinct server errors from logs", () => {
    const lines = ["✓ Ready in 2s", " ⨯ Error: connect ECONNREFUSED 127.0.0.1:5432", "    at x", " ⨯ Error: connect ECONNREFUSED 127.0.0.1:5432", "GET /api/x 500 in 20ms"];
    const errs = extractServerErrors(lines);
    expect(errs).toHaveLength(1);
    expect(errs[0].headline).toMatch(/ECONNREFUSED/);
  });
});

describe("computer-use key mapping", () => {
  it("translates xdotool names to Playwright", () => {
    expect(mapKey("Return")).toBe("Enter");
    expect(mapKey("ctrl+shift+a")).toBe("Control+Shift+a");
    expect(mapKey("cmd+s")).toBe("Meta+s");
    expect(mapKey("Page_Down")).toBe("PageDown");
    expect(mapKey("F5")).toBe("F5");
  });
});

describe("false-positive guards", () => {
  it("ignores placeholder credentials in docs", async () => {
    const { isPlaceholderSecret } = await import("../src/checks/code.js");
    expect(isPlaceholderSecret("postgresql://user:pass@host:5432/db")).toBe(true);
    expect(isPlaceholderSecret("postgresql://<readonly-user>:<pw>@<host>:5432/db")).toBe(true);
    expect(isPlaceholderSecret("postgresql://${APP_USER}:${PW}@10.0.0.1:5432/db")).toBe(true);
    expect(isPlaceholderSecret("postgresql://app:Zq8vT2mLr0x@db.internal:5432/prod")).toBe(false);
  });

  it("does not mistake constants for MySQL error codes", () => {
    expect(detectLeak('{"theme":"CUSTOMER_DUE_DILIGENCE","HEADER_TEXT":"x"}')).toBeUndefined();
    expect(detectLeak("ER_DUP_ENTRY: Duplicate entry 'a' for key 'PRIMARY'")).toBe("database error");
  });

  it("rates hydration attribute mismatches below hydration failures", () => {
    expect(consoleFinding(ctx, "error", "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.")?.severity).toBe("medium");
    expect(consoleFinding(ctx, "error", "Hydration failed because the initial UI does not match")?.severity).toBe("high");
  });
});

describe("selector → source mapping", () => {
  it("keeps component classes and drops utility classes", async () => {
    const { distinctiveTokens } = await import("../src/discover/source-map.js");
    expect(distinctiveTokens("div.nav-shell:nth-of-type(4) > nav.nav > div.nav-cta.flex.items-center")).toEqual({ classes: ["nav-shell", "nav-cta"], ids: [] });
    expect(distinctiveTokens("#pricing-table > div.p-4").ids).toEqual(["pricing-table"]);
  });
});
