import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { QaConfig } from "../config.js";
import type { FindingSink } from "../findings.js";
import type { CodeCheckResult, Severity, StackInfo } from "../types.js";
import { log, readText, runCommand, SELF_ROOT, tailLines, truncate, walkFiles } from "../util.js";
import { runScript } from "../target/detect.js";

interface PlannedCheck {
  name: string;
  command: string;
  kind: "lint" | "typecheck" | "test" | "build" | "custom";
}

const NPM_DEFAULT_TEST = /no test specified/;

export function planCodeChecks(repo: string, stack: StackInfo, cfg: QaConfig): PlannedCheck[] {
  const plan: PlannedCheck[] = cfg.code.commands.map((c) => ({ name: c, command: c, kind: "custom" as const }));
  if (!cfg.code.runScripts) return plan;
  const s = stack.scripts;
  const pm = stack.packageManager;
  if (stack.kind === "node" || Object.keys(s).length) {
    const lint = ["lint", "eslint"].find((n) => n in s);
    if (lint) plan.push({ name: "Lint", command: runScript(pm, lint), kind: "lint" });
    const tc = ["typecheck", "type-check", "check-types", "types", "tsc", "check"].find((n) => n in s);
    if (tc) plan.push({ name: "Type check", command: runScript(pm, tc), kind: "typecheck" });
    else if (fs.existsSync(path.join(repo, "tsconfig.json")) && fs.existsSync(path.join(repo, "node_modules/typescript"))) {
      plan.push({ name: "Type check", command: "npx --no-install tsc --noEmit -p tsconfig.json", kind: "typecheck" });
    }
    if ("test" in s && !NPM_DEFAULT_TEST.test(s.test)) plan.push({ name: "Unit tests", command: runScript(pm, "test"), kind: "test" });
  }
  if (stack.kind === "python") {
    const hasTests = fs.existsSync(path.join(repo, "tests")) || walkFiles(repo, { exts: ["_test.py"], maxFiles: 1 }).length > 0 || walkFiles(repo, { exts: [".py"], maxFiles: 2000 }).some((f) => path.basename(f).startsWith("test_"));
    if (hasTests) plan.push({ name: "Unit tests", command: "python -m pytest -q", kind: "test" });
  }
  return plan;
}

const KIND_SEVERITY: Record<PlannedCheck["kind"], Severity> = { lint: "medium", typecheck: "high", test: "high", build: "critical", custom: "high" };

