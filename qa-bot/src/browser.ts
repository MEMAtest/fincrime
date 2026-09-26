import fs from "node:fs";
import path from "node:path";
import { chromium, devices, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "playwright";
import type { AuthStep, QaConfig } from "./config.js";
import type { ViewportName } from "./types.js";
import { interpolateEnv, log } from "./util.js";

export const VIEWPORTS: Record<ViewportName, BrowserContextOptions> = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  tablet: {
    viewport: { width: 834, height: 1112 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: devices["iPad Pro 11"].userAgent,
  },
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: devices["iPhone 13"].userAgent,
  },
};

export async function launchBrowser(headed: boolean): Promise<Browser> {
  const attempts: { label: string; opts: Parameters<typeof chromium.launch>[0] }[] = [
    { label: "bundled Chromium", opts: { headless: !headed } },
  ];
  if (process.env.QABOT_CHROMIUM_PATH) {
    attempts.unshift({ label: process.env.QABOT_CHROMIUM_PATH, opts: { headless: !headed, executablePath: process.env.QABOT_CHROMIUM_PATH } });
  }
  attempts.push({ label: "installed Google Chrome", opts: { headless: !headed, channel: "chrome" } });
  const errors: string[] = [];
  for (const a of attempts) {
    try {
      return await chromium.launch(a.opts);
    } catch (e) {
      errors.push(`${a.label}: ${(e as Error).message.split("\n")[0]}`);
    }
  }
  throw new Error(
    `Could not launch a browser.\n  ${errors.join("\n  ")}\nRun "npx playwright install chromium" once, or set QABOT_CHROMIUM_PATH to a Chrome/Chromium binary.`,
  );
}

/** Runs in every page before app scripts: perf observers + a shim for bundler-injected helpers. */
const INIT_SCRIPT = `
(() => {
  window.__name = window.__name || ((f) => f);
  const q = (window.__qabot = { lcp: 0, cls: 0, tbt: 0, longTasks: 0 });
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) q.lcp = e.renderTime || e.loadTime || e.startTime; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) q.cls += e.value; })
      .observe({ type: 'layout-shift', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { q.longTasks++; q.tbt += Math.max(0, e.duration - 50); } })
      .observe({ type: 'longtask', buffered: true });
  } catch {}
})();
`;

export interface ContextFactoryOptions {
  baseUrl: string;
  cfg: QaConfig;
  storageState?: string;
}

export async function newContext(browser: Browser, viewport: ViewportName, o: ContextFactoryOptions): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    ...VIEWPORTS[viewport],
    ignoreHTTPSErrors: true,
    storageState: o.storageState,
    reducedMotion: "reduce",
  });
  await ctx.addInitScript(INIT_SCRIPT);
  const headers = Object.fromEntries(Object.entries(o.cfg.headers).map(([k, v]) => [k.toLowerCase(), interpolateEnv(v)]));
  if (Object.keys(headers).length) {
    const origin = new URL(o.baseUrl).origin;
    // Only same-origin requests get the extra headers, so auth tokens never leak to third parties.
    await ctx.route(
      (url) => url.origin === origin,
      (route) => route.continue({ headers: { ...route.request().headers(), ...headers } }),
    );
  }
  ctx.on("page", (p) => p.on("dialog", (d) => d.dismiss().catch(() => {})));
  ctx.setDefaultNavigationTimeout(90_000);
  ctx.setDefaultTimeout(15_000);
  return ctx;
}

/** Log in once with scripted steps and save the session so every context reuses it. */
export async function prepareAuth(browser: Browser, baseUrl: string, cfg: QaConfig, outDir: string): Promise<string | undefined> {
  if (cfg.auth?.storageState) return path.resolve(cfg.auth.storageState);
  if (!cfg.auth?.steps?.length) return undefined;
  log.info(`Logging in with ${cfg.auth.steps.length} scripted auth steps`);
  const ctx = await newContext(browser, "desktop", { baseUrl, cfg });
  const page = await ctx.newPage();
  for (const step of cfg.auth.steps) await runAuthStep(page, baseUrl, step);
  const file = path.join(outDir, "auth-state.json");
  await ctx.storageState({ path: file });
  await ctx.close();
  fs.chmodSync(file, 0o600);
  return file;
}

async function runAuthStep(page: Page, baseUrl: string, step: AuthStep) {
  if ("goto" in step) await page.goto(new URL(interpolateEnv(step.goto), baseUrl).toString());
  else if ("fill" in step) await page.fill(step.fill[0], interpolateEnv(step.fill[1]));
  else if ("click" in step) await page.click(step.click);
  else if ("press" in step) await page.press(step.press[0], step.press[1]);
  else if ("waitForUrl" in step) await page.waitForURL(step.waitForUrl, { timeout: 30_000 });
  else if ("waitForSelector" in step) await page.waitForSelector(step.waitForSelector, { timeout: 30_000 });
}
