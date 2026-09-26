import fs from "node:fs";
import path from "node:path";
import type { Browser, BrowserContext, Page, Response } from "playwright";
import { newContext } from "../browser.js";
import type { QaConfig } from "../config.js";
import type { FindingSink, NewFinding } from "../findings.js";
import type { EndpointSpec, PageVisit, RouteInfo, ViewportName } from "../types.js";
import { ensureDir, log, matchesAny, slugify, truncate } from "../util.js";
import { runAxe } from "./a11y.js";
import {
  auditLayout,
  collectPageInfo,
  listForms,
  perfSnapshot,
  probeFocus,
  tagClickCandidates,
  validationSignals,
  type FocusProbe,
  type PageInfo,
} from "./dom-scripts.js";
import {
  consoleFinding,
  contentFindings,
  cookieFindings,
  layoutFindings,
  networkFinding,
  pageErrorFinding,
  perfFindings,
  securityHeaderFindings,
  type FailedRequest,
  type PageCtx,
} from "./rules.js";
import { compareWithBaseline, updateBaseline } from "./visual.js";

export interface SuiteOptions {
  browser: Browser;
  baseUrl: string;
  cfg: QaConfig;
  sink: FindingSink;
  outDir: string;
  storageState?: string;
  seeds: RouteInfo[];
  /** URL path → repo-relative source file. */
  routeFiles: Map<string, string>;
  isLocal: boolean;
  isDevServer: boolean;
  allowMutations: boolean;
  baselineDir?: string;
  aiShotPages: number;
}

export interface SuiteResult {
  visits: PageVisit[];
  crawled: RouteInfo[];
  /** Normalised same-origin URL → pages that link to it. */
  linkSources: Map<string, Set<string>>;
  externalLinks: Map<string, Set<string>>;
  statusByUrl: Map<string, number | undefined>;
  networkEndpoints: EndpointSpec[];
  pageInfos: Map<string, PageInfo>;
  aiShots: Map<string, { desktop: string[]; mobile: string[] }>;
}

const ASSET_EXT = /\.(png|jpe?g|gif|webp|avif|svg|ico|pdf|zip|gz|tgz|rar|7z|csv|xlsx?|docx?|pptx?|mp[34]|webm|mov|woff2?|ttf|otf|css|js|mjs|map|json|xml|txt|rss|atom)$/i;
/** Links a crawler must never follow: they log you out or mutate data on a plain GET. */
const UNSAFE_LINK = /(log-?out|sign-?out|logoff|\/delete\b|\/remove\b|\/destroy\b|unsubscribe|\/reset\b|\/revoke\b)/i;

export function normalizeUrl(u: URL): string {
  const p = u.pathname.replace(/\/+$/, "") || "/";
  return `${u.origin}${p}${u.search}`;
}

interface Signals {
  console: { type: string; text: string }[];
  pageErrors: string[];
  failed: FailedRequest[];
  api: { method: string; url: string; status: number }[];
  mixed: string[];
  requests: number;
  downloads: number;
  popups: number;
  cursor: { console: number; pageErrors: number; failed: number };
}

function attachSignals(page: Page, origin: string, https: boolean): Signals {
  const s: Signals = {
    console: [],
    pageErrors: [],
    failed: [],
    api: [],
    mixed: [],
    requests: 0,
    downloads: 0,
    popups: 0,
    cursor: { console: 0, pageErrors: 0, failed: 0 },
  };
  page.on("console", (m) => {
    const t = m.type();
    if (t === "error" || t === "warning") s.console.push({ type: t, text: m.text() });
  });
  page.on("pageerror", (e) => {
    const stack = e.stack?.split("\n").slice(1, 5).join("\n");
    s.pageErrors.push(stack ? `${e.message}\n${stack}` : e.message);
  });
  page.on("request", (r) => {
    s.requests++;
    if (https && r.url().startsWith("http:")) s.mixed.push(r.url());
  });
  page.on("requestfailed", (r) => {
    const f = r.failure()?.errorText ?? "failed";
    if (/ERR_ABORTED|NS_BINDING_ABORTED|cancell?ed|ERR_BLOCKED_BY_CLIENT/i.test(f)) return;
    s.failed.push({ url: r.url(), method: r.method(), failure: f, resourceType: r.resourceType() });
  });
  page.on("response", (r) => {
    const req = r.request();
    const rt = req.resourceType();
    const status = r.status();
    let isMainDoc = false;
    try {
      isMainDoc = rt === "document" && req.frame() === page.mainFrame();
    } catch {
      /* service-worker requests have no frame */
    }
    if (status >= 400 && !isMainDoc) s.failed.push({ url: r.url(), method: req.method(), status, resourceType: rt });
    if ((rt === "fetch" || rt === "xhr") && r.url().startsWith(origin) && !/[?&]_rsc=/.test(r.url())) {
      const json = /json/.test(r.headers()["content-type"] ?? "");
      if (json || /\/api\//.test(r.url())) s.api.push({ method: req.method(), url: r.url(), status });
    }
  });
  page.on("download", () => s.downloads++);
  page.on("popup", (p) => {
    s.popups++;
    p.close().catch(() => {});
  });
  return s;
}

function drain(s: Signals) {
  const out = {
    console: s.console.slice(s.cursor.console),
    pageErrors: s.pageErrors.slice(s.cursor.pageErrors),
    failed: s.failed.slice(s.cursor.failed),
  };
  s.cursor = { console: s.console.length, pageErrors: s.pageErrors.length, failed: s.failed.length };
  return out;
}

async function settle(page: Page) {
  await page.waitForLoadState("load", { timeout: 30_000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready.then(() => true)).catch(() => {});
}

async function autoScroll(page: Page) {
  await page
    .evaluate(async () => {
      const step = window.innerHeight;
      const max = Math.min(document.documentElement.scrollHeight, step * 15);
      for (let y = 0; y < max; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 80));
      }
      window.scrollTo(0, 0);
    })
    .catch(() => {});
}

