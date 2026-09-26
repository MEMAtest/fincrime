import path from "node:path";
import type { Browser, BrowserContext, Page } from "playwright";
import { newContext } from "../browser.js";
import type { QaConfig } from "../config.js";
import type { FindingSink } from "../findings.js";
import type { Category, ExplorerStep, Severity } from "../types.js";
import { ensureDir, log, sleep, truncate } from "../util.js";

export const WIDTH = 1280;
export const HEIGHT = 800;

export const REPORT_CATEGORIES = ["functional", "ux", "visual", "content", "accessibility", "responsive", "performance", "security", "backend"] as const;

/** Tool output in a backend-neutral shape: text and/or PNG screenshots. */
export type ToolContent = ({ type: "text"; text: string } | { type: "image"; png: Buffer })[];

const KEY_MAP: Record<string, string> = {
  return: "Enter",
  enter: "Enter",
  kp_enter: "Enter",
  backspace: "Backspace",
  tab: "Tab",
  escape: "Escape",
  esc: "Escape",
  space: "Space",
  delete: "Delete",
  del: "Delete",
  insert: "Insert",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  page_up: "PageUp",
  pageup: "PageUp",
  prior: "PageUp",
  page_down: "PageDown",
  pagedown: "PageDown",
  next: "PageDown",
  home: "Home",
  end: "End",
  ctrl: "Control",
  control: "Control",
  alt: "Alt",
  option: "Alt",
  shift: "Shift",
  super: "Meta",
  cmd: "Meta",
  command: "Meta",
  meta: "Meta",
  win: "Meta",
  minus: "-",
  plus: "+",
};

/** Convert xdotool-style key names ("ctrl+shift+Return") to Playwright ("Control+Shift+Enter"). */
export function mapKey(combo: string): string {
  return combo
    .split("+")
    .map((k) => {
      const t = k.trim();
      const lower = t.toLowerCase();
      if (KEY_MAP[lower]) return KEY_MAP[lower];
      if (/^f\d{1,2}$/i.test(t)) return t.toUpperCase();
      if (/^arrow/i.test(t)) return `Arrow${t.slice(5, 6).toUpperCase()}${t.slice(6).toLowerCase()}`;
      return t;
    })
    .join("+");
}

function modifiers(text: unknown): string[] {
  if (typeof text !== "string" || !text.trim()) return [];
  return text.split("+").map((m) => mapKey(m));
}

export interface HarnessOptions {
  browser: Browser;
  baseUrl: string;
  cfg: QaConfig;
  storageState?: string;
  outDir: string;
  sink: FindingSink;
  allowMutations: boolean;
}

export type Input = Record<string, unknown>;

/**
 * The browser an AI tester drives. It owns the safety rails (same-origin only, mutating requests
 * blocked in safe mode), records what happens under the hood (exceptions, console errors, failed
 * requests) and turns reported issues into findings with screenshots. Both AI backends use it.
 */
export class BrowserHarness {
  page!: Page;
  readonly steps: ExplorerStep[] = [];
  readonly result: { summary?: string; journeysCovered?: string[]; coverageGaps?: string[] } = {};
  finished = false;
  turn = 0;
  shots = 0;
  private ctx!: BrowserContext;
  private readonly origin: string;
  private readonly dir: string;
  private readonly blocked: string[] = [];
  private readonly popups: string[] = [];
  private readonly signals = { exceptions: [] as string[], console: [] as string[], failed: [] as string[] };
  private mouse = { x: WIDTH / 2, y: HEIGHT / 2 };
  private issueCount = 0;

  private constructor(private readonly o: HarnessOptions) {
    this.origin = new URL(o.baseUrl).origin;
    this.dir = path.join(o.outDir, "explorer");
  }

