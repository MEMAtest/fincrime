import fs from "node:fs";
import path from "node:path";
import type { Browser } from "playwright";
import { AiClient, aiCredentialsAvailable } from "./ai/client.js";
import { runExplorer } from "./ai/explorer.js";
import { runTriage } from "./ai/triage.js";
import { runUxReview } from "./ai/ux-review.js";
import { launchBrowser, prepareAuth } from "./browser.js";
import { probeApis } from "./checks/api-probe.js";
import { runBrowserSuite, type SuiteResult } from "./checks/browser-suite.js";
import { runCodeChecks } from "./checks/code.js";
import { checkLinks } from "./checks/links.js";
import { loadConfig, mergeConfig, type DeepPartial, type QaConfig } from "./config.js";
import { discoverEndpoints } from "./discover/api.js";
import { discoverRoutes } from "./discover/routes.js";
import { enrichFilesFromSelectors } from "./discover/source-map.js";
import { computeScores, countBySeverity, FindingSink, meetsThreshold, verdictFor } from "./findings.js";
import { renderHtml } from "./report/html.js";
import { renderMarkdown } from "./report/markdown.js";
import { detectStack } from "./target/detect.js";
import { extractServerErrors, launchApp, type LaunchedApp } from "./target/launch.js";
import type { AiSummary, ApiProbeResult, Category, CodeCheckResult, EndpointSpec, RouteInfo, RunReport, StackInfo } from "./types.js";
import { ensureDir, isLocalHost, log, mapLimit, relPath, truncate } from "./util.js";

export const VERSION = "0.1.0";

export interface RunOptions {
  target: string;
  configPath?: string;
  overrides: DeepPartial<QaConfig>;
}

export interface RunOutcome {
  report: RunReport;
  outDir: string;
  exitCode: number;
}

function stamp(d: Date) {
  return d.toISOString().replace(/[:.]/g, "-").replace(/-\d{3}Z$/, "");
}

