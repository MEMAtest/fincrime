import fs from "node:fs";
import path from "node:path";
import type {
  BetaContentBlockParam,
  BetaMessageParam,
  BetaTextBlockParam,
  BetaToolResultBlockParam,
  BetaToolUnion,
  BetaToolUseBlock,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { log } from "../util.js";
import type { AnthropicApiBackend } from "./api-backend.js";
import { describeAiError } from "./api-backend.js";
import { BrowserHarness, describeAction, EXPLORER_SYSTEM, explorerKickoff, REPORT_CATEGORIES, type Input, type ToolContent } from "./harness.js";
import type { ExplorerOptions, ExplorerResult } from "./backend.js";

export { mapKey } from "./harness.js";

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
      "Return the page's visible text (truncated), every visible form field with its label, type, current value, required flag and validation message, and the clickable labels. Use it to read small print or check copy precisely.",
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

function toApiContent(c: ToolContent): BetaToolResultBlockParam["content"] {
  return c.map((b) =>
    b.type === "text" ? { type: "text" as const, text: b.text } : { type: "image" as const, source: { type: "base64" as const, media_type: "image/png" as const, data: b.png.toString("base64") } },
  );
}

/** Explorer on the Messages API: Claude's native computer-use toolset over the harness's Playwright page. */
export async function runApiExplorer(ai: AnthropicApiBackend, o: ExplorerOptions): Promise<ExplorerResult> {
  const h = await BrowserHarness.create(o);
  const kickoff = explorerKickoff({ ...o, name: o.cfg.name, journeys: o.cfg.journeys, budget: `You have about ${o.maxTurns} turns. Here is the current screen.` });
  const system: BetaTextBlockParam[] = [{ type: "text", text: `${EXPLORER_SYSTEM}\n\nBatch obviously safe actions (e.g. click a field, type, press Tab) and end a batch with a screenshot.` }];
  const first = await h.screenshot();
  const messages: BetaMessageParam[] = [
    { role: "user", content: [{ type: "text", text: kickoff }, { type: "image", source: { type: "base64", media_type: "image/png", data: first.toString("base64") } }] },
  ];
  let nudged = false;

  for (let turn = 1; turn <= o.maxTurns && !h.finished; turn++) {
    h.turn = turn;
    let msg;
    try {
      msg = await ai.create({ system, messages, tools: TOOLS });
    } catch (e) {
      const m = `Explorer stopped: ${describeAiError(e)}`;
      ai.errors.push(m);
      log.warn(m);
      break;
    }
    messages.push({ role: "assistant", content: msg.content as BetaContentBlockParam[] });
    for (const b of msg.content) {
      if (b.type === "text" && b.text.trim()) h.log("note", b.text.trim());
      if (b.type === "thinking" && b.thinking.trim()) h.log("note", b.thinking.trim());
    }
    if (msg.stop_reason === "refusal") {
      h.log("system", "The model declined to continue this session.");
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
          await h.ensurePage();
          results.push({ type: "tool_result", tool_use_id: tu.id, toolset_name: "computer", content: toApiContent(await h.act(tu.name, input)) });
          if (tu.name !== "screenshot") h.log("action", describeAction(tu.name, input));
        } catch (e) {
          batchFailed = true;
          results.push({ type: "tool_result", tool_use_id: tu.id, toolset_name: "computer", is_error: true, content: `Error: ${(e as Error).message.split("\n")[0]}` });
        }
        continue;
      }
      try {
        let content: ToolContent;
        if (tu.name === "finish") content = h.finish(input);
        else if (tu.name === "navigate") content = await h.navigate(String(input.url));
        else if (tu.name === "page_signals") content = await h.pageSignals();
        else if (tu.name === "page_text") content = await h.pageText();
        else if (tu.name === "report_issue") content = await h.reportIssue(input);
        else content = [{ type: "text", text: `Unknown tool ${tu.name}` }];
        results.push({ type: "tool_result", tool_use_id: tu.id, content: toApiContent(content) });
      } catch (e) {
        results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: `Error: ${(e as Error).message.split("\n")[0]}` });
      }
    }
    if (!h.finished && o.maxTurns - turn === 5) {
      results.push({ type: "text", text: "Five turns left: report any confirmed issues you haven't reported yet, then call finish." });
    }
    messages.push({ role: "user", content: results });
  }

  fs.writeFileSync(path.join(o.outDir, "explorer", "log.json"), JSON.stringify({ steps: h.steps, result: h.result, screenshots: h.shots }, null, 2));
  await h.close();
  return { ...h.result, steps: h.steps };
}
