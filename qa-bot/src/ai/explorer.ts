import fs from "node:fs";
import path from "node:path";
import type {
  BetaContentBlockParam,
  BetaImageBlockParam,
  BetaMessageParam,
  BetaTextBlockParam,
  BetaToolResultBlockParam,
  BetaToolUnion,
  BetaToolUseBlock,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { Browser, Page } from "playwright";
import { newContext } from "../browser.js";
import type { QaConfig } from "../config.js";
import type { FindingSink } from "../findings.js";
import type { Category, ExplorerStep, Finding, Severity } from "../types.js";
import { ensureDir, log, sleep, truncate } from "../util.js";
import { AiClient, describeAiError } from "./client.js";

const WIDTH = 1280;
const HEIGHT = 800;

const SYSTEM = `You are an elite exploratory tester driving a real Chromium browser through the computer tools. You test web applications the way a sharp, sceptical human QA engineer would, and you find the bugs automated scanners miss.

How you work:
- Start by understanding what the product does and who it is for, then pick the journeys that matter most (sign-up, core workflow, anything involving money, data entry, or irreversible actions).
- Test each journey end to end, then attack it: empty and invalid inputs, boundary values (0, negative, huge numbers, 500-character strings, emoji, <script> and quotes in text fields), double-clicking submit, browser back/refresh mid-flow, deep links straight into a later step, switching options after filling dependent fields.
- Check the result of every action. After clicking or submitting, take a screenshot and look for what changed. After significant actions call page_signals: it reveals JavaScript exceptions, console errors and failed API calls that are invisible on screen.
- Judge the UX as well as the function: confusing flows, missing feedback, unclear errors, lost input after an error, inconsistent labels, layout breaking with long content.
- Batch obviously safe actions (e.g. click a field, type, press Tab) and end a batch with a screenshot.

Reporting:
- Only report issues you actually observed. Reproduce anything surprising once before reporting.
- One report_issue call per distinct problem, with numbered reproduction steps a developer can follow, expected vs actual behaviour, and the most accurate severity:
  critical = data loss, security hole, or a core journey is impossible; high = a feature is broken or produces wrong results; medium = confusing or error-prone behaviour with a workaround; low = polish.
- Do not re-report issues listed as already known.
- Stay on the site under test. Never enter real personal or payment data; use obviously fake test data.
- When you have covered the important journeys (or are nearly out of turns), call finish with a summary, the journeys you covered, and what you could not test.`;

const REPORT_CATEGORIES = ["functional", "ux", "visual", "content", "accessibility", "responsive", "performance", "security", "backend"] as const;

const TOOLS: BetaToolUnion[] = [
  { type: "computer_toolset_20260801" },
  {
    name: "navigate",
    description: "Load a URL in the current tab. Accepts a path relative to the site root (e.g. /pricing) or an absolute URL on the site under test.",
    input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"], additionalProperties: false },
    strict: true,
  },
  {
    name: "page_signals",
    description:
      "Return what happened under the hood since the last call: uncaught JavaScript exceptions, console errors, failed or 4xx/5xx network requests, requests blocked by safe mode, plus the current URL and title.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  {
    name: "page_text",
    description:
      "Return the page's visible text (truncated) and every visible form field with its label, type, current value, required flag and validation message. Use it to read small print or check copy precisely.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  {
    name: "report_issue",
    description: "Record a confirmed bug or UX problem. A screenshot of the current screen is attached automatically, so call it while the problem is visible.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Specific title naming the feature and the failure" },
        severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
        category: { type: "string", enum: [...REPORT_CATEGORIES] },
        description: { type: "string" },
        steps_to_reproduce: { type: "array", items: { type: "string" } },
        expected: { type: "string" },
        actual: { type: "string" },
      },
      required: ["title", "severity", "category", "description", "steps_to_reproduce", "expected", "actual"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "finish",
    description: "End the test session.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "What you tested and the overall quality verdict" },
        journeys_covered: { type: "array", items: { type: "string" } },
        coverage_gaps: { type: "array", items: { type: "string" }, description: "Important things you could not test, and why" },
      },
      required: ["summary", "journeys_covered", "coverage_gaps"],
      additionalProperties: false,
    },
    strict: true,
  },
];

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