export async function runBrowserSuite(o: SuiteOptions): Promise<SuiteResult> {
  const origin = new URL(o.baseUrl).origin;
  const https = origin.startsWith("https:");
  const res: SuiteResult = {
    visits: [],
    crawled: [],
    linkSources: new Map(),
    externalLinks: new Map(),
    statusByUrl: new Map(),
    networkEndpoints: [],
    pageInfos: new Map(),
    aiShots: new Map(),
  };
  const screensDir = path.join(o.outDir, "screens");
  ensureDir(screensDir);
  ensureDir(path.join(o.outDir, "ai"));

  const queue: { url: string; source: RouteInfo["source"] }[] = [];
  const queued = new Set<string>();
  const perPathQueries = new Map<string, number>();
  const enqueue = (raw: string, source: RouteInfo["source"]) => {
    let u: URL;
    try {
      u = new URL(raw, o.baseUrl);
    } catch {
      return;
    }
    u.hash = "";
    if (u.origin !== origin || ASSET_EXT.test(u.pathname) || UNSAFE_LINK.test(u.pathname + u.search)) return;
    if (o.cfg.routes.exclude.length && matchesAny(u.pathname, o.cfg.routes.exclude)) return;
    const key = normalizeUrl(u);
    if (queued.has(key) || queued.size >= o.cfg.maxPages) return;
    if (u.search) {
      const n = perPathQueries.get(u.pathname) ?? 0;
      if (n >= 3) return;
      perPathQueries.set(u.pathname, n + 1);
    }
    queued.add(key);
    queue.push({ url: u.toString(), source });
  };

  enqueue(o.baseUrl, "start");
  for (const s of o.seeds) enqueue(s.path, s.source);
  try {
    const sm = await fetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(15_000) });
    if (sm.ok && /xml/.test(sm.headers.get("content-type") ?? "")) {
      const xml = await sm.text();
      for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
        try {
          const u = new URL(m[1]);
          enqueue(u.pathname + u.search, "sitemap");
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* no sitemap */
  }

  const fileFor = (u: string): string[] | undefined => {
    try {
      const p = new URL(u).pathname.replace(/\/+$/, "") || "/";
      const f = o.routeFiles.get(p);
      return f ? [f] : undefined;
    } catch {
      return undefined;
    }
  };
  const add = (f: NewFinding | undefined) => {
    if (f) o.sink.add(f);
  };
  let securityChecked = false;
  let pageIndex = 0;

  // ---------------------------------------------------------------- desktop pass (crawls)
  const desktop = await newContext(o.browser, "desktop", { baseUrl: o.baseUrl, cfg: o.cfg, storageState: o.storageState });
  const visitDesktop = async (item: { url: string; source: RouteInfo["source"] }) => {
    const index = pageIndex++;
    const page = await desktop.newPage();
    const sig = attachSignals(page, origin, https);
    const started = Date.now();
    let response: Response | null = null;
    let navError: string | undefined;
    try {
      response = await page.goto(item.url, { waitUntil: "domcontentloaded" });
      await settle(page);
    } catch (e) {
      navError = (e as Error).message.split("\n")[0];
    }
    const status = response?.status();
    const finalUrl = page.url() === "about:blank" ? item.url : page.url();
    const urlPath = new URL(item.url).pathname;
    res.statusByUrl.set(normalizeUrl(new URL(item.url)), navError ? undefined : status);
    res.crawled.push({ path: urlPath + new URL(item.url).search, source: item.source, file: fileFor(item.url)?.[0] });
    const c: PageCtx = { url: item.url, viewport: "desktop", files: fileFor(item.url), isLocal: o.isLocal, isDevServer: o.isDevServer };
    const visit: PageVisit = {
      url: item.url,
      path: urlPath,
      viewport: "desktop",
      status,
      durationMs: 0,
      consoleErrors: 0,
      failedRequests: 0,
      sourceFile: c.files?.[0],
      error: navError,
    };

    const flush = () => {
      const d = drain(sig);
      for (const m of d.console) {
        const f = consoleFinding(c, m.type, m.text);
        add(f);
        if (f && m.type === "error") visit.consoleErrors++;
      }
      for (const e of d.pageErrors) add(pageErrorFinding(c, e));
      for (const f of d.failed) add(networkFinding(c, f, origin));
      visit.consoleErrors += d.pageErrors.length;
      visit.failedRequests += d.failed.length;
    };

    try {
      if (navError) {
        add({
          ruleId: "page-load-failed",
          key: urlPath,
          title: `Page failed to load: ${urlPath}`,
          severity: "high",
          category: "functional",
          description: `Navigating to ${item.url} failed: ${navError}`,
          source: "browser",
          occurrence: { url: item.url, viewport: "desktop" },
          files: c.files,
        });
        return;
      }
      if (status && status >= 400) {
        const body = truncate(((await page.evaluate(() => document.body?.innerText ?? "").catch(() => "")) as string).trim(), 400);
        if (status >= 500) {
          add({
            ruleId: "page-5xx",
            key: urlPath,
            title: `Page returns a server error (HTTP ${status}): ${urlPath}`,
            severity: "critical",
            category: "backend",
            description: `GET ${item.url} → ${status}. Users see an error instead of the page.${body ? `\n\nPage text: ${body}` : ""}`,
            recommendation: "Check the server logs (qabot captures them in the Server log section when it launches the app).",
            source: "browser",
            occurrence: { url: item.url, viewport: "desktop", detail: `HTTP ${status}` },
            files: c.files,
          });
        } else if (status === 401 || status === 403) {
          add({
            ruleId: "page-auth-required",
            key: urlPath,
            title: `Page requires authentication (HTTP ${status})`,
            severity: "info",
            category: "functional",
            description: `${item.url} returned ${status}. Add "auth" steps to qabot.config.json so protected pages get tested too.`,
            source: "browser",
            occurrence: { url: item.url, viewport: "desktop" },
          });
        } else if (item.source === "code" || item.source === "start" || item.source === "config" || item.source === "sitemap") {
          add({
            ruleId: "page-4xx",
            key: urlPath,
            title: `${item.source === "sitemap" ? "Sitemap URL" : "Route"} returns HTTP ${status}: ${urlPath}`,
            severity: item.source === "start" ? "critical" : "high",
            category: "functional",
            description: `GET ${item.url} → ${status}.${item.source === "code" ? " The route exists in the codebase but does not render." : ""}`,
            source: "browser",
            occurrence: { url: item.url, viewport: "desktop", detail: `HTTP ${status}` },
            files: c.files,
          });
        }
        flush();
        return;
      }

      // Passive checks
      const info = await page.evaluate(collectPageInfo);
      res.pageInfos.set(item.url, info);
      visit.title = info.title;
      if (o.cfg.checks.seo) for (const f of contentFindings(c, info)) add(f);
      for (const l of info.links) {
        let u: URL;
        try {
          u = new URL(l.href);
        } catch {
          continue;
        }
        if (!/^https?:$/.test(u.protocol)) continue;
        u.hash = "";
        const map = u.origin === origin ? res.linkSources : res.externalLinks;
        const key = u.origin === origin ? normalizeUrl(u) : u.toString();
        if (!map.has(key)) map.set(key, new Set());
        map.get(key)!.add(item.url);
        if (u.origin === origin) enqueue(u.toString(), "crawl");
      }

      if (o.cfg.checks.layout) for (const f of layoutFindings(c, await page.evaluate(auditLayout, { mobile: false }))) add(f);
      if (o.cfg.checks.a11y) {
        try {
          for (const f of await runAxe(page, c)) add(f);
        } catch (e) {
          log.debug(`axe failed on ${item.url}: ${(e as Error).message}`);
        }
      }
      if (o.cfg.checks.perf) {
        const p = await page.evaluate(perfSnapshot);
        visit.metrics = {
          ttfbMs: p.ttfbMs,
          domContentLoadedMs: p.domContentLoadedMs,
          loadMs: p.loadMs,
          lcpMs: p.lcpMs,
          cls: p.cls,
          totalBlockingMs: p.totalBlockingMs,
          requestCount: p.requestCount,
          transferKb: p.transferKb,
          jsKb: p.jsKb,
        };
        for (const f of perfFindings(c, p)) add(f);
      }
      if (o.cfg.checks.security) {
        if (!securityChecked && response) {
          securityChecked = true;
          for (const f of securityHeaderFindings(c, await response.allHeaders(), https)) add(f);
          const cookies = (await desktop.cookies(origin)).map((ck) => ({ name: ck.name, secure: ck.secure, httpOnly: ck.httpOnly, sameSite: ck.sameSite }));
          for (const f of cookieFindings(c, cookies, https)) add(f);
        }
        for (const m of sig.mixed.slice(0, 5)) {
          add({
            ruleId: "sec-mixed-content",
            key: m,
            title: "Mixed content: HTTPS page loads an HTTP resource",
            severity: "high",
            category: "security",
            description: `${item.url} requests ${m} over plain HTTP. Browsers block or warn on this, and it can be tampered with in transit.`,
            recommendation: "Load every resource over HTTPS.",
            source: "browser",
            occurrence: { url: item.url, viewport: "desktop", detail: m },
          });
        }
      }

      await autoScroll(page);
      const slug = slugify(item.url);
      const shot = path.join(screensDir, `${slug}-desktop.png`);
      await page.screenshot({ path: shot, animations: "disabled", caret: "hide" });
      visit.screenshot = path.relative(o.outDir, shot);
      visit.fullScreenshot = await fullPageShot(page, path.join(screensDir, `${slug}-desktop-full.jpg`), o.outDir);
      checkVisual(o, shot, `${slug}-desktop.png`, c);
      if (index < o.aiShotPages) {
        const slices = await captureSlices(page, path.join(o.outDir, "ai"), `${slug}-desktop`, 3, o.outDir);
        res.aiShots.set(item.url, { desktop: slices, mobile: [] });
      }
      flush();

      if (o.cfg.checks.keyboard) {
        await keyboardCheck(page, c, o.sink);
        flush();
      }
      if (o.cfg.checks.interactions) await interactionCheck(page, item.url, c, sig, o);
      if (o.cfg.checks.forms && o.allowMutations) await formCheck(page, item.url, c, sig, o);
      drain(sig);
    } catch (e) {
      log.debug(`checks failed on ${item.url}: ${(e as Error).stack}`);
      visit.error = visit.error ?? (e as Error).message.split("\n")[0];
    } finally {
      for (const a of sig.api) {
        const u = new URL(a.url);
        res.networkEndpoints.push({ method: a.method, path: u.pathname, source: "network" });
      }
      visit.durationMs = Date.now() - started;
      res.visits.push(visit);
      log.info(
        `${statusIcon(visit)} ${truncate(urlPath + new URL(item.url).search, 60).padEnd(60)} desktop  ${status ?? "ERR"}  ${(visit.durationMs / 1000).toFixed(1)}s`,
      );
      await page.close().catch(() => {});
    }
  };

  let next = 0;
  let active = 0;
  const worker = async () => {
    while (true) {
      if (next < queue.length) {
        const item = queue[next++];
        active++;
        try {
          await visitDesktop(item);
        } finally {
          active--;
        }
      } else if (active > 0) {
        await new Promise((r) => setTimeout(r, 100));
      } else break;
    }
  };
  await Promise.all(Array.from({ length: o.cfg.concurrency }, worker));
  await desktop.close();

  // ---------------------------------------------------------------- tablet / mobile pass
  const okPages = res.visits.filter((v) => !v.error && (v.status ?? 0) < 400).map((v) => v.url);
  for (const vp of o.cfg.viewports.filter((v): v is Exclude<ViewportName, "desktop"> => v !== "desktop")) {
    log.info(`Re-rendering ${okPages.length} pages at ${vp} size`);
    const ctx = await newContext(o.browser, vp, { baseUrl: o.baseUrl, cfg: o.cfg, storageState: o.storageState });
    let i = 0;
    await Promise.all(
      Array.from({ length: o.cfg.concurrency }, async () => {
        while (i < okPages.length) {
          const url = okPages[i++];
          await visitResponsive(ctx, url, vp, o, res, origin, https, fileFor(url));
        }
      }),
    );
    await ctx.close();
  }

  // ---------------------------------------------------------------- unknown-URL handling
  await notFoundCheck(o, origin);
  return res;
}

