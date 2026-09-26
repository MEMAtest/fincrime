import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { QaConfig } from "../config.js";
import type { StackInfo } from "../types.js";
import { freePort, killTree, log, runCommand, sleep, stripAnsi, tailLines } from "../util.js";
import { installCommand, runScript } from "./detect.js";
import { startStaticServer } from "./static-server.js";

export interface LaunchedApp {
  baseUrl: string;
  command: string;
  /** Server stdout/stderr captured while qabot was running. */
  logs(): string[];
  /** Mark the log position so later analysis only sees lines emitted during testing. */
  logCursor(): number;
  stop(): Promise<void>;
}

const MAX_LOG_LINES = 5000;

export async function launchApp(repo: string, stack: StackInfo, cfg: QaConfig): Promise<LaunchedApp> {
  const cwd = cfg.start.cwd ? path.resolve(repo, cfg.start.cwd) : repo;
  const port = await freePort(cfg.start.port ?? 4173);

  if (!cfg.start.command && stack.kind === "static") {
    const root = stack.staticRoot ?? repo;
    const srv = await startStaticServer(root, port);
    log.info(`Serving static files from ${path.relative(process.cwd(), root) || "."} on port ${port}`);
    return {
      baseUrl: `http://127.0.0.1:${port}`,
      command: "(built-in static server)",
      logs: () => [],
      logCursor: () => 0,
      stop: () => srv.close(),
    };
  }

  if (stack.kind === "node" && cfg.start.install && !fs.existsSync(path.join(cwd, "node_modules"))) {
    const cmd = installCommand(cwd, stack.packageManager);
    log.info(`Installing dependencies: ${cmd}`);
    const res = await runCommand(cmd, { cwd, timeoutMs: 15 * 60_000 });
    if (res.code !== 0) throw new Error(`Dependency install failed (${cmd}):\n${tailLines(res.output, 30)}`);
  }

  if (cfg.mode === "prod" && !cfg.start.command && stack.scripts.build) {
    const cmd = runScript(stack.packageManager, "build");
    log.info(`Building for production: ${cmd}`);
    const res = await runCommand(cmd, { cwd, env: { ...cfg.start.env, NEXT_TELEMETRY_DISABLED: "1" }, timeoutMs: 20 * 60_000 });
    if (res.code !== 0) {
      const err = new Error(`Production build failed (${cmd})`);
      (err as Error & { output?: string }).output = res.output;
      throw err;
    }
  }

  const command = cfg.start.command?.replace(/\$PORT|\{port\}/g, String(port)) ?? startCommandFor(stack, cfg.mode, port);
  if (!command) {
    throw new Error(
      `Don't know how to start this ${stack.framework} project. Add "start": { "command": "..." } to qabot.config.json, or pass --url for an already-running app.`,
    );
  }

  log.info(`Starting app: ${command}`);
  const lines: string[] = [];
  let dropped = 0;
  const child: ChildProcess = spawn(command, {
    cwd,
    shell: true,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      PORT: String(port),
      BROWSER: "none",
      NEXT_TELEMETRY_DISABLED: "1",
      FORCE_COLOR: "0",
      ...cfg.start.env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let exited: number | null | undefined;
  child.on("exit", (code) => {
    exited = code;
  });
  let announcedUrl: string | undefined;
  const onData = (d: Buffer) => {
    for (const raw of d.toString().split(/\r?\n/)) {
      const line = stripAnsi(raw);
      if (!line.trim()) continue;
      lines.push(line);
      if (lines.length > MAX_LOG_LINES) {
        lines.shift();
        dropped++;
      }
      log.debug(`[app] ${line}`);
      const m = line.match(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\]):(\d{2,5})/);
      if (m && !announcedUrl) announcedUrl = `http://localhost:${m[1]}`;
    }
  };
  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);

  const stop = async () => {
    if (exited !== undefined) return;
    killTree(child.pid, "SIGTERM");
    for (let i = 0; i < 50 && exited === undefined; i++) await sleep(100);
    if (exited === undefined) killTree(child.pid, "SIGKILL");
  };

  const deadline = Date.now() + cfg.start.timeoutSec * 1000;
  let baseUrl = `http://localhost:${port}`;
  while (true) {
    if (exited !== undefined) {
      throw new Error(`App exited with code ${exited} before it was ready.\n${tailLines(lines.join("\n"), 40)}`);
    }
    if (Date.now() > deadline) {
      await stop();
      throw new Error(`App did not respond within ${cfg.start.timeoutSec}s.\n${tailLines(lines.join("\n"), 40)}`);
    }
    for (const candidate of new Set([baseUrl, announcedUrl].filter(Boolean) as string[])) {
      if (await responds(candidate + cfg.start.readyPath)) {
        baseUrl = candidate;
        log.info(`App is up at ${baseUrl}`);
        return {
          baseUrl,
          command,
          logs: () => lines.slice(),
          logCursor: () => lines.length + dropped,
          stop,
        };
      }
    }
    await sleep(1000);
  }
}