  static async create(o: HarnessOptions): Promise<BrowserHarness> {
    const h = new BrowserHarness(o);
    ensureDir(h.dir);
    h.ctx = await newContext(o.browser, "desktop", { baseUrl: o.baseUrl, cfg: o.cfg, storageState: o.storageState });
    if (!o.allowMutations) {
      await h.ctx.route("**/*", (route) => {
        const req = route.request();
        if (!["GET", "HEAD", "OPTIONS"].includes(req.method()) && req.url().startsWith(h.origin)) {
          h.blocked.push(`${req.method()} ${new URL(req.url()).pathname}`);
          return route.abort("blockedbyclient");
        }
        return route.fallback();
      });
    }
    h.page = await h.ctx.newPage();
    await h.page.setViewportSize({ width: WIDTH, height: HEIGHT });
    h.ctx.on("page", (p) => {
      if (p === h.page) return;
      h.popups.push(p.url());
      p.close().catch(() => {});
    });
    h.wire(h.page);
    await h.page.goto(o.baseUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
    await h.page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    return h;
  }

  private wire(p: Page) {
    p.on("pageerror", (e) => this.signals.exceptions.push(truncate(e.message, 400)));
    p.on("console", (m) => {
      if (m.type() === "error" && !/Failed to load resource/.test(m.text())) this.signals.console.push(truncate(m.text(), 300));
    });
    p.on("response", (r) => {
      if (r.status() >= 400) this.signals.failed.push(`${r.request().method()} ${truncate(r.url(), 160)} → ${r.status()}`);
    });
    p.on("requestfailed", (r) => {
      const f = r.failure()?.errorText ?? "";
      if (!/ERR_ABORTED|BLOCKED_BY_CLIENT/.test(f)) this.signals.failed.push(`${r.method()} ${truncate(r.url(), 160)} → ${f}`);
    });
  }

  async ensurePage() {
    if (this.page.isClosed()) {
      this.page = await this.ctx.newPage();
      await this.page.setViewportSize({ width: WIDTH, height: HEIGHT });
      this.wire(this.page);
    }
  }

  async screenshot(): Promise<Buffer> {
    this.shots++;
    return this.page.screenshot({ type: "png", animations: "disabled" });
  }

  private async afterAction(): Promise<string> {
    await this.page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(350);
    const notes: string[] = [];
    const url = this.page.url();
    if (url !== "about:blank" && !url.startsWith(this.origin)) {
      notes.push(`left the site under test (${truncate(url, 100)}); navigated back`);
      await this.page.goBack().catch(() => this.page.goto(this.o.baseUrl));
    }
    if (this.popups.length) notes.push(`a new tab opened (${this.popups.splice(0).join(", ")}) and was closed; use navigate if you need it`);
    return notes.length ? `OK (${notes.join("; ")})` : "OK";
  }

  private async withModifiers(mods: string[], fn: () => Promise<void>) {
    for (const m of mods) await this.page.keyboard.down(m);
    try {
      await fn();
    } finally {
      for (const m of [...mods].reverse()) await this.page.keyboard.up(m);
    }
  }

  private point(input: Input): [number, number] {
    const c = input.coordinate as [number, number] | undefined;
    return c ? [Math.round(c[0]), Math.round(c[1])] : [this.mouse.x, this.mouse.y];
  }

  /** Pixel-level actions, named and shaped like the computer-use toolset members. */
  async act(name: string, input: Input): Promise<ToolContent> {
    const page = this.page;
    const text = (t: string): ToolContent => [{ type: "text", text: t }];
    switch (name) {
      case "screenshot":
        return [{ type: "image", png: await this.screenshot() }];
      case "zoom": {
        const [x0, y0, x1, y1] = (input.region as number[]).map((n) => Math.max(0, Math.round(n)));
        const png = await page.screenshot({ type: "png", clip: { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) } });
        return [{ type: "image", png }];
      }
      case "left_click":
      case "right_click":
      case "middle_click":
      case "double_click":
      case "triple_click": {
        const [x, y] = this.point(input);
        const button = name === "right_click" ? "right" : name === "middle_click" ? "middle" : "left";
        const clickCount = name === "double_click" ? 2 : name === "triple_click" ? 3 : 1;
        await this.withModifiers(modifiers(input.text), async () => {
          await page.mouse.move(x, y);
          await page.mouse.click(x, y, { button, clickCount });
        });
        this.mouse = { x, y };
        return text(await this.afterAction());
      }
      case "left_click_drag": {
        const [sx, sy] = (input.start_coordinate as number[]) ?? [this.mouse.x, this.mouse.y];
        const [x, y] = this.point(input);
        await this.withModifiers(modifiers(input.text), async () => {
          await page.mouse.move(sx, sy);
          await page.mouse.down();
          await page.mouse.move(x, y, { steps: 12 });
          await page.mouse.up();
        });
        this.mouse = { x, y };
        return text(await this.afterAction());
      }
      case "mouse_move": {
        const [x, y] = this.point(input);
        await page.mouse.move(x, y);
        this.mouse = { x, y };
        return text("OK");
      }
      case "left_mouse_down":
        await page.mouse.down();
        return text("OK");
      case "left_mouse_up":
        await page.mouse.up();
        return text(await this.afterAction());
      case "cursor_position":
        return text(`X=${this.mouse.x}, Y=${this.mouse.y}`);
      case "scroll": {
        const [x, y] = this.point(input);
        const amount = Number(input.scroll_amount ?? 3) * 100;
        const dir = String(input.scroll_direction ?? "down");
        const dx = dir === "left" ? -amount : dir === "right" ? amount : 0;
        const dy = dir === "up" ? -amount : dir === "down" ? amount : 0;
        await page.mouse.move(x, y);
        await this.withModifiers(modifiers(input.text), () => page.mouse.wheel(dx, dy));
        await page.waitForTimeout(300);
        return text("OK");
      }
      case "type":
        await page.keyboard.type(String(input.text ?? ""), { delay: 12 });
        return text("OK");
      case "key": {
        const combo = mapKey(String(input.text ?? ""));
        const repeat = Math.min(100, Math.max(1, Number(input.repeat ?? 1)));
        for (let i = 0; i < repeat; i++) await page.keyboard.press(combo);
        return text(await this.afterAction());
      }
      case "hold_key": {
        const keys = modifiers(input.text);
        for (const k of keys) await page.keyboard.down(k);
        await sleep(Math.min(Number(input.duration ?? 1), 10) * 1000);
        for (const k of keys.reverse()) await page.keyboard.up(k);
        return text("OK");
      }
      case "wait":
        await sleep(Math.min(Number(input.duration ?? 1), 15) * 1000);
        return text("OK");
      default:
        throw new Error(`Unsupported computer action: ${name}`);
    }
  }