function statusIcon(v: PageVisit): string {
  if (v.error || (v.status ?? 0) >= 500) return "✗";
  if ((v.status ?? 0) >= 400) return "!";
  return "✓";
}

async function visitResponsive(
  ctx: BrowserContext,
  url: string,
  vp: ViewportName,
  o: SuiteOptions,
  res: SuiteResult,
  origin: string,
  https: boolean,
  files: string[] | undefined,
) {
  const page = await ctx.newPage();
  const sig = attachSignals(page, origin, https);
  const started = Date.now();
  const c: PageCtx = { url, viewport: vp, files, isLocal: o.isLocal, isDevServer: o.isDevServer };
  const visit: PageVisit = { url, path: new URL(url).pathname, viewport: vp, durationMs: 0, consoleErrors: 0, failedRequests: 0, sourceFile: files?.[0] };
  try {
    const r = await page.goto(url, { waitUntil: "domcontentloaded" });
    visit.status = r?.status();
    await settle(page);
    if (o.cfg.checks.layout) for (const f of layoutFindings(c, await page.evaluate(auditLayout, { mobile: true }))) o.sink.add(f);
    await autoScroll(page);
    const slug = slugify(url);
    const shot = path.join(o.outDir, "screens", `${slug}-${vp}.png`);
    await page.screenshot({ path: shot, animations: "disabled", caret: "hide" });
    visit.screenshot = path.relative(o.outDir, shot);
    visit.fullScreenshot = await fullPageShot(page, path.join(o.outDir, "screens", `${slug}-${vp}-full.jpg`), o.outDir);
    checkVisual(o, shot, `${slug}-${vp}.png`, c);
    const ai = res.aiShots.get(url);
    if (ai && vp === "mobile") ai.mobile = await captureSlices(page, path.join(o.outDir, "ai"), `${slug}-mobile`, 2, o.outDir);
  } catch (e) {
    visit.error = (e as Error).message.split("\n")[0];
  } finally {
    const d = drain(sig);
    for (const m of d.console) {
      const f = consoleFinding(c, m.type, m.text);
      if (f) o.sink.add(f);
      if (f && m.type === "error") visit.consoleErrors++;
    }
    for (const e of d.pageErrors) o.sink.add(pageErrorFinding(c, e));
    for (const f of d.failed) {
      const nf = networkFinding(c, f, origin);
      if (nf) o.sink.add(nf);
    }
    visit.consoleErrors += d.pageErrors.length;
    visit.failedRequests = d.failed.length;
    visit.durationMs = Date.now() - started;
    res.visits.push(visit);
    log.debug(`${vp} ${url} done`);
    await page.close().catch(() => {});
  }
}

