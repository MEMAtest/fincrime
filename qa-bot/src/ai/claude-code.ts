import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import type { AiSummary } from "../types.js";
import { killTree, log, truncate } from "../util.js";
import type { AiBackend, ExplorerOptions, ExplorerResult, ImageInput } from "./backend.js";
import { BrowserHarness, EXPLORER_SYSTEM, explorerKickoff, REPORT_CATEGORIES, type Input, type ToolContent } from "./harness.js";

export const DEFAULT_CLAUDE_CODE_MODEL = "sonnet";

export function claudeBin(): string {
  return process.env.QABOT_CLAUDE_BIN || "claude";
}

/** Is a runnable `claude` CLI on PATH? (Login state is checked on first use.) */
export function claudeCodeAvailable(): { ok: boolean; version?: string } {
  try {
    const r = spawnSync(claudeBin(), ["--version"], { encoding: "utf8", timeout: 15_000 });
    if (r.status === 0) return { ok: true, version: r.stdout.trim().split("\n")[0] };
  } catch {
    /* not installed */
  }
  return { ok: false };
}

interface ClaudeResult {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
  total_cost_usd?: number;
  num_turns?: number;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
}

/**
 * Claude through the user's own Claude Code CLI in headless mode (`claude -p`). No API key: it runs on
 * whatever Claude Code is logged in with (a Pro/Max/Team subscription, or CLAUDE_CODE_OAUTH_TOKEN in CI),
 * and counts against that plan's usage limits.
 */