  /** Semantic helpers: more robust than pixel clicks for agents without a native computer tool. */
  async clickText(label: string, role?: string): Promise<ToolContent> {
    const page = this.page;
    const loc = role
      ? page.getByRole(role as Parameters<Page["getByRole"]>[0], { name: label }).first()
      : page.getByRole("button", { name: label }).or(page.getByRole("link", { name: label })).or(page.getByText(label, { exact: false })).first();
    await loc.click({ timeout: 5000 });
    return [{ type: "text", text: await this.afterAction() }];
  }

  async fill(label: string, value: string): Promise<ToolContent> {
    const page = this.page;
    const loc = page.getByLabel(label).or(page.getByPlaceholder(label)).first();
    await loc.fill(value, { timeout: 5000 });
    return [{ type: "text", text: "OK" }];
  }

  async select(label: string, option: string): Promise<ToolContent> {
    await this.page.getByLabel(label).first().selectOption({ label: option }, { timeout: 5000 });
    return [{ type: "text", text: await this.afterAction() }];
  }

  async navigate(url: string): Promise<ToolContent> {
    const target = new URL(url, this.o.baseUrl);
    if (target.origin !== this.origin) return [{ type: "text", text: `Refused: ${target.origin} is outside the site under test (${this.origin}).` }];
    const r = await this.page.goto(target.toString(), { waitUntil: "domcontentloaded" }).catch((e: Error) => e);
    await this.page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    const status = r instanceof Error ? `failed: ${r.message.split("\n")[0]}` : `HTTP ${r?.status()}`;
    this.log("action", `navigate ${target.pathname}${target.search}`);
    return [
      { type: "text", text: `Loaded ${target.pathname}${target.search} (${status}).` },
      { type: "image", png: await this.screenshot() },
    ];
  }

