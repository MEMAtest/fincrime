import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const log = {
  verbose: false,
  quiet: false,
  info(msg: string) {
    if (!this.quiet) process.stderr.write(`  ${msg}\n`);
  },
  step(msg: string) {
    if (!this.quiet) process.stderr.write(`\n▶ ${msg}\n`);
  },
  warn(msg: string) {
    process.stderr.write(`  ⚠ ${msg}\n`);
  },
  debug(msg: string) {
    if (this.verbose) process.stderr.write(`  · ${msg}\n`);
  },
};

/** Root of the qabot package itself (so we can skip it when it lives inside a target repo). */
export const SELF_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function hash(input: string, len = 10): string {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, len);
}

export function slugify(input: string, max = 60): string {
  const s = input
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/[?#].*$/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const base = s || "home";
  return base.length > max ? `${base.slice(0, max - 11)}-${hash(base, 10)}` : base;
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function tailLines(s: string, n: number): string {
  const lines = s.split(/\r?\n/);
  return lines.slice(Math.max(0, lines.length - n)).join("\n");
}

/** Strip ANSI colour codes from process output. */
export function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "");
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function freePort(preferred?: number): Promise<number> {
  const tryPort = (port: number) =>
    new Promise<number>((resolve, reject) => {
      const srv = net.createServer();
      srv.unref();
      srv.on("error", reject);
      srv.listen(port, () => {
        const addr = srv.address();
        const p = typeof addr === "object" && addr ? addr.port : port;
        srv.close(() => resolve(p));
      });
    });
  if (preferred) {
    try {
      return await tryPort(preferred);
    } catch {
      /* fall through to a random port */
    }
  }
  return tryPort(0);
}

export interface CommandResult {
  code: number | null;
  output: string;
  durationMs: number;
  timedOut: boolean;
}

/** Run a shell command, capturing combined output (tail-capped) with a hard timeout. */
export function runCommand(
  command: string,
  opts: { cwd: string; env?: Record<string, string | undefined>; timeoutMs?: number; maxOutput?: number },
): Promise<CommandResult> {
  const started = Date.now();
  const maxOutput = opts.maxOutput ?? 200_000;
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: opts.cwd,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", ...opts.env },
      shell: true,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let timedOut = false;
    const onData = (d: Buffer) => {
      output += d.toString();
      if (output.length > maxOutput * 2) output = output.slice(-maxOutput);
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          killTree(child.pid);
        }, opts.timeoutMs)
      : undefined;
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code, output: stripAnsi(output.slice(-maxOutput)), durationMs: Date.now() - started, timedOut });
    });
    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      resolve({ code: -1, output: String(err), durationMs: Date.now() - started, timedOut });
    });
  });
}

export function killTree(pid: number | undefined, signal: NodeJS.Signals = "SIGTERM") {
  if (!pid) return;
  try {
    if (process.platform === "win32") process.kill(pid, signal);
    else process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      /* already gone */
    }
  }
}

export const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".nuxt",
  ".output",
  ".svelte-kit",
  ".astro",
  ".vercel",
  ".netlify",
  ".turbo",
  ".cache",
  ".parcel-cache",
  "dist",
  "build",
  "out",
  "coverage",
  ".venv",
  "venv",
  "env",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  "vendor",
  "qabot-report",
  ".qabot",
]);

/** Recursively list files under root, skipping build output, dependencies and qabot itself. */
export function walkFiles(root: string, opts: { exts?: string[]; maxFiles?: number; ignore?: string[] } = {}): string[] {
  const out: string[] = [];
  const maxFiles = opts.maxFiles ?? 20_000;
  const extra = (opts.ignore ?? []).map((p) => path.resolve(root, p));
  const self = path.resolve(SELF_ROOT);
  const visit = (dir: string) => {
    if (out.length >= maxFiles) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= maxFiles) return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (IGNORED_DIRS.has(e.name)) continue;
        if (full === self || extra.includes(full)) continue;
        visit(full);
      } else if (e.isFile()) {
        if (!opts.exts || opts.exts.some((x) => e.name.endsWith(x))) out.push(full);
      }
    }
  };
  visit(root);
  return out;
}

export function readText(file: string, maxBytes = 2_000_000): string | undefined {
  try {
    const st = fs.statSync(file);
    if (st.size > maxBytes) return undefined;
    return fs.readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}

export function readJson<T = unknown>(file: string): T | undefined {
  const t = readText(file);
  if (t === undefined) return undefined;
  try {
    return JSON.parse(t) as T;
  } catch {
    return undefined;
  }
}

/** Replace ${VAR} references with environment values. */
export function interpolateEnv(value: string): string {
  return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name: string) => process.env[name] ?? "");
}

/** Minimal glob: `*` matches within a segment, `**` across segments. */
export function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*");
  return new RegExp(`^${escaped}$`);
}

export function matchesAny(value: string, globs: string[]): boolean {
  return globs.some((g) => globToRegExp(g).test(value));
}

export function isLocalHost(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]" || h.endsWith(".localhost") || h === "0.0.0.0";
  } catch {
    return false;
  }
}

export function relPath(root: string | undefined, file: string | undefined): string | undefined {
  if (!file) return undefined;
  if (!root) return file;
  return path.relative(root, file).split(path.sep).join("/");
}

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export function formatMs(ms: number | undefined): string {
  if (ms === undefined || Number.isNaN(ms)) return "–";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}
