import type { FindingSink } from "../findings.js";
import type { ApiProbeResult, EndpointSpec } from "../types.js";
import { interpolateEnv, log, mapLimit, truncate } from "../util.js";

/** Response bodies that leak internals: stack traces, SQL errors, file paths, framework debug pages. */
const LEAK_PATTERNS: [RegExp, string][] = [
  [/\bat\s+[\w$.<>]+\s+\((?:\/|[A-Z]:\\|file:|webpack|node:)[^)]*:\d+:\d+\)/, "JavaScript stack trace"],
  [/Traceback \(most recent call last\)/, "Python traceback"],
  [/(SQLSTATE|syntax error at or near|relation "[^"]+" does not exist|\bER_(?:DUP|BAD|NO|PARSE|ACCESS)_[A-Z_]+\b|SQLITE_ERROR|duplicate key value violates|invalid input syntax for type)/, "database error"],
  [/(\/home\/|\/Users\/|\/var\/www\/|\/app\/node_modules\/|C:\\Users\\)/, "server file path"],
  [/(ECONNREFUSED|ETIMEDOUT|ENOTFOUND)\s+[\d.:a-z-]+/i, "internal network address"],
  [/<title>(?:Error|Exception)[^<]*<\/title>[\s\S]*(Werkzeug|Django|Laravel|Whoops)/i, "framework debug page"],
];

export function detectLeak(body: string): string | undefined {
  for (const [re, label] of LEAK_PATTERNS) if (re.test(body)) return label;
  return undefined;
}

interface Probe {
  name: string;
  method: string;
  body?: string;
  contentType?: string;
  mutating: boolean;
}

function probesFor(e: EndpointSpec, allowMutations: boolean): Probe[] {
  const methods = e.method === "ANY" ? ["GET", "POST"] : [e.method];
  const out: Probe[] = [];
  for (const m of methods) {
    if (m === "GET" || m === "HEAD") out.push({ name: `${m} (no params)`, method: m, mutating: false });
    else if (m === "OPTIONS") continue;
    else if (allowMutations) {
      out.push({ name: "malformed JSON", method: m, body: '{"qabot": ', contentType: "application/json", mutating: true });
      out.push({ name: "empty object", method: m, body: "{}", contentType: "application/json", mutating: true });
      out.push({ name: "wrong types", method: m, body: '{"id":[],"email":{},"name":null,"amount":"NaN"}', contentType: "application/json", mutating: true });
    } else {
      out.push({ name: `${m} (skipped: safe mode)`, method: m, mutating: true });
    }
  }
  return out;
}