export class ClaudeCodeBackend implements AiBackend {
  readonly name = "claude-code" as const;
  readonly usage: AiSummary["usage"] = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, requests: 0, costUsd: 0 };
  readonly errors: string[] = [];

  constructor(
    readonly model: string,
    private readonly workDir: string,
  ) {}

  private track(r: ClaudeResult) {
    this.usage.requests += Math.max(1, r.num_turns ?? 1);
    this.usage.inputTokens += (r.usage?.input_tokens ?? 0) + (r.usage?.cache_creation_input_tokens ?? 0);
    this.usage.outputTokens += r.usage?.output_tokens ?? 0;
    this.usage.cacheReadTokens += r.usage?.cache_read_input_tokens ?? 0;
    this.usage.costUsd = (this.usage.costUsd ?? 0) + (r.total_cost_usd ?? 0);
  }

  /** Run `claude -p` with the prompt on stdin and return the parsed JSON result. */
  run(args: string[], prompt: string, timeoutMs: number, signal?: { kill?: () => void }): Promise<ClaudeResult> {
    return new Promise((resolve, reject) => {
      const env = { ...process.env };
      const child = spawn(claudeBin(), ["-p", "--output-format", "json", "--model", this.model, "--no-session-persistence", ...args], {
        cwd: this.workDir,
        env,
        stdio: ["pipe", "pipe", "pipe"],
        detached: process.platform !== "win32",
      });
      if (signal) signal.kill = () => killTree(child.pid);
      let out = "";
      let err = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
      const timer = setTimeout(() => killTree(child.pid), timeoutMs);
      child.on("error", (e) => {
        clearTimeout(timer);
        reject(new Error(`Could not start Claude Code (${claudeBin()}): ${e.message}`));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        let parsed: ClaudeResult | undefined;
        try {
          parsed = JSON.parse(out.slice(out.indexOf("{")));
        } catch {
          /* fall through */
        }
        if (!parsed) {
          const hint = /log ?in|auth|credential|401/i.test(out + err) ? " Is Claude Code logged in? Run `claude` once and /login." : "";
          return reject(new Error(`Claude Code exited with code ${code} and no JSON result.${hint}\n${truncate((err || out).trim(), 600)}`));
        }
        this.track(parsed);
        if (parsed.is_error) return reject(new Error(`Claude Code reported an error (${parsed.subtype}): ${truncate(parsed.result ?? "", 400)}`));
        resolve(parsed);
      });
      child.stdin.end(prompt);
    });
  }

  async structured<S extends z.ZodType>(p: { system: string; text: string; images?: ImageInput[]; schema: S }): Promise<z.infer<S>> {
    const schema = z.toJSONSchema(p.schema) as Record<string, unknown>;
    delete schema.$schema;
    const images = p.images ?? [];
    const prompt = images.length
      ? `${p.text}\n\nScreenshots: open every one with the Read tool before answering.\n${images.map((i) => `- ${i.label}: ${path.relative(this.workDir, i.path)}`).join("\n")}`
      : p.text;
    const r = await this.run(
      [
        "--append-system-prompt",
        p.system,
        "--json-schema",
        JSON.stringify(schema),
        "--tools",
        images.length ? "Read" : "",
        "--strict-mcp-config",
        "--permission-mode",
        "dontAsk",
      ],
      prompt,
      10 * 60_000,
    );
    const candidate = r.structured_output ?? extractJson(r.result ?? "");
    const parsed = p.schema.safeParse(candidate);
    if (!parsed.success) throw new Error(`Claude Code's answer did not match the schema: ${truncate(parsed.error.message, 300)}`);
    return parsed.data;
  }

  async explore(o: ExplorerOptions): Promise<ExplorerResult> {
    const h = await BrowserHarness.create(o);
    const budget = o.maxTurns * 2; // tool calls; Claude Code makes one call per model turn
    let calls = 0;
    const kill: { kill?: () => void } = {};

    const server = new McpServer({ name: "qabot", version: "0.2.0" });
    const toMcp = (c: ToolContent) => ({
      content: c.map((b) => (b.type === "text" ? { type: "text" as const, text: b.text } : { type: "image" as const, data: b.png.toString("base64"), mimeType: "image/png" })),
    });
    const tool = <T extends z.ZodRawShape>(name: string, description: string, shape: T, fn: (a: z.infer<z.ZodObject<T>>) => Promise<ToolContent> | ToolContent, logAs?: (a: z.infer<z.ZodObject<T>>) => string) => {
      server.registerTool(name, { description, inputSchema: shape }, (async (a: z.infer<z.ZodObject<T>>) => {
        calls++;
        h.turn = calls;
        if (h.finished) return toMcp([{ type: "text", text: "The session is finished." }]);
        if (calls > budget + 6 && name !== "finish" && name !== "report_issue") {
          setTimeout(() => kill.kill?.(), 2000);
          return { ...toMcp([{ type: "text", text: "Budget exhausted. The session is being closed." }]), isError: true };
        }
        try {
          await h.ensurePage();
          const out = await fn(a);
          if (logAs) h.log("action", logAs(a));
          if (calls === Math.floor(budget * 0.85)) out.push({ type: "text", text: "Note: you are close to your action budget. Report any confirmed issues now, then call finish." });
          if (calls >= budget && name !== "finish") out.push({ type: "text", text: "Action budget reached: call finish now." });
          return toMcp(out);
        } catch (e) {
          return { ...toMcp([{ type: "text", text: `Error: ${(e as Error).message.split("\n")[0]}` }]), isError: true };
        }
      }) as never);
    };

    tool("screenshot", `Capture the browser viewport (1280x800 PNG). Pixel coordinates in click/scroll/zoom use this image's space.`, {}, () => h.act("screenshot", {}));
    tool(
      "click",
      "Click at pixel coordinates from the latest screenshot.",
      { x: z.number(), y: z.number(), button: z.enum(["left", "right"]).optional(), clicks: z.number().int().min(1).max(3).optional(), modifiers: z.string().optional().describe('e.g. "shift" or "ctrl+shift"') },
      (a) => h.act(a.button === "right" ? "right_click" : a.clicks === 2 ? "double_click" : a.clicks === 3 ? "triple_click" : "left_click", { coordinate: [a.x, a.y], text: a.modifiers }),
      (a) => `click at (${a.x}, ${a.y})`,
    );
    tool(
      "click_text",
      "Click a button, link or other element by its visible text or accessible name. Prefer this over pixel clicks when the target has a label.",
      { text: z.string(), role: z.string().optional().describe("ARIA role to disambiguate, e.g. button, link, tab, checkbox, menuitem") },
      (a) => h.clickText(a.text, a.role),
      (a) => `click "${a.text}"`,
    );
    tool("fill", "Replace the value of a form field found by its label or placeholder.", { field: z.string(), value: z.string() }, (a) => h.fill(a.field, a.value), (a) => `fill "${a.field}" with "${truncate(a.value, 40)}"`);
    tool("select_option", "Choose an option in a <select> found by its label.", { field: z.string(), option: z.string() }, (a) => h.select(a.field, a.option), (a) => `select "${a.option}" in "${a.field}"`);
    tool("type", "Type text into whatever currently has focus.", { text: z.string() }, (a) => h.act("type", { text: a.text }), (a) => `type "${truncate(a.text, 40)}"`);
    tool("press_key", 'Press a key or combination, e.g. "Enter", "Tab", "Escape", "ctrl+a".', { key: z.string(), repeat: z.number().int().min(1).max(50).optional() }, (a) => h.act("key", { text: a.key, repeat: a.repeat }), (a) => `key ${a.key}`);
    tool(
      "scroll",
      "Scroll the page (or the element under x,y).",
      { direction: z.enum(["up", "down", "left", "right"]), amount: z.number().int().min(1).max(30).optional(), x: z.number().optional(), y: z.number().optional() },
      (a) => h.act("scroll", { scroll_direction: a.direction, scroll_amount: a.amount ?? 5, coordinate: a.x !== undefined && a.y !== undefined ? [a.x, a.y] : undefined }),
      (a) => `scroll ${a.direction}`,
    );
    tool("zoom", "Capture a region of the screen at full resolution to read small text.", { x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number() }, (a) => h.act("zoom", { region: [a.x0, a.y0, a.x1, a.y1] }));
    tool("navigate", "Load a path (e.g. /pricing) or absolute URL on the site under test. Returns a screenshot.", { url: z.string() }, (a) => h.navigate(a.url));
    tool("go_back", "Browser back button.", {}, async () => {
      await h.page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
      return [{ type: "text", text: `Now at ${h.page.url()}` }];
    }, () => "back");
    tool("page_signals", "What happened under the hood since the last call: uncaught JS exceptions, console errors, failed/4xx/5xx requests, requests blocked by safe mode, current URL and title.", {}, () => h.pageSignals());
    tool("page_text", "Visible page text, every visible form field (label, type, value, required, validation message) and clickable labels.", {}, () => h.pageText());
    tool(
      "report_issue",
      "Record a confirmed bug or UX problem. A screenshot of the current screen is attached automatically, so call it while the problem is visible.",
      {
        title: z.string(),
        severity: z.enum(["critical", "high", "medium", "low"]),
        category: z.enum(REPORT_CATEGORIES),
        description: z.string(),
        steps_to_reproduce: z.array(z.string()),
        expected: z.string(),
        actual: z.string(),
      },
      (a) => h.reportIssue(a as Input),
    );
    tool(
      "finish",
      "End the test session with a summary, the journeys you covered and the gaps.",
      { summary: z.string(), journeys_covered: z.array(z.string()), coverage_gaps: z.array(z.string()) },
      (a) => h.finish(a as Input),
    );

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
    await server.connect(transport);
    const httpServer = http.createServer((req, res) => {
      if (req.url?.startsWith("/mcp")) transport.handleRequest(req, res).catch(() => res.end());
      else res.writeHead(404).end();
    });
    await new Promise<void>((r) => httpServer.listen(0, "127.0.0.1", () => r()));
    const addr = httpServer.address();
    const url = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}/mcp`;

    const names = ["screenshot", "click", "click_text", "fill", "select_option", "type", "press_key", "scroll", "zoom", "navigate", "go_back", "page_signals", "page_text", "report_issue", "finish"];
    const kickoff = explorerKickoff({
      ...o,
      name: o.cfg.name,
      journeys: o.cfg.journeys,
      budget: `You have a budget of about ${budget} tool calls. Start with the screenshot tool.`,
    });
    const system = `${EXPLORER_SYSTEM}\n\nYour browser tools come from the "qabot" MCP server. Prefer click_text / fill / select_option when an element has a visible label; use pixel clicks from the latest screenshot otherwise. Always finish with the finish tool.`;
    try {
      await this.run(
        [
          "--append-system-prompt",
          system,
          "--mcp-config",
          JSON.stringify({ mcpServers: { qabot: { type: "http", url } } }),
          "--strict-mcp-config",
          "--tools",
          "",
          "--allowedTools",
          names.map((n) => `mcp__qabot__${n}`).join(","),
          "--permission-mode",
          "dontAsk",
        ],
        kickoff,
        35 * 60_000,
        kill,
      );
    } catch (e) {
      if (!h.finished) {
        const m = `Explorer (Claude Code) stopped: ${(e as Error).message.split("\n")[0]}`;
        this.errors.push(m);
        log.warn(m);
      }
    } finally {
      await transport.close().catch(() => {});
      await new Promise<void>((r) => httpServer.close(() => r()));
    }
    fs.writeFileSync(path.join(o.outDir, "explorer", "log.json"), JSON.stringify({ steps: h.steps, result: h.result, toolCalls: calls, screenshots: h.shots }, null, 2));
    await h.close();
    return { ...h.result, steps: h.steps };
  }
}

/** Last-resort parse when a JSON object is embedded in prose. */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}