export interface ExplorerOptions {
  ai: AiClient;
  browser: Browser;
  baseUrl: string;
  cfg: QaConfig;
  storageState?: string;
  outDir: string;
  sink: FindingSink;
  siteMap: string[];
  known: Finding[];
  allowMutations: boolean;
  isLocal: boolean;
  maxTurns: number;
}

type Input = Record<string, unknown>;

export async function runExplorer(o: ExplorerOptions) {
  const origin = new URL(o.baseUrl).origin;
  const dir = path.join(o.outDir, "explorer");
  ensureDir(dir);
  const ctx = await newContext(o.browser, "desktop", { baseUrl: o.baseUrl, cfg: o.cfg, storageState: o.storageState });
  const blocked: string[] = [];
  if (!o.allowMutations) {
    await ctx.route("**/*", (route) => {
      const req = route.request();
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method()) && req.url().startsWith(origin)) {
        blocked.push(`${req.method()} ${new URL(req.url()).pathname}`);
        return route.abort("blockedbyclient");
      }
      return route.fallback();
    });
  }
  let page: Page = await ctx.newPage();
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  const popups: string[] = [];
  ctx.on("page", (p) => {
    if (p === page) return;
    popups.push(p.url());
    p.close().catch(() => {});
  });

  const signals = { exceptions: [] as string[], console: [] as string[], failed: [] as string[] };
  const wire = (p: Page) => {
    p.on("pageerror", (e) => signals.exceptions.push(truncate(e.message, 400)));
    p.on("console", (m) => {
      if (m.type() === "error" && !/Failed to load resource/.test(m.text())) signals.console.push(truncate(m.text(), 300));
    });
    p.on("response", (r) => {
      if (r.status() >= 400) signals.failed.push(`${r.request().method()} ${truncate(r.url(), 160)} → ${r.status()}`);
    });
    p.on("requestfailed", (r) => {
      const f = r.failure()?.errorText ?? "";
      if (!/ERR_ABORTED|BLOCKED_BY_CLIENT/.test(f)) signals.failed.push(`${r.method()} ${truncate(r.url(), 160)} → ${f}`);
    });
  };
  wire(page);
  await page.goto(o.baseUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

  let mouse = { x: WIDTH / 2, y: HEIGHT / 2 };
  let shots = 0;
  const steps: ExplorerStep[] = [];
  let issueCount = 0;
  const result: { summary?: string; journeysCovered?: string[]; coverageGaps?: string[] } = {};

  const screenshot = async (): Promise<BetaImageBlockParam> => {
    const buf = await page.screenshot({ type: "png", animations: "disabled" });
    shots++;
    return { type: "image", source: { type: "base64", media_type: "image/png", data: buf.toString("base64") } };
  };

  const afterAction = async (): Promise<string> => {
    await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(350);
    const notes: string[] = [];
    const url = page.url();
    if (url !== "about:blank" && !url.startsWith(origin)) {
      notes.push(`left the site under test (${truncate(url, 100)}); navigated back`);
      await page.goBack().catch(() => page.goto(o.baseUrl));
    }
    if (popups.length) notes.push(`a new tab opened (${popups.splice(0).join(", ")}) and was closed; use navigate if you need it`);
    return notes.length ? `OK (${notes.join("; ")})` : "OK";
  };

  const withModifiers = async (mods: string[], fn: () => Promise<void>) => {
    for (const m of mods) await page.keyboard.down(m);
    try {
      await fn();
    } finally {
      for (const m of mods.reverse()) await page.keyboard.up(m);
    }
  };

  const point = (input: Input): [number, number] => {
    const c = input.coordinate as [number, number] | undefined;
    return c ? [Math.round(c[0]), Math.round(c[1])] : [mouse.x, mouse.y];
  };

  const execComputer = async (name: string, input: Input): Promise<BetaToolResultBlockParam["content"]> => {
    switch (name) {
      case "screenshot":
        return [await screenshot()];
      case "zoom": {
        const [x0, y0, x1, y1] = (input.region as number[]).map((n) => Math.max(0, Math.round(n)));
        const buf = await page.screenshot({ type: "png", clip: { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) } });
        return [{ type: "image", source: { type: "base64", media_type: "image/png", data: buf.toString("base64") } }];
      }
      case "left_click":
      case "right_click":
      case "middle_click":
      case "double_click":
      case "triple_click": {
        const [x, y] = point(input);
        const button = name === "right_click" ? "right" : name === "middle_click" ? "middle" : "left";
        const clickCount = name === "double_click" ? 2 : name === "triple_click" ? 3 : 1;
        await withModifiers(modifiers(input.text), async () => {
          await page.mouse.move(x, y);
          await page.mouse.click(x, y, { button, clickCount });
        });
        mouse = { x, y };
        return afterAction();
      }
      case "left_click_drag": {
        const [sx, sy] = (input.start_coordinate as number[]) ?? [mouse.x, mouse.y];
        const [x, y] = point(input);
        await withModifiers(modifiers(input.text), async () => {
          await page.mouse.move(sx, sy);
          await page.mouse.down();
          await page.mouse.move(x, y, { steps: 12 });
          await page.mouse.up();
        });
        mouse = { x, y };
        return afterAction();
      }
      case "mouse_move": {
        const [x, y] = point(input);
        await page.mouse.move(x, y);
        mouse = { x, y };
        return "OK";
      }
      case "left_mouse_down":
        await page.mouse.down();
        return "OK";
      case "left_mouse_up":
        await page.mouse.up();
        return afterAction();
      case "cursor_position":
        return `X=${mouse.x}, Y=${mouse.y}`;
      case "scroll": {
        const [x, y] = point(input);
        const amount = Number(input.scroll_amount ?? 3) * 100;
        const dir = String(input.scroll_direction ?? "down");
        const dx = dir === "left" ? -amount : dir === "right" ? amount : 0;
        const dy = dir === "up" ? -amount : dir === "down" ? amount : 0;
        await page.mouse.move(x, y);
        await withModifiers(modifiers(input.text), () => page.mouse.wheel(dx, dy));
        await page.waitForTimeout(300);
        return "OK";
      }
      case "type":
        await page.keyboard.type(String(input.text ?? ""), { delay: 12 });
        return "OK";
      case "key": {
        const combo = mapKey(String(input.text ?? ""));
        const repeat = Math.min(100, Math.max(1, Number(input.repeat ?? 1)));
        for (let i = 0; i < repeat; i++) await page.keyboard.press(combo);
        return afterAction();
      }
      case "hold_key": {
        const keys = modifiers(input.text);
        for (const k of keys) await page.keyboard.down(k);
        await sleep(Math.min(Number(input.duration ?? 1), 10) * 1000);
        for (const k of keys.reverse()) await page.keyboard.up(k);
        return "OK";
      }
      case "wait":
        await sleep(Math.min(Number(input.duration ?? 1), 15) * 1000);
        return "OK";
      default:
        throw new Error(`Unsupported computer action: ${name}`);
    }
  };

  const execCustom = async (name: string, input: Input, turn: number): Promise<BetaToolResultBlockParam["content"]> => {
    switch (name) {
      case "navigate": {
        const target = new URL(String(input.url), o.baseUrl);
        if (target.origin !== origin) return `Refused: ${target.origin} is outside the site under test (${origin}).`;
        const r = await page.goto(target.toString(), { waitUntil: "domcontentloaded" }).catch((e: Error) => e);
        await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
        const status = r instanceof Error ? `failed: ${r.message.split("\n")[0]}` : `HTTP ${r?.status()}`;
        return [{ type: "text", text: `Loaded ${target.pathname}${target.search} (${status}).` }, await screenshot()];
      }
      case "page_signals": {
        const out = {
          url: page.url(),
          title: await page.title().catch(() => ""),
          uncaught_exceptions: signals.exceptions.splice(0),
          console_errors: signals.console.splice(0),
          failed_requests: signals.failed.splice(0),
          blocked_by_safe_mode: blocked.splice(0),
        };
        return JSON.stringify(out, null, 1);
      }
      case "page_text": {
        const data = await page.evaluate(() => {
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
          return { text: (document.body?.innerText ?? "").slice(0, 7000), fields };
        });
        return JSON.stringify(data, null, 1);
      }
      case "report_issue": {
        issueCount++;
        const file = path.join(dir, `issue-${issueCount}.png`);
        await page.screenshot({ path: file }).catch(() => {});
        const cat = String(input.category);
        const category: Category = (REPORT_CATEGORIES as readonly string[]).includes(cat) ? (cat as Category) : "functional";
        o.sink.add({
          ruleId: `ai-explore:${category}`,
          key: String(input.title),
          title: String(input.title),
          severity: (["critical", "high", "medium", "low"].includes(String(input.severity)) ? input.severity : "medium") as Severity,
          category,
          description: `${input.description}\n\nExpected: ${input.expected}\nActual: ${input.actual}`,
          source: "ai-explorer",
          steps: (input.steps_to_reproduce as string[]) ?? [],
          occurrence: { url: page.url(), viewport: "desktop", screenshot: path.relative(o.outDir, file) },
          tags: ["ai"],
        });
        steps.push({ turn, kind: "issue", text: `[${input.severity}] ${input.title}`, screenshot: path.relative(o.outDir, file) });
        log.info(`  🐞 explorer found: [${input.severity}] ${input.title}`);
        return `Recorded issue #${issueCount}.`;
      }
      default:
        return `Unknown tool ${name}`;
    }
  };

  const describe = (name: string, input: Input) => {
    if (name === "type") return `type "${truncate(String(input.text ?? ""), 60)}"`;
    if (name === "key") return `key ${input.text}`;
    if (name === "navigate") return `navigate ${input.url}`;
    if (input.coordinate) return `${name} at (${(input.coordinate as number[]).join(", ")})`;
    if (name === "scroll") return `scroll ${input.scroll_direction} ×${input.scroll_amount ?? 3}`;
    return name;
  };

  const journeys = o.cfg.journeys.length
    ? o.cfg.journeys.map((j, i) => `${i + 1}. ${j}`).join("\n")
    : "None were specified. Work out the 3-5 most important user journeys from the site map and the UI, then test them end to end.";
  const knownList = o.known
    .slice(0, 40)
    .map((f) => `- [${f.severity}] ${f.title}`)
    .join("\n");
  const kickoff = `Site under test: ${o.baseUrl}${o.cfg.name ? ` (${o.cfg.name})` : ""}
${o.isLocal ? "This is a local development copy of the app." : "This is a deployed environment; treat it with care."}

Pages discovered from the codebase and crawl:
${o.siteMap.slice(0, 80).join("\n") || "(none: explore from the home page)"}

Journeys to test:
${journeys}

Already known from automated checks (do not re-report):
${knownList || "- none"}

${
  o.allowMutations
    ? "You may submit forms and create test data. Use obviously fake data (e.g. name \"QA Test\", email qa+test@example.com)."
    : "SAFE MODE: state-changing requests (POST/PUT/PATCH/DELETE) to this site are blocked by the harness. You can still fill forms to test client-side validation, but submissions will be blocked: page_signals lists them under blocked_by_safe_mode, and that is expected, not a bug."
}

You have about ${o.maxTurns} turns. The browser window is ${WIDTH}x${HEIGHT}; here is the current screen.`;

  const system: BetaTextBlockParam[] = [{ type: "text", text: SYSTEM }];
  const messages: BetaMessageParam[] = [{ role: "user", content: [{ type: "text", text: kickoff }, await screenshot()] }];
  let finished = false;
  let nudged = false;

  for (let turn = 1; turn <= o.maxTurns && !finished; turn++) {
    let msg;
    try {
      msg = await o.ai.create({ system, messages, tools: TOOLS });
    } catch (e) {
      const m = `Explorer stopped: ${describeAiError(e)}`;
      o.ai.errors.push(m);
      log.warn(m);
      break;
    }
    messages.push({ role: "assistant", content: msg.content as BetaContentBlockParam[] });
    for (const b of msg.content) {
      if (b.type === "text" && b.text.trim()) steps.push({ turn, kind: "note", text: truncate(b.text.trim(), 600) });
      if (b.type === "thinking" && b.thinking.trim()) steps.push({ turn, kind: "note", text: truncate(b.thinking.trim(), 600) });
    }
    if (msg.stop_reason === "refusal") {
      steps.push({ turn, kind: "system", text: "The model declined to continue this session." });
      break;
    }
    const toolUses = msg.content.filter((b): b is BetaToolUseBlock => b.type === "tool_use");
    if (!toolUses.length) {
      if (msg.stop_reason === "pause_turn") continue;
      const text = msg.stop_reason === "max_tokens" ? "Continue." : "Keep testing: there are more journeys and edge cases to cover. When you are truly done, call finish.";
      if (msg.stop_reason === "max_tokens" || !nudged) {
        nudged = true;
        messages.push({ role: "user", content: [{ type: "text", text }] });
        continue;
      }
      break;
    }
    const results: BetaContentBlockParam[] = [];
    let batchFailed = false;
    for (const tu of toolUses) {
      const input = (tu.input ?? {}) as Input;
      const isComputer = (tu as BetaToolUseBlock & { toolset_name?: string | null }).toolset_name === "computer";
      if (isComputer) {
        if (batchFailed) {
          results.push({ type: "tool_result", tool_use_id: tu.id, toolset_name: "computer", is_error: true, content: "Not executed: an earlier computer action in this turn failed." });
          continue;
        }
        try {
          const content = await execComputer(tu.name, input);
          results.push({ type: "tool_result", tool_use_id: tu.id, toolset_name: "computer", content });
          if (tu.name !== "screenshot") steps.push({ turn, kind: "action", text: describe(tu.name, input) });
        } catch (e) {
          batchFailed = true;
          results.push({ type: "tool_result", tool_use_id: tu.id, toolset_name: "computer", is_error: true, content: `Error: ${(e as Error).message.split("\n")[0]}` });
        }
        continue;
      }
      if (tu.name === "finish") {
        result.summary = String(input.summary ?? "");
        result.journeysCovered = (input.journeys_covered as string[]) ?? [];
        result.coverageGaps = (input.coverage_gaps as string[]) ?? [];
        finished = true;
        results.push({ type: "tool_result", tool_use_id: tu.id, content: "Session finished." });
        continue;
      }
      try {
        const content = await execCustom(tu.name, input, turn);
        results.push({ type: "tool_result", tool_use_id: tu.id, content });
        if (tu.name === "navigate") steps.push({ turn, kind: "action", text: describe(tu.name, input) });
      } catch (e) {
        results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: `Error: ${(e as Error).message.split("\n")[0]}` });
      }
    }
    const remaining = o.maxTurns - turn;
    if (!finished && remaining === 5) {
      results.push({ type: "text", text: "Five turns left: report any confirmed issues you haven't reported yet, then call finish." });
    }
    messages.push({ role: "user", content: results });
    if (page.isClosed()) {
      page = await ctx.newPage();
      wire(page);
    }
  }

  fs.writeFileSync(path.join(dir, "log.json"), JSON.stringify({ steps, result, screenshots: shots }, null, 2));
  await ctx.close();
  return { summary: result.summary, journeysCovered: result.journeysCovered, coverageGaps: result.coverageGaps, steps };
}
