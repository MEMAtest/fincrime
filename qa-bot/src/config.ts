import fs from "node:fs";
import path from "node:path";
import type { EndpointSpec, Severity, ViewportName } from "./types.js";
import { readJson } from "./util.js";

export type AuthStep =
  | { goto: string }
  | { fill: [selector: string, value: string] }
  | { click: string }
  | { press: [selector: string, key: string] }
  | { waitForUrl: string }
  | { waitForSelector: string };

export interface SetupRequest {
  method?: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** env var name → dot path into the JSON response, e.g. { "QA_TOKEN": "data.token" } */
  capture?: Record<string, string>;
}

export interface QaConfig {
  name?: string;
  /** Test an already-running app instead of launching one from the repo. */
  baseUrl?: string;
  start: {
    command?: string;
    cwd?: string;
    port?: number;
    readyPath: string;
    env: Record<string, string>;
    timeoutSec: number;
    install: boolean;
  };
  mode: "dev" | "prod";
  routes: {
    include: string[];
    exclude: string[];
    /** Values for dynamic segments, e.g. { "id": "123", "slug": "hello" }. */
    params: Record<string, string>;
  };
  maxPages: number;
  concurrency: number;
  viewports: ViewportName[];
  /** Extra headers sent on same-origin requests only (never leaked to third parties). */
  headers: Record<string, string>;
  auth?: { storageState?: string; steps?: AuthStep[] };
  /**
   * HTTP calls made once the app is up, e.g. to mint a test session or workspace. Values captured from
   * the JSON response become environment variables, usable as ${NAME} in headers and auth steps.
   */
  setup: SetupRequest[];
  /** Natural-language user journeys for the AI explorer. */
  journeys: string[];
  api: { enabled: boolean; endpoints: EndpointSpec[] };
  /** undefined = auto: true for localhost targets, false for remote ones. */
  allowMutations?: boolean;
  checks: {
    a11y: boolean;
    layout: boolean;
    keyboard: boolean;
    interactions: boolean;
    forms: boolean;
    security: boolean;
    seo: boolean;
    perf: boolean;
    links: boolean;
    externalLinks: boolean;
    visual: boolean;
  };
  /** Rule ids (glob) or title substrings to suppress. */
  ignore: string[];
  ai: {
    enabled: boolean;
    /** auto = Claude Code if the `claude` CLI is installed (no API key), else the API if a key is set. */
    provider: "auto" | "claude-code" | "api";
    /** Empty = backend default: "sonnet" for Claude Code, claude-sonnet-5 for the API. */
    model: string;
    effort: "low" | "medium" | "high" | "xhigh" | "max";
    uxReviewPages: number;
    explorer: boolean;
    explorerSteps: number;
    triage: boolean;
  };
  code: {
    enabled: boolean;
    commands: string[];
    runScripts: boolean;
    audit: boolean;
    secrets: boolean;
    timeoutSec: number;
  };
  visual: { baselineDir?: string; threshold: number; update: boolean };
  failOn: Severity | "none";
  out?: string;
  headed: boolean;
  ignorePaths: string[];
}

export function defaultConfig(): QaConfig {
  return {
    start: { readyPath: "/", env: {}, timeoutSec: 240, install: true },
    mode: "dev",
    routes: { include: [], exclude: [], params: {} },
    maxPages: 40,
    concurrency: 3,
    viewports: ["desktop", "tablet", "mobile"],
    headers: {},
    setup: [],
    journeys: [],
    api: { enabled: true, endpoints: [] },
    checks: {
      a11y: true,
      layout: true,
      keyboard: true,
      interactions: true,
      forms: true,
      security: true,
      seo: true,
      perf: true,
      links: true,
      externalLinks: true,
      visual: true,
    },
    ignore: [],
    ai: {
      enabled: true,
      provider: "auto",
      model: "",
      effort: "high",
      uxReviewPages: 6,
      explorer: true,
      explorerSteps: 40,
      triage: true,
    },
    code: { enabled: true, commands: [], runScripts: true, audit: true, secrets: true, timeoutSec: 600 },
    visual: { threshold: 0.01, update: false },
    failOn: "high",
    headed: false,
    ignorePaths: [],
  };
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function mergeConfig<T>(base: T, override: DeepPartial<T> | undefined): T {
  if (!override) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
    if (v === undefined) continue;
    const cur = out[k];
    out[k] = isPlainObject(cur) && isPlainObject(v) ? mergeConfig(cur, v as DeepPartial<typeof cur>) : v;
  }
  return out as T;
}

export const CONFIG_FILES = ["qabot.config.json", ".qabot/config.json"];

export function findConfigFile(dir: string): string | undefined {
  for (const name of CONFIG_FILES) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

export function loadConfig(explicitPath: string | undefined, repoDir: string | undefined): { config: QaConfig; file?: string } {
  const file = explicitPath ? path.resolve(explicitPath) : repoDir ? findConfigFile(repoDir) : findConfigFile(process.cwd());
  let config = defaultConfig();
  if (file) {
    const raw = readJson<DeepPartial<QaConfig>>(file);
    if (!raw) throw new Error(`Could not parse config file ${file} (must be valid JSON)`);
    config = mergeConfig(config, raw);
  }
  return { config, file };
}

export { type DeepPartial };