async function responds(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000), redirect: "manual" });
    await res.body?.cancel();
    return true;
  } catch {
    return false;
  }
}

export function startCommandFor(stack: StackInfo, mode: "dev" | "prod", port: number): string | undefined {
  const s = stack.scripts;
  const pm = stack.packageManager;
  const has = (name: string) => name in s;
  if (stack.kind === "python") {
    if (stack.framework === "django") return `python manage.py runserver 127.0.0.1:${port} --noreload`;
    if (stack.framework === "flask") return `flask run --port ${port}`;
    if (stack.framework === "fastapi") return `uvicorn main:app --port ${port}`;
    return undefined;
  }
  if (stack.kind !== "node") return undefined;

  if (mode === "prod") {
    switch (stack.framework) {
      case "next":
        return has("start") ? runScript(pm, "start", `-p ${port}`) : `npx next start -p ${port}`;
      case "vite":
      case "sveltekit":
      case "astro":
        return has("preview") ? runScript(pm, "preview", `--port ${port}`) : undefined;
      case "nuxt":
        return `node .output/server/index.mjs`;
      default:
        return has("start") ? runScript(pm, "start") : undefined;
    }
  }

  switch (stack.framework) {
    case "next":
      return has("dev") ? runScript(pm, "dev", `-p ${port}`) : `npx next dev -p ${port}`;
    case "vite":
    case "sveltekit":
    case "astro":
    case "nuxt":
    case "remix":
      return has("dev") ? runScript(pm, "dev", `--port ${port}`) : undefined;
    case "angular":
      return has("start") ? runScript(pm, "start", `--port ${port}`) : `npx ng serve --port ${port}`;
    case "gatsby":
      return has("develop") ? runScript(pm, "develop", `-p ${port}`) : undefined;
    case "cra":
      return has("start") ? runScript(pm, "start") : undefined;
    default:
      if (has("dev")) return runScript(pm, "dev");
      if (has("start")) return runScript(pm, "start");
      if (has("serve")) return runScript(pm, "serve");
      return undefined;
  }
}

const SERVER_ERROR_RE =
  /(\bError\b[:\s]|\bException\b|Traceback \(most recent call last\)|Unhandled(Promise)?Rejection|\bECONNREFUSED\b|\bFATAL\b|⨯|\bPANIC\b|500 Internal Server Error)/;
const SERVER_NOISE_RE = /(Fast Refresh|webpack-hmr|DeprecationWarning|ExperimentalWarning|warn\s+-|Compiled|Compiling|✓ Ready|GET \/_next\/)/i;

/** Pull distinct server-side error blocks out of captured app logs. */
export function extractServerErrors(lines: string[]): { headline: string; excerpt: string }[] {
  const out = new Map<string, { headline: string; excerpt: string }>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!SERVER_ERROR_RE.test(line) || SERVER_NOISE_RE.test(line)) continue;
    const headline = line.trim().slice(0, 240);
    const key = headline.replace(/\d+/g, "#").replace(/\s+/g, " ");
    if (out.has(key)) continue;
    out.set(key, { headline, excerpt: lines.slice(i, i + 12).join("\n") });
    if (out.size >= 25) break;
  }
  return [...out.values()];
}