  async pageSignals(): Promise<ToolContent> {
    const out = {
      url: this.page.url(),
      title: await this.page.title().catch(() => ""),
      uncaught_exceptions: this.signals.exceptions.splice(0),
      console_errors: this.signals.console.splice(0),
      failed_requests: this.signals.failed.splice(0),
      blocked_by_safe_mode: this.blocked.splice(0),
    };
    return [{ type: "text", text: JSON.stringify(out, null, 1) }];
  }

  async pageText(): Promise<ToolContent> {
    const data = await this.page.evaluate(() => {
      const fields = Array.from(document.querySelectorAll("input:not([type=hidden]), select, textarea"))
        .filter((e) => (e as HTMLElement).offsetParent !== null)
        .slice(0, 60)
        .map((e) => {
          const el = e as HTMLInputElement;
          const label = el.labels?.[0]?.innerText || el.getAttribute("aria-label") || el.placeholder || el.name || el.id;
          return {
            label: (label || "").trim().slice(0, 80),
            type: el.type || el.tagName.toLowerCase(),
            value: el.type === "password" ? (el.value ? "••••" : "") : String(el.value ?? "").slice(0, 80),
            required: el.required,
            valid: el.validity?.valid ?? true,
            message: el.validationMessage || undefined,
          };
        });
      const buttons = Array.from(document.querySelectorAll("button, [role=button], a[href]"))
        .filter((e) => (e as HTMLElement).offsetParent !== null)
        .slice(0, 80)
        .map((e) => ((e as HTMLElement).innerText || e.getAttribute("aria-label") || "").trim().slice(0, 60))
        .filter(Boolean);
      return { text: (document.body?.innerText ?? "").slice(0, 7000), fields, clickable: [...new Set(buttons)] };
    });
    return [{ type: "text", text: JSON.stringify(data, null, 1) }];
  }

  async reportIssue(input: Input): Promise<ToolContent> {
    this.issueCount++;
    const file = path.join(this.dir, `issue-${this.issueCount}.png`);
    await this.page.screenshot({ path: file }).catch(() => {});
    const cat = String(input.category);
    const category: Category = (REPORT_CATEGORIES as readonly string[]).includes(cat) ? (cat as Category) : "functional";
    const severity = (["critical", "high", "medium", "low"].includes(String(input.severity)) ? input.severity : "medium") as Severity;
    const steps = Array.isArray(input.steps_to_reproduce) ? (input.steps_to_reproduce as string[]).map(String) : [];
    this.o.sink.add({
      ruleId: `ai-explore:${category}`,
      key: String(input.title),
      title: String(input.title),
      severity,
      category,
      description: `${input.description}\n\nExpected: ${input.expected}\nActual: ${input.actual}`,
      source: "ai-explorer",
      steps,
      occurrence: { url: this.page.url(), viewport: "desktop", screenshot: path.relative(this.o.outDir, file) },
      tags: ["ai"],
    });
    this.log("issue", `[${severity}] ${input.title}`, path.relative(this.o.outDir, file));
    log.info(`  🐞 explorer found: [${severity}] ${input.title}`);
    return [{ type: "text", text: `Recorded issue #${this.issueCount}.` }];
  }

  finish(input: Input): ToolContent {
    this.result.summary = String(input.summary ?? "");
    this.result.journeysCovered = Array.isArray(input.journeys_covered) ? (input.journeys_covered as string[]) : [];
    this.result.coverageGaps = Array.isArray(input.coverage_gaps) ? (input.coverage_gaps as string[]) : [];
    this.finished = true;
    return [{ type: "text", text: "Session finished." }];
  }

