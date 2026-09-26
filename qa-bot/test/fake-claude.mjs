#!/usr/bin/env node
/**
 * Stand-in for the `claude` CLI in headless mode, so the Claude Code backend is tested offline.
 * - With --json-schema it answers the UX review / triage prompts with canned JSON.
 * - With --mcp-config it connects to qabot's MCP server as a real MCP client and drives the browser.
 * Every invocation is appended to $FAKE_CLAUDE_LOG for the test to inspect.
 */
import fs from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const args = process.argv.slice(2);
if (args[0] === "--version") {
  console.log("9.9.9 (Claude Code, fake)");
  process.exit(0);
}
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const record = (entry) => {
  if (process.env.FAKE_CLAUDE_LOG) fs.appendFileSync(process.env.FAKE_CLAUDE_LOG, JSON.stringify(entry) + "\n");
};
const prompt = fs.readFileSync(0, "utf8");
const done = (structured, extra = {}) => {
  process.stdout.write(
    JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      result: structured ? JSON.stringify(structured) : "Done.",
      structured_output: structured,
      total_cost_usd: 0.0123,
      num_turns: 3,
      usage: { input_tokens: 900, output_tokens: 200, cache_read_input_tokens: 4000, cache_creation_input_tokens: 100 },
      ...extra,
    }),
  );
};

const schemaArg = flag("--json-schema");
const mcpArg = flag("--mcp-config");

if (schemaArg) {
  const schema = JSON.parse(schemaArg);
  const props = Object.keys(schema.properties ?? {});
  // The prompt lists screenshots relative to the working directory, where the Read tool can open them.
  const section = prompt.split(/^Screenshots:.*$/m)[1] ?? "";
  const shots = [...section.matchAll(/^- [^:]+: (\S+\.(?:png|jpe?g))$/gm)].map((m) => m[1]);
  record({ kind: "structured", props, args, shots, shotsExist: shots.every((s) => fs.existsSync(path.resolve(process.cwd(), s))) });
  if (props.includes("page_purpose")) {
    done({
      page_purpose: "Marketing page",
      overall_score: 58,
      strengths: ["Clear headline"],
      findings: [
        {
          title: "Primary call to action competes with a second identical button",
          severity: "medium",
          category: "visual",
          viewport: "desktop",
          location: "hero, under the price row",
          evidence: "'Get started' and 'Learn more' use the same filled style.",
          recommendation: "Make 'Learn more' a secondary (outline) button.",
        },
      ],
    });
  } else {
    done({
      executive_summary: "Fake triage via Claude Code: broken CTA and broken links.",
      release_recommendation: "block",
      top_priorities: [{ title: "Fix the Get started button", why_it_matters: "Primary CTA throws", finding_ids: [], suggested_fix: "Initialise the cart", likely_files: ["index.html"] }],
      likely_false_positives: [],
      missing_coverage: ["Checkout"],
    });
  }
} else if (mcpArg) {
  const url = JSON.parse(mcpArg).mcpServers.qabot.url;
  const client = new Client({ name: "fake-claude", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  const tools = (await client.listTools()).tools.map((t) => t.name);
  const calls = [];
  const call = async (name, a = {}) => {
    const r = await client.callTool({ name, arguments: a });
    calls.push({ name, isError: !!r.isError, types: r.content.map((c) => c.type), text: r.content.filter((c) => c.type === "text").map((c) => c.text).join("\n") });
    return r;
  };
  await call("screenshot");
  await call("click_text", { text: "About" });
  await call("page_signals");
  await call("navigate", { url: "/contact.html" });
  await call("fill", { field: "Your name", value: "QA Test" });
  await call("page_text");
  await call("navigate", { url: "https://evil.example.com/" });
  await call("report_issue", {
    title: "Contact form gives no feedback after Send",
    severity: "medium",
    category: "ux",
    description: "Submitting the contact form does nothing visible.",
    steps_to_reproduce: ["Open /contact.html", "Fill in the name", "Click Send"],
    expected: "A confirmation or validation message",
    actual: "Nothing happens",
  });
  await call("finish", { summary: "Explored home, about and contact.", journeys_covered: ["Contact the company"], coverage_gaps: ["Checkout"] });
  await client.close();
  record({ kind: "explore", args, prompt, tools, calls });
  done(undefined);
} else {
  record({ kind: "unknown", args });
  done(undefined);
}