export async function run(opts: RunOptions): Promise<RunOutcome> {
  const started = new Date();
  const isUrl = /^https?:\/\//i.test(opts.target);
  const repoPath = isUrl ? undefined : path.resolve(opts.target);
  if (repoPath && !fs.existsSync(repoPath)) throw new Error(`Target not found: ${repoPath}`);

  const loaded = loadConfig(opts.configPath, repoPath);
  const cfg = mergeConfig(loaded.config, opts.overrides);
  if (loaded.file) log.info(`Config: ${loaded.file}`);
  const outDir = path.resolve(cfg.out ?? path.join(process.cwd(), "qabot-report", stamp(started)));
  ensureDir(outDir);
  const sink = new FindingSink(cfg.ignore);
  const warnings: string[] = [];
  const notes: string[] = [];

  // ------------------------------------------------------------ understand the target
  let stack: StackInfo | undefined;
  let routes: RouteInfo[] = [];
  let endpoints: EndpointSpec[] = [];
  if (repoPath) {
    log.step("Analysing codebase");
    stack = detectStack(repoPath);
    routes = discoverRoutes(repoPath, stack, cfg.routes.params, cfg.ignorePaths);
    endpoints = discoverEndpoints(repoPath, stack, cfg.ignorePaths);
    log.info(`Stack: ${stack.framework} (${stack.kind}${stack.packageManager ? `, ${stack.packageManager}` : ""})`);
    log.info(`Found ${routes.length} page routes and ${endpoints.length} API endpoints in code`);
  }
  const rel = (f?: string) => relPath(repoPath, f);
  const routeFiles = new Map(routes.filter((r) => r.file).map((r) => [r.path, rel(r.file)!]));
  const testable = routes.filter((r) => !r.dynamic);
  const skippedRoutes = routes.filter((r) => r.dynamic).map((r) => ({ ...r, file: rel(r.file) }));
  for (const inc of cfg.routes.include) testable.push({ path: inc, source: "config" });

  // ------------------------------------------------------------ get a running app
  let app: LaunchedApp | undefined;
  let baseUrl = cfg.baseUrl ?? (isUrl ? opts.target : "");
  if (!baseUrl && repoPath && stack) {
    log.step("Starting the app");
    try {
      app = await launchApp(repoPath, stack, cfg);
      baseUrl = app.baseUrl;
    } catch (e) {
      const err = e as Error & { output?: string };
      sink.add({
        ruleId: cfg.mode === "prod" && /build failed/i.test(err.message) ? "code-build" : "app-start-failed",
        title: cfg.mode === "prod" && /build failed/i.test(err.message) ? "Production build fails" : "The app could not be started",
        severity: "critical",
        category: "code",
        description: `${err.message}${err.output ? `\n\n${truncate(err.output.slice(-4000), 4000)}` : ""}`,
        recommendation: 'Fix the error above, or set "start.command" / "baseUrl" in qabot.config.json.',
        source: "code",
      });
      log.warn(err.message.split("\n")[0]);
    }
  }
  baseUrl = baseUrl.replace(/\/+$/, "");
  const isLocal = baseUrl ? isLocalHost(baseUrl) : true;
  const allowMutations = cfg.allowMutations ?? isLocal;
  const isDevServer = (!!app && cfg.mode === "dev" && stack?.kind !== "static") || (!app && isLocal && cfg.mode === "dev");
  if (!allowMutations) notes.push("Safe mode: no POST/PUT/PATCH/DELETE probes were sent and form submissions were skipped.");
  if (isDevServer) notes.push("Tested against a development server: performance numbers are pessimistic and some warnings are dev-only.");

  const aiWanted = cfg.ai.enabled && (cfg.ai.uxReviewPages > 0 || cfg.ai.explorer || cfg.ai.triage);
  let ai: AiClient | undefined;
  if (aiWanted) {
    if (aiCredentialsAvailable()) ai = new AiClient(cfg.ai.model, cfg.ai.effort);
    else warnings.push("AI checks skipped: set ANTHROPIC_API_KEY (or run `ant auth login`) to enable the UX review, explorer and triage.");
  }
  const aiSummary: AiSummary | undefined = ai ? { model: ai.model, usage: ai.usage, errors: ai.errors } : undefined;

  let suite: SuiteResult | undefined;
  let apiResults: ApiProbeResult[] = [];
  let browser: Browser | undefined;
  try {
    if (baseUrl) {
      const logCursor = app?.logCursor() ?? 0;
      // Dev servers compile routes on first hit; warm them so page timings reflect rendering, not compilation.
      if (app && isDevServer && testable.length) {
        log.step(`Warming up ${Math.min(testable.length, cfg.maxPages)} routes`);
        await mapLimit(testable.slice(0, cfg.maxPages), 2, async (r) => {
          try {
            const res = await fetch(baseUrl + r.path, { signal: AbortSignal.timeout(180_000) });
            await res.body?.cancel();
          } catch {
            /* reported by the browser pass */
          }
        });
      }

      log.step(`Browser checks on ${baseUrl}`);
      browser = await launchBrowser(cfg.headed);
      const storageState = await prepareAuth(browser, baseUrl, cfg, outDir);
      suite = await runBrowserSuite({
        browser,
        baseUrl,
        cfg,
        sink,
        outDir,
        storageState,
        seeds: testable,
        routeFiles,
        isLocal,
        isDevServer,
        allowMutations,
        baselineDir: cfg.checks.visual ? path.resolve(cfg.visual.baselineDir ?? path.join(repoPath ?? process.cwd(), ".qabot", "baseline")) : undefined,
        aiShotPages: ai ? cfg.ai.uxReviewPages : 0,
      });

      const unreachable = new Set<string>();
      for (const f of sink.all()) {
        const m = f.ruleId === "network-third-party" && f.description.match(/^\w+ (https?:\/\/[^/\s]+)\S* → net::ERR_(TUNNEL_CONNECTION_FAILED|NAME_NOT_RESOLVED|PROXY_CONNECTION_FAILED|CONNECTION_REFUSED|CONNECTION_TIMED_OUT|INTERNET_DISCONNECTED)/);
        if (m) unreachable.add(new URL(m[1]).host);
      }
      if (unreachable.size) {
        notes.push(
          `Third-party hosts were unreachable from this machine (${[...unreachable].slice(0, 6).join(", ")}). JavaScript errors that depend on them may be caused by the test environment's network, not the app, though the app should still fail gracefully.`,
        );
      }

      if (cfg.checks.links) {
        log.step("Checking links");
        const stats = await checkLinks({
          sink,
          linkSources: suite.linkSources,
          externalLinks: suite.externalLinks,
          statusByUrl: suite.statusByUrl,
          checkExternal: cfg.checks.externalLinks,
          headers: cfg.headers,
        });
        log.info(`${stats.internalChecked} internal and ${stats.externalChecked} external links checked`);
      }

      if (cfg.api.enabled) {
        const all = new Map<string, EndpointSpec>();
        for (const e of [...endpoints, ...cfg.api.endpoints]) all.set(`${e.method} ${e.path}`, e);
        for (const e of suite.networkEndpoints) {
          if (e.method === "GET" && !all.has(`GET ${e.path}`) && ![...all.values()].some((x) => x.path === e.path)) all.set(`GET ${e.path}`, e);
        }
        if (all.size) {
          log.step(`Probing ${all.size} API endpoints${allowMutations ? "" : " (safe mode: read-only)"}`);
          apiResults = await probeApis({ baseUrl, endpoints: [...all.values()], sink, headers: cfg.headers, allowMutations, isDevServer, repoRelative: rel });
          const bugs = apiResults.filter((a) => a.verdict === "bug").length;
          log.info(`${apiResults.length} probes, ${bugs} problems`);
        }
      }

      if (ai && cfg.ai.uxReviewPages > 0 && suite.aiShots.size) {
        log.step("AI UX review");
        const known = sink.all();
        const pages = [...suite.aiShots.entries()].map(([url, s]) => ({ url, desktop: s.desktop, mobile: s.mobile, info: suite!.pageInfos.get(url), known }));
        aiSummary!.uxScores = await runUxReview(ai, pages, outDir, sink);
      }

      if (ai && cfg.ai.explorer && cfg.ai.explorerSteps > 0) {
        log.step(`AI exploratory testing (computer use, up to ${cfg.ai.explorerSteps} turns)`);
        const siteMap = [...new Set([...suite.crawled.map((c) => c.path), ...skippedRoutes.map((r) => `${r.path} (dynamic)`)])];
        aiSummary!.explorer = await runExplorer({
          ai,
          browser,
          baseUrl,
          cfg,
          storageState,
          outDir,
          sink,
          siteMap,
          known: sink.all().filter((f) => f.severity !== "info"),
          allowMutations,
          isLocal,
          maxTurns: cfg.ai.explorerSteps,
        });
      }

      if (app) {
        const lines = app.logs();
        const since = Math.max(0, lines.length - (app.logCursor() - logCursor));
        for (const e of extractServerErrors(lines.slice(since))) {
          const external = /(establishing a connection|ENOTFOUND|EAI_AGAIN|getaddrinfo|fetch failed|ETIMEDOUT)[\s\S]*https?:\/\/(?!localhost|127\.0\.0\.1)/i.test(e.excerpt);
          sink.add({
            ruleId: external ? "server-log-external" : "server-log-error",
            key: e.headline,
            title: `Server logged ${external ? "a failed call to an external service" : "an error"} during testing: ${truncate(e.headline, 100)}`,
            severity: external ? "low" : "high",
            category: "backend",
            description: external
              ? `${e.excerpt}\n\nThe server couldn't reach an external host. This can be a network restriction on the machine running qabot, but check the app degrades gracefully when the service is down.`
              : e.excerpt,
            recommendation: "Match the timestamp/route against the failing page or API probe and fix the server-side error.",
            source: "server-log",
          });
        }
      }
    }
  } finally {
    await browser?.close().catch(() => {});
    if (app) {
      log.info("Stopping the app");
      await app.stop();
    }
  }

  let codeResults: CodeCheckResult[] = [];
  if (repoPath && stack && cfg.code.enabled) {
    log.step("Code health checks");
    codeResults = await runCodeChecks(repoPath, stack, cfg, sink);
  }

  if (repoPath) enrichFilesFromSelectors(repoPath, sink.all(), cfg.ignorePaths);

  if (ai && cfg.ai.triage && sink.all().length) {
    log.step("AI triage");
    const t = await runTriage(ai, { sink, findings: sink.all(), stack, baseUrl, routes: routes.map((r) => ({ ...r, file: rel(r.file) })), notes });
    if (t) Object.assign(aiSummary!, t);
  }

  // ------------------------------------------------------------ report
  const findings = sink.all();
  const tested: Category[] = ["functional", "ux", "visual", "content"];
  if (cfg.checks.a11y || cfg.checks.keyboard) tested.push("accessibility");
  if (cfg.viewports.length > 1) tested.push("responsive");
  if (cfg.checks.perf) tested.push("performance");
  if (cfg.checks.security) tested.push("security");
  if (cfg.checks.seo) tested.push("seo");
  if (apiResults.length) tested.push("backend");
  if (codeResults.length) tested.push("code");
  const finished = new Date();
  const report: RunReport = {
    tool: { name: "qabot", version: VERSION },
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
    durationMs: finished.getTime() - started.getTime(),
    target: { input: opts.target, kind: isUrl ? "url" : "repo", baseUrl: baseUrl || "(not started)", repoPath, stack, launched: !!app, mode: app ? cfg.mode : undefined },
    settings: { viewports: cfg.viewports, maxPages: cfg.maxPages, allowMutations, ai: !!ai },
    routes: routes.map((r) => ({ ...r, file: rel(r.file) })),
    skippedRoutes,
    pages: suite?.visits.sort((a, b) => a.path.localeCompare(b.path) || a.viewport.localeCompare(b.viewport)) ?? [],
    api: apiResults,
    code: codeResults,
    findings,
    scores: computeScores(findings, (id) => sink.occurrenceCount(id), tested),
    verdict: verdictFor(findings),
    ai: aiSummary,
    warnings: [...warnings, ...notes],
  };
  const counts = (id: string) => sink.occurrenceCount(id);
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, "report.md"), renderMarkdown(report, counts));
  fs.writeFileSync(path.join(outDir, "index.html"), renderHtml(report, counts));

  const failing = findings.filter((f) => !f.aiNote && meetsThreshold(f.severity, cfg.failOn));
  return { report, outDir, exitCode: failing.length ? 1 : 0 };
}

export function summaryLine(r: RunReport): string {
  const c = countBySeverity(r.findings);
  return `${c.critical} critical · ${c.high} high · ${c.medium} medium · ${c.low} low · ${c.info} info`;
}