async function fullPageShot(page: Page, file: string, outDir: string): Promise<string | undefined> {
  try {
    const { h, w } = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, w: window.innerWidth }));
    await page.screenshot({ path: file, type: "jpeg", quality: 60, fullPage: true, clip: { x: 0, y: 0, width: w, height: Math.min(h, 12_000) }, animations: "disabled" });
    return path.relative(outDir, file);
  } catch {
    return undefined;
  }
}

async function captureSlices(page: Page, dir: string, base: string, max: number, outDir: string): Promise<string[]> {
  const out: string[] = [];
  try {
    const { h, vh, vw } = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, vh: window.innerHeight, vw: window.innerWidth }));
    const n = Math.min(max, Math.max(1, Math.ceil(h / vh)));
    for (let i = 0; i < n; i++) {
      const file = path.join(dir, `${base}-${i}.jpg`);
      await page.screenshot({
        path: file,
        type: "jpeg",
        quality: 70,
        fullPage: true,
        clip: { x: 0, y: i * vh, width: vw, height: Math.min(vh, h - i * vh) },
        animations: "disabled",
      });
      out.push(path.relative(outDir, file));
    }
  } catch (e) {
    log.debug(`slice capture failed: ${(e as Error).message}`);
  }
  return out;
}

function checkVisual(o: SuiteOptions, shot: string, name: string, c: PageCtx) {
  if (!o.cfg.checks.visual || !o.baselineDir) return;
  const baseline = path.join(o.baselineDir, name);
  if (o.cfg.visual.update) {
    updateBaseline(shot, baseline);
    return;
  }
  const diff = compareWithBaseline(shot, baseline, path.join(o.outDir, "diffs", name));
  if (!diff || diff.changedRatio <= o.cfg.visual.threshold) return;
  o.sink.add({
    ruleId: "visual-regression",
    key: name,
    title: `Visual change vs baseline on ${new URL(c.url).pathname} (${c.viewport})`,
    severity: "medium",
    category: "visual",
    description: diff.sizeChanged
      ? "The screenshot size changed compared with the stored baseline (page height or layout changed)."
      : `${(diff.changedRatio * 100).toFixed(1)}% of pixels changed compared with the baseline screenshot.`,
    recommendation: "Review the diff. If the change is intended, re-run with --update-baseline.",
    source: "browser",
    occurrence: { url: c.url, viewport: c.viewport, screenshot: diff.diffFile ? path.relative(o.outDir, diff.diffFile) : undefined },
  });
}