export async function probeApis(opts: {
  baseUrl: string;
  endpoints: EndpointSpec[];
  sink: FindingSink;
  headers: Record<string, string>;
  allowMutations: boolean;
  isDevServer: boolean;
  repoRelative: (f?: string) => string | undefined;
}): Promise<ApiProbeResult[]> {
  const results: ApiProbeResult[] = [];
  const headers = Object.fromEntries(Object.entries(opts.headers).map(([k, v]) => [k, interpolateEnv(v)]));
  const origin = new URL(opts.baseUrl).origin;
  const tasks = opts.endpoints.flatMap((e) => probesFor(e, opts.allowMutations).map((p) => ({ e, p })));
  let corsChecked = false;

  await mapLimit(tasks, 4, async ({ e, p }) => {
    const file = opts.repoRelative(e.file);
    const row: ApiProbeResult = { method: p.method, path: e.path, probe: p.name, verdict: "ok", sourceFile: file };
    if (p.mutating && !opts.allowMutations) {
      row.verdict = "skipped";
      row.note = "Mutating requests are off for non-local targets (use --allow-mutations on a staging copy)";
      results.push(row);
      return;
    }
    const started = Date.now();
    try {
      const res = await fetch(origin + e.path, {
        method: p.method,
        headers: { ...headers, ...(p.contentType ? { "content-type": p.contentType } : {}), accept: "application/json, */*" },
        body: p.body,
        redirect: "manual",
        signal: AbortSignal.timeout(60_000),
      });
      row.status = res.status;
      row.durationMs = Date.now() - started;
      const body = p.method === "HEAD" ? "" : (await res.text()).slice(0, 20_000);
      const json = /json/.test(res.headers.get("content-type") ?? "");
      // Leaks matter in error responses and API payloads; HTML pages legitimately contain paths in dev builds.
      const leak = res.status >= 400 || json ? detectLeak(body) : undefined;
      const where = { url: origin + e.path, detail: `${p.method} ${e.path} [${p.name}] → ${res.status}` };
      if (res.status >= 500) {
        row.verdict = "bug";
        const malformed = p.name === "malformed JSON";
        opts.sink.add({
          ruleId: malformed ? "api-5xx-malformed-json" : p.mutating ? "api-5xx-bad-input" : "api-5xx",
          key: `${p.method} ${e.path}`,
          title: malformed
            ? `API answers malformed JSON with ${res.status} instead of 400: ${p.method} ${e.path}`
            : p.mutating
              ? `API crashes on invalid input: ${p.method} ${e.path} → ${res.status} (${p.name})`
              : `API endpoint returns a server error: ${p.method} ${e.path} → ${res.status}`,
          // An unparseable body reported as a server error is a real bug, but a contained one.
          severity: malformed ? "medium" : "high",
          category: "backend",
          description:
            (p.mutating
              ? `Sending ${p.name} (${truncate(p.body ?? "", 60)}) produced HTTP ${res.status}. Bad input should get a 4xx with a helpful message, not an unhandled error.`
              : `A plain ${p.method} with no parameters produced HTTP ${res.status}.`) +
            (body ? `\n\nResponse: ${truncate(body.trim(), 500)}` : ""),
          recommendation: p.mutating
            ? "Validate the request body (schema validation such as zod) and return 400 on failure; wrap the handler in error handling."
            : "Look at the server log for this request; missing params should yield 400/404, never 500.",
          source: "api",
          occurrence: where,
          files: file ? [file] : undefined,
          steps: [`curl -X ${p.method} ${origin}${e.path}${p.body ? ` -H 'content-type: application/json' -d '${p.body}'` : ""}`],
        });
      } else if (res.status === 401 || res.status === 403) {
        row.verdict = "auth";
      }
      if (leak) {
        row.verdict = "bug";
        opts.sink.add({
          ruleId: "api-error-leak",
          key: `${e.path}|${leak}`,
          title: `API response leaks internals (${leak}): ${p.method} ${e.path}`,
          severity: opts.isDevServer ? "low" : "high",
          category: "security",
          description:
            `The response body contains a ${leak}, which exposes implementation details to anyone calling the API.` +
            (opts.isDevServer ? " (Seen on a development server, which shows detailed errors by design: confirm against a production build.)" : "") +
            `\n\n${truncate(body.trim(), 600)}`,
          recommendation: "Return generic error messages to clients and log the details server-side only.",
          source: "api",
          occurrence: where,
          files: file ? [file] : undefined,
        });
      }
      if (!opts.isDevServer && row.durationMs > 3000 && res.status < 500) {
        row.verdict = row.verdict === "ok" ? "warn" : row.verdict;
        opts.sink.add({
          ruleId: "api-slow",
          key: `${p.method} ${e.path}`,
          title: `Slow API response: ${p.method} ${e.path} took ${(row.durationMs / 1000).toFixed(1)}s`,
          severity: row.durationMs > 8000 ? "medium" : "low",
          category: "performance",
          description: `The endpoint took ${row.durationMs}ms to answer a trivial request.`,
          source: "api",
          occurrence: where,
          files: file ? [file] : undefined,
        });
      }
      if (!corsChecked && p.method === "GET" && res.status < 400) {
        corsChecked = true;
        await corsCheck(origin + e.path, headers, opts.sink);
      }
    } catch (err) {
      row.verdict = "error";
      row.durationMs = Date.now() - started;
      row.note = (err as Error).name === "TimeoutError" ? "timed out after 60s" : (err as Error).message;
      if ((err as Error).name === "TimeoutError") {
        opts.sink.add({
          ruleId: "api-timeout",
          key: `${p.method} ${e.path}`,
          title: `API request hangs: ${p.method} ${e.path} (no response in 60s)`,
          severity: "high",
          category: "backend",
          description: `${p.method} ${e.path} [${p.name}] never answered. Hanging requests tie up server workers and leave the UI spinning.`,
          source: "api",
          occurrence: { url: origin + e.path, detail: p.name },
          files: file ? [file] : undefined,
        });
      }
    }
    results.push(row);
    log.debug(`api ${row.method} ${row.path} [${row.probe}] → ${row.status ?? row.note}`);
  });
  return results.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method) || a.probe.localeCompare(b.probe));
}

async function corsCheck(url: string, headers: Record<string, string>, sink: FindingSink) {
  try {
    const evil = "https://qabot-evil.example";
    const r = await fetch(url, { headers: { ...headers, origin: evil }, signal: AbortSignal.timeout(20_000) });
    await r.body?.cancel().catch(() => {});
    const acao = r.headers.get("access-control-allow-origin");
    const acac = r.headers.get("access-control-allow-credentials") === "true";
    if (acao === evil || (acao === "*" && acac)) {
      sink.add({
        ruleId: "sec-cors",
        title: acao === evil ? "API reflects any Origin in CORS headers" : "CORS allows any origin with credentials",
        severity: acac ? "high" : "medium",
        category: "security",
        description: `A request with Origin: ${evil} got Access-Control-Allow-Origin: ${acao}${acac ? " and Allow-Credentials: true" : ""}. Any website can read these API responses${acac ? " using the visitor's cookies" : ""}.`,
        recommendation: "Allow-list trusted origins explicitly and never combine a reflected origin with credentials.",
        source: "api",
        occurrence: { url, detail: `ACAO ${acao}` },
      });
    }
  } catch {
    /* ignore */
  }
}