function filesInOutput(out: string, repo: string): string[] {
  const files = new Set<string>();
  for (const m of out.matchAll(/((?:[\w@.-]+\/)*[\w@.-]+\.(?:tsx?|jsx?|mjs|cjs|py|vue|svelte))[:(](\d+)/g)) {
    const f = m[1].replace(/^\.\//, "");
    if (f.includes("node_modules")) continue;
    if (fs.existsSync(path.join(repo, f))) files.add(`${f}:${m[2]}`);
    if (files.size >= 8) break;
  }
  return [...files];
}

export async function runCodeChecks(repo: string, stack: StackInfo, cfg: QaConfig, sink: FindingSink): Promise<CodeCheckResult[]> {
  const results: CodeCheckResult[] = [];
  for (const check of planCodeChecks(repo, stack, cfg)) {
    log.info(`Running ${check.name}: ${check.command}`);
    const r = await runCommand(check.command, { cwd: repo, env: { CI: "true" }, timeoutMs: cfg.code.timeoutSec * 1000 });
    const status: CodeCheckResult["status"] = r.timedOut ? "error" : r.code === 0 ? "pass" : "fail";
    const outputTail = tailLines(r.output.trim(), 60);
    results.push({ name: check.name, command: check.command, status, durationMs: r.durationMs, outputTail });
    log.info(`  ${status === "pass" ? "✓" : "✗"} ${check.name} ${status} (${(r.durationMs / 1000).toFixed(1)}s)`);
    if (status !== "pass") {
      sink.add({
        ruleId: `code-${check.kind}`,
        key: check.command,
        title: r.timedOut ? `${check.name} timed out after ${cfg.code.timeoutSec}s` : `${check.name} is failing (${check.command})`,
        severity: r.timedOut ? "medium" : KIND_SEVERITY[check.kind],
        category: "code",
        description: `\`${check.command}\` exited with code ${r.code}.\n\n${truncate(tailLines(r.output.trim(), 40), 3500)}`,
        recommendation:
          check.kind === "test"
            ? "Fix the failing tests before shipping; a red suite hides new regressions."
            : check.kind === "typecheck"
              ? "Type errors often point at real runtime bugs (undefined access, wrong shapes). Fix them."
              : "Fix the reported problems or adjust the rule if it is intentionally violated.",
        source: "code",
        files: filesInOutput(r.output, repo),
      });
    }
  }
  if (cfg.code.audit && stack.kind === "node" && fs.existsSync(path.join(repo, "package-lock.json"))) {
    results.push(await npmAudit(repo, sink));
  }
  if (cfg.code.secrets) results.push(scanSecrets(repo, sink, cfg.ignorePaths));
  return results;
}

interface AuditJson {
  vulnerabilities?: Record<string, { severity: string; via: (string | { title?: string; url?: string })[]; fixAvailable?: unknown }>;
  metadata?: { vulnerabilities?: Record<string, number> };
}

async function npmAudit(repo: string, sink: FindingSink): Promise<CodeCheckResult> {
  const command = "npm audit --omit=dev --json";
  log.info(`Running dependency audit: ${command}`);
  const r = await runCommand(command, { cwd: repo, timeoutMs: 120_000 });
  let parsed: AuditJson | undefined;
  try {
    parsed = JSON.parse(r.output.slice(r.output.indexOf("{")));
  } catch {
    return { name: "Dependency audit", command, status: "error", durationMs: r.durationMs, outputTail: tailLines(r.output, 20) };
  }
  const vulns = Object.entries(parsed?.vulnerabilities ?? {});
  const map: Record<string, Severity> = { critical: "critical", high: "high", moderate: "medium", low: "low", info: "info" };
  for (const [name, v] of vulns) {
    const advisories = v.via.filter((x): x is { title?: string; url?: string } => typeof x === "object");
    if (!advisories.length) continue; // transitive: reported under the package that has the advisory
    sink.add({
      ruleId: "dep-vulnerability",
      key: name,
      title: `Vulnerable dependency: ${name} (${v.severity})`,
      severity: map[v.severity] ?? "low",
      category: "security",
      description: advisories
        .slice(0, 3)
        .map((a) => `${a.title ?? "advisory"}${a.url ? ` (${a.url})` : ""}`)
        .join("\n"),
      recommendation: v.fixAvailable ? "Run `npm audit fix` (or bump the package) and re-test." : "No automatic fix yet: check for a patched major version or an alternative package.",
      source: "code",
      files: ["package.json"],
    });
  }
  const counts = parsed?.metadata?.vulnerabilities ?? {};
  const summary = Object.entries(counts)
    .filter(([k, n]) => k !== "total" && n)
    .map(([k, n]) => `${n} ${k}`)
    .join(", ");
  return { name: "Dependency audit", command, status: vulns.length ? "fail" : "pass", durationMs: r.durationMs, outputTail: summary || "no known vulnerabilities" };
}

const SECRET_PATTERNS: { name: string; re: RegExp; severity: Severity }[] = [
  { name: "Private key", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/, severity: "critical" },
  { name: "AWS access key", re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/, severity: "critical" },
  { name: "Anthropic API key", re: /\bsk-ant-[a-zA-Z0-9_-]{20,}/, severity: "critical" },
  { name: "OpenAI API key", re: /\bsk-(?:proj-)?[a-zA-Z0-9]{32,}/, severity: "critical" },
  { name: "Groq API key", re: /\bgsk_[a-zA-Z0-9]{32,}/, severity: "critical" },
  { name: "Stripe live key", re: /\b(sk|rk)_live_[0-9a-zA-Z]{20,}/, severity: "critical" },
  { name: "GitHub token", re: /\b(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{30,}/, severity: "critical" },
  { name: "Slack token", re: /\bxox[baprs]-[0-9A-Za-z-]{10,}/, severity: "high" },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/, severity: "high" },
  { name: "Database URL with password", re: /\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^:\s/'"]+:[^@\s'"]{4,}@[^\s'"]+/, severity: "high" },
  {
    name: "Hard-coded secret",
    re: /\b(?:api[_-]?key|secret|client[_-]?secret|auth[_-]?token|access[_-]?token|password|passwd)\b\s*[:=]\s*["'`](?!\$\{|<|your|xxx|changeme|example|placeholder|test|dummy)[A-Za-z0-9_\-+/=.]{16,}["'`]/i,
    severity: "high",
  },
];

/** Placeholder credentials in docs/comments: user:pass, <user>:<pw>, ${VAR}, ***, changeme… */
const PLACEHOLDER = /^(?:pass(?:word)?|pw|pwd|secret|changeme|example|placeholder|dummy|test|xxx+|\*+|<[^>]*>|\$\{?\w+\}?.*|\.\.\.|your[-_]?\w*)$/i;

export function isPlaceholderSecret(match: string): boolean {
  const db = match.match(/:\/\/([^:\s/'"]+):([^@\s'"]+)@/);
  if (db) return PLACEHOLDER.test(db[2]) || /^[<$]/.test(db[1]) || /[<>]|\$\{/.test(db[2]);
  const quoted = match.match(/["'`]([^"'`]+)["'`]$/);
  return !!quoted && (PLACEHOLDER.test(quoted[1]) || /^(x+|0+|1234\w*)$/i.test(quoted[1]));
}

const SKIP_FILE = /(\.lock$|package-lock\.json$|yarn\.lock$|pnpm-lock\.yaml$|\.min\.(js|css)$|\.map$|\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|zip|gz|mp4|svg)$)/i;
const LOW_RISK_FILE = /(example|sample|fixture|mock|test|spec|\.md$)/i;

function trackedFiles(repo: string, ignore: string[]): string[] {
  const gitDir = path.join(repo, ".git");
  if (fs.existsSync(gitDir)) {
    try {
      const out = execFileSync("git", ["ls-files", "-z"], { cwd: repo, maxBuffer: 64 * 1024 * 1024 }).toString();
      const self = path.relative(repo, SELF_ROOT);
      return out
        .split("\0")
        .filter(Boolean)
        .filter((f) => !(self && !self.startsWith("..") && f.startsWith(self + "/")))
        .filter((f) => !ignore.some((i) => f.startsWith(i)))
        .map((f) => path.join(repo, f));
    } catch {
      /* fall back to walking */
    }
  }
  return walkFiles(repo, { maxFiles: 10_000, ignore });
}

export function scanSecrets(repo: string, sink: FindingSink, ignore: string[] = []): CodeCheckResult {
  const started = Date.now();
  const files = trackedFiles(repo, ignore).filter((f) => !SKIP_FILE.test(f));
  let hits = 0;
  for (const file of files) {
    const rel = path.relative(repo, file).split(path.sep).join("/");
    if (/(^|\/)\.env(\.[\w-]+)?$/.test(rel) && !/example|sample|template/i.test(rel)) {
      hits++;
      sink.add({
        ruleId: "secret-env-committed",
        key: rel,
        title: `Environment file is committed to git: ${rel}`,
        severity: "high",
        category: "security",
        description: `${rel} is tracked in the repository. Env files usually hold credentials; anyone with repo access (or its history) can read them.`,
        recommendation: "Remove it from git (git rm --cached), rotate every secret it contained, and add it to .gitignore.",
        source: "code",
        files: [rel],
      });
    }
    const text = readText(file, 1_000_000);
    if (!text || text.includes("\u0000")) continue;
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 2000) continue;
      for (const p of SECRET_PATTERNS) {
        const m = line.match(p.re);
        if (!m || isPlaceholderSecret(m[0])) continue;
        hits++;
        const masked = m[0].length > 12 ? `${m[0].slice(0, 6)}…${m[0].slice(-3)}` : "…";
        const lowRisk = LOW_RISK_FILE.test(rel);
        sink.add({
          ruleId: "secret-in-code",
          key: `${rel}:${i + 1}:${p.name}`,
          title: `${p.name} committed in ${rel}:${i + 1}`,
          severity: lowRisk ? "low" : p.severity,
          category: "security",
          description: `Line ${i + 1} of ${rel} looks like a ${p.name.toLowerCase()} (${masked}).${lowRisk ? " The file looks like an example/test fixture: confirm the value is fake." : ""}`,
          recommendation: "Move the value to an environment variable / secret manager and rotate the credential: it is in git history now.",
          source: "code",
          files: [`${rel}:${i + 1}`],
        });
        break;
      }
    }
  }
  return {
    name: "Secret scan",
    command: `scan ${files.length} tracked files`,
    status: hits ? "fail" : "pass",
    durationMs: Date.now() - started,
    outputTail: hits ? `${hits} potential secret(s) found` : "no secrets found",
  };
}