// ---------------------------------------------------------------- keyboard

async function keyboardCheck(page: Page, c: PageCtx, sink: FindingSink) {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  const seen = new Set<string>();
  const noIndicator: FocusProbe[] = [];
  const hidden: FocusProbe[] = [];
  let first: string | undefined;
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    const p = await page.evaluate(probeFocus).catch(() => undefined);
    if (!p) break;
    if (p.isBody) {
      if (i === 0) continue;
      break;
    }
    const key = `${p.selector}|${p.text}`;
    if (key === first) break;
    first ??= key;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!p.visible) hidden.push(p);
    else if (!p.indicator) noIndicator.push(p);
  }
  if (noIndicator.length) {
    sink.add({
      ruleId: "a11y-focus-indicator",
      title: "Keyboard focus is invisible on some controls",
      severity: "medium",
      category: "accessibility",
      description:
        "When tabbing through the page, these elements received focus without any visible change (no outline, shadow, border or colour change), " +
        "so keyboard users lose track of where they are (WCAG 2.4.7).",
      recommendation: "Add a clear :focus-visible style (e.g. outline: 2px solid; outline-offset: 2px) and never remove outlines without a replacement.",
      source: "browser",
      occurrence: {
        url: c.url,
        viewport: c.viewport,
        selector: noIndicator[0].selector,
        detail: noIndicator
          .slice(0, 6)
          .map((p) => `"${p.text || p.tag}"`)
          .join(", "),
      },
      files: c.files,
    });
  }
  if (hidden.length) {
    sink.add({
      ruleId: "a11y-focus-hidden",
      title: "Keyboard focus lands on invisible elements",
      severity: "medium",
      category: "accessibility",
      description:
        "Tabbing moves focus to elements that are off-screen, zero-sized or transparent (often closed menus or modals that are still focusable). " +
        "Keyboard and screen-reader users get lost.",
      recommendation: "Use the inert attribute, display:none, or tabindex=-1 on hidden panels until they open.",
      source: "browser",
      occurrence: {
        url: c.url,
        viewport: c.viewport,
        selector: hidden[0].selector,
        detail: hidden
          .slice(0, 6)
          .map((p) => `${p.selector}${p.text ? ` "${p.text}"` : ""}`)
          .join(", "),
      },
      files: c.files,
    });
  }
}