  log(kind: ExplorerStep["kind"], text: string, screenshot?: string) {
    this.steps.push({ turn: this.turn, kind, text: truncate(text, 600), screenshot });
  }

  async close() {
    await this.ctx.close().catch(() => {});
  }
}

export function describeAction(name: string, input: Input): string {
  if (name === "type") return `type "${truncate(String(input.text ?? ""), 60)}"`;
  if (name === "key") return `key ${input.text}`;
  if (input.coordinate) return `${name} at (${(input.coordinate as number[]).join(", ")})`;
  if (name === "scroll") return `scroll ${input.scroll_direction} ×${input.scroll_amount ?? 3}`;
  return name;
}

/** The shared tester persona: both backends give the agent the same brief. */
export const EXPLORER_SYSTEM = `You are an elite exploratory tester driving a real Chromium browser. You test web applications the way a sharp, sceptical human QA engineer would, and you find the bugs automated scanners miss.

How you work:
- Start by understanding what the product does and who it is for, then pick the journeys that matter most (sign-up, core workflow, anything involving money, data entry, or irreversible actions).
- Test each journey end to end, then attack it: empty and invalid inputs, boundary values (0, negative, huge numbers, 500-character strings, emoji, <script> and quotes in text fields), double-clicking submit, browser back/refresh mid-flow, deep links straight into a later step, switching options after filling dependent fields.
- Check the result of every action. After clicking or submitting, take a screenshot and look for what changed. After significant actions call page_signals: it reveals JavaScript exceptions, console errors and failed API calls that are invisible on screen.
- Judge the UX as well as the function: confusing flows, missing feedback, unclear errors, lost input after an error, inconsistent labels, layout breaking with long content.

Reporting:
- Only report issues you actually observed. Reproduce anything surprising once before reporting.
- One report_issue call per distinct problem, with numbered reproduction steps a developer can follow, expected vs actual behaviour, and the most accurate severity:
  critical = data loss, security hole, or a core journey is impossible; high = a feature is broken or produces wrong results; medium = confusing or error-prone behaviour with a workaround; low = polish.
- Do not re-report issues listed as already known.
- Stay on the site under test. Never enter real personal or payment data; use obviously fake test data.
- When you have covered the important journeys (or are nearly out of turns), call finish with a summary, the journeys you covered, and what you could not test.`;

export function explorerKickoff(o: {
  baseUrl: string;
  name?: string;
  isLocal: boolean;
  siteMap: string[];
  journeys: string[];
  known: { severity: string; title: string }[];
  allowMutations: boolean;
  budget: string;
}): string {
  const journeys = o.journeys.length
    ? o.journeys.map((j, i) => `${i + 1}. ${j}`).join("\n")
    : "None were specified. Work out the 3-5 most important user journeys from the site map and the UI, then test them end to end.";
  const knownList = o.known
    .slice(0, 40)
    .map((f) => `- [${f.severity}] ${f.title}`)
    .join("\n");
  return `Site under test: ${o.baseUrl}${o.name ? ` (${o.name})` : ""}
${o.isLocal ? "This is a local development copy of the app." : "This is a deployed environment; treat it with care."}

Pages discovered from the codebase and crawl:
${o.siteMap.slice(0, 80).join("\n") || "(none: explore from the home page)"}

Journeys to test:
${journeys}

Already known from automated checks (do not re-report):
${knownList || "- none"}

${
  o.allowMutations
    ? 'You may submit forms and create test data. Use obviously fake data (e.g. name "QA Test", email qa+test@example.com).'
    : "SAFE MODE: state-changing requests (POST/PUT/PATCH/DELETE) to this site are blocked by the harness. You can still fill forms to test client-side validation, but submissions will be blocked: page_signals lists them under blocked_by_safe_mode, and that is expected, not a bug."
}

${o.budget} The browser window is ${WIDTH}x${HEIGHT}.`;
}
