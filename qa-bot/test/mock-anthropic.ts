/**
 * A scripted stand-in for the Anthropic Messages API, so the AI plumbing (structured outputs,
 * the computer-use loop, tool results) can be tested offline and for free.
 * It validates the protocol invariants the real API enforces and records every request.
 */
import http from "node:http";

type Block = Record<string, unknown> & { type: string };
interface Msg {
  role: string;
  content: string | Block[];
}
interface Req {
  model: string;
  system?: { text: string }[];
  messages: Msg[];
  tools?: Block[];
  output_config?: { format?: unknown };
}

export interface MockServer {
  url: string;
  requests: Req[];
  violations: string[];
  close(): Promise<void>;
}

const EXPLORER_SCRIPT: (Block & { name: string; input: Record<string, unknown>; computer?: boolean })[][] = [
  [
    { type: "tool_use", name: "left_click", input: { coordinate: [200, 300] }, computer: true },
    { type: "tool_use", name: "type", input: { text: "hello" }, computer: true },
    { type: "tool_use", name: "key", input: { text: "ctrl+a" }, computer: true },
    { type: "tool_use", name: "scroll", input: { scroll_direction: "down", scroll_amount: 2 }, computer: true },
    { type: "tool_use", name: "screenshot", input: {}, computer: true },
  ],
  [
    { type: "tool_use", name: "navigate", input: { url: "/about.html" } },
    { type: "tool_use", name: "page_signals", input: {} },
  ],
  [
    { type: "tool_use", name: "zoom", input: { region: [0, 0, 400, 300] }, computer: true },
    { type: "tool_use", name: "page_text", input: {} },
  ],
  [
    {
      type: "tool_use",
      name: "report_issue",
      input: {
        title: "Last updated date shows 'Invalid Date' on About page",
        severity: "medium",
        category: "content",
        description: "The About page renders Invalid Date where the last-updated date should be.",
        steps_to_reproduce: ["Open /about.html", "Read the 'Last updated' line"],
        expected: "A formatted date",
        actual: "Invalid Date",
      },
    },
  ],
  [{ type: "tool_use", name: "finish", input: { summary: "Tested home and about pages.", journeys_covered: ["Browse marketing pages"], coverage_gaps: ["Checkout"] } }],
];

function usage() {
  return { input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: 800, cache_creation_input_tokens: 0 };
}

function reply(model: string, content: Block[], stop: string) {
  return { id: `msg_${Math.random().toString(36).slice(2)}`, type: "message", role: "assistant", model, content, stop_reason: stop, stop_sequence: null, usage: usage() };
}

export function startMockAnthropic(): Promise<MockServer> {
  const requests: Req[] = [];
  const violations: string[] = [];
  let idCounter = 0;

  const handle = (req: Req) => {
    requests.push(req);
    const system = (req.system ?? []).map((s) => s.text).join("\n");
    // Protocol checks the real API would enforce.
    const msgs = req.messages;
    if (msgs[0]?.role !== "user") violations.push("first message is not from the user");
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (m.role !== "assistant" || typeof m.content === "string") continue;
      const uses = m.content.filter((b) => b.type === "tool_use");
      if (!uses.length) continue;
      const next = msgs[i + 1];
      if (!next || typeof next.content === "string") {
        if (next) violations.push(`tool_use at message ${i} not followed by tool results`);
        continue;
      }
      const results = next.content.filter((b) => b.type === "tool_result");
      for (const u of uses) {
        const r = results.find((x) => x.tool_use_id === u.id);
        if (!r) violations.push(`missing tool_result for ${u.name} (${u.id})`);
        else if (u.toolset_name === "computer" && r.toolset_name !== "computer") violations.push(`tool_result for computer member ${u.name} lacks toolset_name`);
        else if ((u.name === "screenshot" || u.name === "zoom") && !JSON.stringify(r.content).includes('"type":"image"')) violations.push(`${u.name} result has no image`);
      }
      const firstNonResult = next.content.findIndex((b) => b.type !== "tool_result");
      if (firstNonResult !== -1 && next.content.slice(firstNonResult).some((b) => b.type === "tool_result")) violations.push("text placed before tool_result blocks");
    }

    if (req.output_config?.format && /QA lead signing off/.test(system)) {
      const text = JSON.stringify({
        executive_summary: "Mock triage: the site has broken links and a JavaScript error on the primary CTA.",
        release_recommendation: "ship_with_fixes",
        top_priorities: [{ title: "Fix the Get started button", why_it_matters: "Primary CTA throws", finding_ids: ["nope"], suggested_fix: "Initialise the cart", likely_files: ["index.html"] }],
        likely_false_positives: [],
        missing_coverage: ["Authenticated pages"],
      });
      return reply(req.model, [{ type: "text", text }], "end_turn");
    }
    if (req.output_config?.format) {
      const text = JSON.stringify({
        page_purpose: "Marketing page",
        overall_score: 61,
        strengths: ["Clear headline"],
        findings: [
          {
            title: "Hero image area renders as a broken placeholder",
            severity: "high",
            category: "visual",
            viewport: "both",
            location: "hero, below the headline",
            evidence: "A broken image icon sits under the headline.",
            recommendation: "Ship the hero asset or remove the element.",
          },
        ],
      });
      return reply(req.model, [{ type: "text", text }], "end_turn");
    }
    // Explorer: which scripted turn are we on? Count assistant messages so far.
    const turn = msgs.filter((m) => m.role === "assistant").length;
    const script = EXPLORER_SCRIPT[turn];
    if (!script) return reply(req.model, [{ type: "text", text: "Done." }], "end_turn");
    const content: Block[] = [{ type: "text", text: `Turn ${turn + 1}` }];
    for (const s of script) {
      const { computer, ...rest } = s;
      content.push({ ...rest, id: `toolu_${++idCounter}`, ...(computer ? { toolset_name: "computer" } : {}) });
    }
    return reply(req.model, content, "tool_use");
  };

  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      if (!req.url?.startsWith("/v1/messages")) {
        res.writeHead(404).end();
        return;
      }
      try {
        const out = handle(JSON.parse(body));
        res.writeHead(200, { "content-type": "application/json", "request-id": "req_mock" }).end(JSON.stringify(out));
      } catch (e) {
        res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: String(e) } }));
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ url: `http://127.0.0.1:${port}`, requests, violations, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}