// ---------------------------------------------------------------- click every safe control

async function interactionCheck(page: Page, url: string, c: PageCtx, sig: Signals, o: SuiteOptions) {
  // Destructive-looking controls (delete, pay, sign out…) are never auto-clicked; the AI explorer handles deep flows.
  const tag = () => page.evaluate(tagClickCandidates, { max: 14, allowRisky: false }).catch(() => []);
  const candidates = await tag();
  const dead: string[] = [];
  const fresh = async () => {
    await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => {});
    await settle(page);
    await tag(); // same DOM, same order: candidate ids line up again
  };
  const arm = () =>
    page
      .evaluate(() => {
        const w = window as unknown as { __qabotMut: number; __qabotMo?: MutationObserver };
        w.__qabotMut = 0;
        w.__qabotMo?.disconnect();
        w.__qabotMo = new MutationObserver((ms) => (w.__qabotMut += ms.length));
        w.__qabotMo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
      })
      .catch(() => {});
  const click = async (id: string): Promise<{ ok: boolean; interceptedBy?: string }> => {
    try {
      await page.locator(`[data-qabot-click="${id}"]`).first().click({ timeout: 3000 });
      return { ok: true };
    } catch (e) {
      const m = (e as Error).message.match(/-\s+<([a-z][^>]*)>[^\n]*?intercepts pointer events/i);
      return { ok: false, interceptedBy: m?.[1] };
    }
  };
  const overlayOpen = () =>
    page
      .evaluate(() => {
        for (let e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); e; e = e.parentElement) {
          const r = e.getBoundingClientRect();
          if (getComputedStyle(e).position === "fixed" && r.width >= innerWidth * 0.8 && r.height >= innerHeight * 0.8) return true;
        }
        return false;
      })
      .catch(() => false);
  for (const cand of candidates) {
    const loc = page.locator(`[data-qabot-click="${cand.id}"]`);
    if (!(await loc.count().catch(() => 0)) || !(await loc.first().isVisible().catch(() => false))) continue;
    drain(sig);
    await arm();
    let before = { requests: sig.requests, url: page.url(), downloads: sig.downloads, popups: sig.popups };
    let res = await click(cand.id);
    if (res.interceptedBy) {
      // Usually a modal or click-away backdrop left open by an earlier click: retry on a fresh page first.
      await fresh();
      drain(sig);
      await arm();
      before = { requests: sig.requests, url: page.url(), downloads: sig.downloads, popups: sig.popups };
      res = await click(cand.id);
    }
    if (!res.ok) {
      const blocker = res.interceptedBy && /^(nextjs-portal|vite-error-overlay)\b/i.test(res.interceptedBy) ? undefined : res.interceptedBy;
      const selfDisabled = blocker
        ? await loc
            .first()
            .evaluate((el) => getComputedStyle(el).pointerEvents === "none")
            .catch(() => false)
        : false;
      if (blocker && selfDisabled) {
        o.sink.add({
          ruleId: "ui-inert-control",
          key: cand.text,
          title: `"${cand.text}" looks clickable but ignores clicks (pointer-events: none)`,
          severity: "medium",
          category: "ux",
          description: `"${cand.text}" is visible and styled as an active control, but pointer-events: none makes it inert. Users will click it and nothing happens.`,
          recommendation: "Hide it, or render it as visibly disabled (disabled attribute / aria-disabled plus disabled styling) with a reason.",
          source: "browser",
          occurrence: { url, viewport: c.viewport, detail: cand.text },
          files: c.files,
        });
      } else if (blocker) {
        o.sink.add({
          ruleId: "ui-click-intercepted",
          key: `${cand.text}|${blocker}`,
          title: `"${cand.text}" can't be clicked: another element is on top of it`,
          severity: "medium",
          category: "ux",
          description: `Even on a freshly loaded page, clicking "${cand.text}" is blocked because <${truncate(blocker, 120)}> intercepts pointer events.`,
          recommendation: "Fix the overlapping element's z-index/pointer-events or its position at this viewport.",
          source: "browser",
          occurrence: { url, viewport: c.viewport, detail: cand.text },
          files: c.files,
        });
      }
      continue;
    }
    await page.waitForTimeout(700);
    const mutations = await page
      .evaluate(() => {
        const w = window as unknown as { __qabotMut?: number; __qabotMo?: MutationObserver };
        w.__qabotMo?.disconnect();
        return w.__qabotMut ?? 0;
      })
      .catch(() => -1);
    const d = drain(sig);
    for (const err of d.pageErrors) {
      o.sink.add({
        ruleId: "interaction-exception",
        key: `${cand.text}|${err.split("\n")[0]}`,
        title: `Clicking "${truncate(cand.text, 40)}" throws: ${truncate(err.split("\n")[0], 90)}`,
        severity: "high",
        category: "functional",
        description: `An uncaught exception fired right after clicking "${cand.text}" on ${url}.\n\n${truncate(err, 1200)}`,
        recommendation: "Reproduce by clicking the control and fix the handler; wrap risky logic in error handling.",
        source: "browser",
        occurrence: { url, viewport: c.viewport, detail: cand.text },
        steps: [`Open ${url}`, `Click "${cand.text}"`, "Observe the uncaught exception in the console"],
        files: c.files,
      });
    }
    for (const m of d.console.filter((x) => x.type === "error")) {
      const f = consoleFinding(c, "error", m.text);
      if (f) o.sink.add({ ...f, ruleId: "interaction-console-error", title: `After clicking "${truncate(cand.text, 40)}": ${f.title}`, key: `${cand.text}|${f.key}` });
    }
    for (const fr of d.failed) {
      const f = networkFinding(c, fr, new URL(url).origin);
      if (f) o.sink.add({ ...f, title: `After clicking "${truncate(cand.text, 40)}": ${f.title}`, key: `${cand.text}|${f.key}`, steps: [`Open ${url}`, `Click "${cand.text}"`] });
    }
    const navigated = page.url() !== before.url;
    const effect = navigated || mutations !== 0 || sig.requests !== before.requests || sig.downloads !== before.downloads || sig.popups !== before.popups;
    if (!effect && !d.pageErrors.length) dead.push(cand.text);
    await page.keyboard.press("Escape").catch(() => {});
    if (navigated || (await overlayOpen())) await fresh();
  }
  if (dead.length) {
    o.sink.add({
      ruleId: "ui-dead-click",
      title: "Buttons that do nothing when clicked",
      severity: "low",
      category: "ux",
      description: `Clicking these controls produced no DOM change, navigation, network request, download or popup within 700ms: ${dead
        .slice(0, 8)
        .map((t) => `"${t}"`)
        .join(", ")}. Either they are broken, or they need visible feedback.`,
      recommendation: "Wire up the handler, disable the control when it can't act, or show feedback (toast, state change).",
      source: "browser",
      occurrence: { url, viewport: c.viewport, detail: dead.slice(0, 8).join(", ") },
      files: c.files,
    });
  }
}

// ---------------------------------------------------------------- forms: empty-submit probe

async function formCheck(page: Page, url: string, c: PageCtx, sig: Signals, o: SuiteOptions) {
  const forms = await page.evaluate(listForms).catch(() => []);
  for (const form of forms.slice(0, 2)) {
    if (!form.fields) continue;
    await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => {});
    await settle(page);
    drain(sig);
    const before = await page.evaluate(validationSignals).catch(() => ({ invalid: 0, ariaInvalid: 0, alerts: [] as string[] }));
    const mutating: { status: number; url: string }[] = [];
    const onResponse = (r: Response) => {
      const m = r.request().method();
      if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") mutating.push({ status: r.status(), url: r.url() });
    };
    page.on("response", onResponse);
    const formLoc = page.locator("form").nth(form.index);
    const submit = formLoc.locator('button[type=submit], input[type=submit], button:not([type])').first();
    try {
      if (await submit.count()) await submit.click({ timeout: 3000 });
      else await formLoc.locator("input, textarea").first().press("Enter", { timeout: 3000 });
    } catch {
      page.off("response", onResponse);
      continue;
    }
    await page.waitForTimeout(1500);
    page.off("response", onResponse);
    const after = await page.evaluate(validationSignals).catch(() => before);
    const d = drain(sig);
    const label = form.submitText || `form #${form.index + 1}`;
    const steps = [`Open ${url}`, `Leave every field in "${label}" empty`, "Submit the form"];
    const validated =
      after.ariaInvalid > before.ariaInvalid ||
      (form.required > 0 && after.invalid > 0) ||
      after.alerts.some((a) => !before.alerts.includes(a));
    for (const err of d.pageErrors) {
      o.sink.add({
        ruleId: "form-exception",
        key: `${label}|${err.split("\n")[0]}`,
        title: `Submitting "${label}" empty throws a JavaScript error`,
        severity: "high",
        category: "functional",
        description: truncate(err, 1200),
        source: "browser",
        occurrence: { url, viewport: "desktop", detail: label },
        steps,
        files: c.files,
      });
    }
    const serverErr = mutating.find((m) => m.status >= 500);
    if (serverErr) {
      o.sink.add({
        ruleId: "form-server-error",
        key: `${label}|${new URL(serverErr.url).pathname}`,
        title: `Submitting "${label}" empty crashes the server (HTTP ${serverErr.status})`,
        severity: "high",
        category: "backend",
        description: `The empty submission reached ${serverErr.url}, which answered ${serverErr.status}. The endpoint is missing input validation.`,
        recommendation: "Validate the payload server-side and return a 400 with field errors.",
        source: "browser",
        occurrence: { url, viewport: "desktop", detail: `${new URL(serverErr.url).pathname} → ${serverErr.status}` },
        steps,
        files: c.files,
      });
    } else if (mutating.some((m) => m.status >= 200 && m.status < 300) && !validated) {
      o.sink.add({
        ruleId: "form-accepts-empty",
        key: label,
        title: `"${label}" accepts an empty submission`,
        severity: "medium",
        category: "functional",
        description: "Submitting with every field empty was accepted by the server (2xx) with no validation feedback. This can create junk records.",
        recommendation: "Add required-field validation on the client and the server.",
        source: "browser",
        occurrence: { url, viewport: "desktop", detail: label },
        steps,
        files: c.files,
      });
    } else if (mutating.some((m) => m.status >= 400 && m.status < 500) && !validated) {
      o.sink.add({
        ruleId: "form-silent-failure",
        key: label,
        title: `"${label}" fails silently: the server rejects it but no error is shown`,
        severity: "medium",
        category: "ux",
        description: "The server answered 4xx to the empty submission, but the page shows no error message, so users don't know what to fix.",
        recommendation: "Surface server-side validation errors next to the relevant fields.",
        source: "browser",
        occurrence: { url, viewport: "desktop", detail: label },
        steps,
        files: c.files,
      });
    } else if (!mutating.length && !validated && page.url() === url && form.required === 0) {
      o.sink.add({
        ruleId: "form-no-feedback",
        key: label,
        title: `Submitting "${label}" empty gives no feedback`,
        severity: "low",
        category: "ux",
        description: "Nothing visibly happened after submitting the empty form: no validation message, no request, no navigation.",
        recommendation: "Mark required fields and show inline validation messages.",
        source: "browser",
        occurrence: { url, viewport: "desktop", detail: label },
        steps,
        files: c.files,
      });
    }
  }
}

// ---------------------------------------------------------------- 404 handling

async function notFoundCheck(o: SuiteOptions, origin: string) {
  const ctx = await newContext(o.browser, "desktop", { baseUrl: o.baseUrl, cfg: o.cfg, storageState: o.storageState });
  const page = await ctx.newPage();
  const url = `${origin}/qabot-check-${Date.now().toString(36)}`;
  try {
    const r = await page.goto(url, { waitUntil: "domcontentloaded" });
    await settle(page);
    const status = r?.status() ?? 0;
    const text = ((await page.evaluate(() => document.body?.innerText ?? "").catch(() => "")) as string).trim();
    const hasHomeLink = await page.evaluate(() => !!document.querySelector('a[href="/"], a[href="./"], a[href="' + location.origin + '/"]')).catch(() => false);
    const occurrence = { url, viewport: "desktop", detail: `HTTP ${status}` };
    if (status >= 500) {
      o.sink.add({
        ruleId: "404-server-error",
        title: `Unknown URLs crash with HTTP ${status} instead of a 404 page`,
        severity: "high",
        category: "functional",
        description: `Requesting a URL that doesn't exist (${url}) returned ${status}.`,
        source: "browser",
        occurrence,
      });
    } else if (status === 200) {
      o.sink.add({
        ruleId: "404-soft",
        title: "Unknown URLs return HTTP 200 (soft 404)",
        severity: "low",
        category: "seo",
        description: `${url} doesn't exist but answered 200. Search engines index junk URLs and monitoring can't detect broken links.`,
        recommendation: "Return a real 404 status for unknown routes (for SPAs, configure the host's fallback accordingly).",
        source: "browser",
        occurrence,
      });
    } else if (text.length < 20 || !hasHomeLink) {
      o.sink.add({
        ruleId: "404-unhelpful",
        title: "The 404 page doesn't help users recover",
        severity: "low",
        category: "ux",
        description: text.length < 20 ? "The not-found page is essentially blank." : "The not-found page has no link back to the home page.",
        recommendation: "Show a friendly message, a link home, and search or key navigation links.",
        source: "browser",
        occurrence,
      });
    }
  } catch {
    /* ignore */
  } finally {
    await ctx.close();
  }
}

export function writeJson(file: string, data: unknown) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
