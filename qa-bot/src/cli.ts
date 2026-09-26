#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { defaultConfig, findConfigFile, type DeepPartial, type QaConfig } from "./config.js";
import { discoverEndpoints } from "./discover/api.js";
import { discoverRoutes } from "./discover/routes.js";
import { run, summaryLine, VERSION } from "./run.js";
import { detectStack } from "./target/detect.js";
import type { Severity, ViewportName } from "./types.js";
import { log } from "./util.js";

const HELP = `qabot ${VERSION}: point it at any site or codebase and it hunts for bugs.

Usage
  qabot run <url | path> [options]     Full QA run (default command)
  qabot init [path]                    Write a starter qabot.config.json for a repo
  qabot discover [path]                Show the routes, API endpoints and start command qabot detects

Targets
  qabot run https://staging.example.com      Test a deployed site (safe mode: read-only)
  qabot run ~/code/my-app                    Launch the app from source, test it, check the code
  qabot run ~/code/my-app --url http://localhost:3000   Use your already-running dev server

Options
  -c, --config <file>        Config file (default: <repo>/qabot.config.json)
  -o, --out <dir>            Report directory (default: ./qabot-report/<timestamp>)
      --url <url>            Base URL of an already-running app (skips launching)
      --start <command>      Command that starts the app ($PORT is substituted)
      --mode <dev|prod>      Launch with the dev server (default) or build + start
      --max-pages <n>        Crawl limit (default 40)
      --viewports <list>     desktop,tablet,mobile (default: all three)
      --header <"K: V">      Extra header for same-origin requests (repeatable), e.g. auth
      --journey <text>       A user journey for the AI explorer to test (repeatable)
      --allow-mutations      Let probes and forms send POST/PUT/PATCH/DELETE (default only for localhost)
      --safe                 Force read-only mode even on localhost
      --fail-on <severity>   Exit 1 if any finding is at least this severe (default high; "none" to never fail)
      --update-baseline      Save screenshots as the new visual baseline
      --ignore <rule>        Suppress a rule id (glob) or title substring (repeatable)

  AI (needs ANTHROPIC_API_KEY)
      --no-ai                Deterministic checks only
      --model <id>           Claude model (default claude-opus-5)
      --effort <level>       low | medium | high | xhigh | max (default high)
      --ux-pages <n>         Pages to send to the AI UX review (default 6)
      --explore-steps <n>    Turn budget for the computer-use explorer (default 40; 0 disables)

  Scope
      --no-code --no-api --no-a11y --no-visual --no-keyboard --no-interactions --no-forms --no-external-links

      --headed               Show the browser
      --open                 Open the HTML report when done
      --json                 Print the JSON report to stdout
  -v, --verbose              Debug logging (includes app server output)
  -q, --quiet
  -h, --help
      --version
`;

function parse(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      config: { type: "string", short: "c" },
      out: { type: "string", short: "o" },
      url: { type: "string" },
      start: { type: "string" },
      mode: { type: "string" },
      "max-pages": { type: "string" },
      viewports: { type: "string" },
      header: { type: "string", multiple: true },
      journey: { type: "string", multiple: true },
      "allow-mutations": { type: "boolean" },
      safe: { type: "boolean" },
      "fail-on": { type: "string" },
      "update-baseline": { type: "boolean" },
      ignore: { type: "string", multiple: true },
      "no-ai": { type: "boolean" },
      model: { type: "string" },
      effort: { type: "string" },
      "ux-pages": { type: "string" },
      "explore-steps": { type: "string" },
      "no-code": { type: "boolean" },
      "no-api": { type: "boolean" },
      "no-a11y": { type: "boolean" },
      "no-visual": { type: "boolean" },
      "no-keyboard": { type: "boolean" },
      "no-interactions": { type: "boolean" },
      "no-forms": { type: "boolean" },
      "no-external-links": { type: "boolean" },
      headed: { type: "boolean" },
      open: { type: "boolean" },
      json: { type: "boolean" },
      verbose: { type: "boolean", short: "v" },
      quiet: { type: "boolean", short: "q" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean" },
    },
  });
}

type Values = ReturnType<typeof parse>["values"];

function int(v: string | undefined, name: string): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new Error(`--${name} must be a non-negative integer`);
  return n;
}

function toOverrides(v: Values): DeepPartial<QaConfig> {
  const o: DeepPartial<QaConfig> = {};
  const checks: DeepPartial<QaConfig["checks"]> = {};
  const ai: DeepPartial<QaConfig["ai"]> = {};
  const code: DeepPartial<QaConfig["code"]> = {};
  if (v.out) o.out = v.out;
  if (v.url) o.baseUrl = v.url;
  if (v.start) o.start = { command: v.start };
  if (v.mode) {
    if (v.mode !== "dev" && v.mode !== "prod") throw new Error("--mode must be dev or prod");
    o.mode = v.mode;
  }
  const maxPages = int(v["max-pages"], "max-pages");
  if (maxPages !== undefined) o.maxPages = maxPages;
  if (v.viewports) {
    const vps = v.viewports.split(",").map((s) => s.trim()) as ViewportName[];
    for (const vp of vps) if (!["desktop", "tablet", "mobile"].includes(vp)) throw new Error(`Unknown viewport ${vp}`);
    o.viewports = vps.includes("desktop") ? vps : (["desktop", ...vps] as ViewportName[]);
  }
  if (v.header?.length) {
    o.headers = Object.fromEntries(
      v.header.map((h) => {
        const i = h.indexOf(":");
        if (i < 1) throw new Error(`--header must look like "Name: value" (got ${h})`);
        return [h.slice(0, i).trim(), h.slice(i + 1).trim()];
      }),
    );
  }
  if (v.journey?.length) o.journeys = v.journey;
  if (v["allow-mutations"]) o.allowMutations = true;
  if (v.safe) o.allowMutations = false;
  if (v["fail-on"]) {
    if (!["critical", "high", "medium", "low", "info", "none"].includes(v["fail-on"])) throw new Error("--fail-on must be a severity or none");
    o.failOn = v["fail-on"] as Severity | "none";
  }
  if (v["update-baseline"]) o.visual = { update: true };
  if (v.ignore?.length) o.ignore = v.ignore;
  if (v["no-ai"]) ai.enabled = false;
  if (v.model) ai.model = v.model;
  if (v.effort) {
    if (!["low", "medium", "high", "xhigh", "max"].includes(v.effort)) throw new Error("--effort must be low|medium|high|xhigh|max");
    ai.effort = v.effort as QaConfig["ai"]["effort"];
  }
  const ux = int(v["ux-pages"], "ux-pages");
  if (ux !== undefined) ai.uxReviewPages = ux;
  const steps = int(v["explore-steps"], "explore-steps");
  if (steps !== undefined) {
    ai.explorerSteps = steps;
    ai.explorer = steps > 0;
  }
  if (v["no-code"]) code.enabled = false;
  if (v["no-api"]) o.api = { enabled: false };
  if (v["no-a11y"]) checks.a11y = false;
  if (v["no-visual"]) checks.visual = false;
  if (v["no-keyboard"]) checks.keyboard = false;
  if (v["no-interactions"]) checks.interactions = false;
  if (v["no-forms"]) checks.forms = false;
  if (v["no-external-links"]) checks.externalLinks = false;
  if (v.headed) o.headed = true;
  if (Object.keys(checks).length) o.checks = checks;
  if (Object.keys(ai).length) o.ai = ai;
  if (Object.keys(code).length) o.code = code;
  return o;
}

function openFile(file: string) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  spawn(cmd, [file], { detached: true, stdio: "ignore", shell: process.platform === "win32" }).unref();
}

async function cmdDiscover(target: string) {
  const repo = path.resolve(target);
  const stack = detectStack(repo);
  const routes = discoverRoutes(repo, stack, {});
  const endpoints = discoverEndpoints(repo, stack);
  const { startCommandFor } = await import("./target/launch.js");
  console.log(`Stack: ${stack.framework} (${stack.kind}${stack.packageManager ? `, ${stack.packageManager}` : ""})`);
  console.log(`Start command (dev): ${startCommandFor(stack, "dev", 4173) ?? (stack.kind === "static" ? "built-in static server" : "unknown: set start.command")}`);
  console.log(`\nPage routes (${routes.length}):`);
  for (const r of routes) console.log(`  ${r.dynamic ? "~" : " "} ${r.path.padEnd(48)} ${path.relative(repo, r.file ?? "")}`);
  console.log(`\nAPI endpoints (${endpoints.length}):`);
  for (const e of endpoints) console.log(`    ${e.method.padEnd(7)} ${e.path.padEnd(48)} ${path.relative(repo, e.file ?? "")}`);
  console.log("\n~ = dynamic route (needs routes.params values to be tested)");
}

function cmdInit(target: string) {
  const repo = path.resolve(target);
  const existing = findConfigFile(repo);
  if (existing) {
    console.log(`Config already exists: ${existing}`);
    return;
  }
  const stack = detectStack(repo);
  const routes = discoverRoutes(repo, stack, {});
  const params = Object.fromEntries(
    [...new Set(routes.filter((r) => r.dynamic).flatMap((r) => [...r.path.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1])))].map((p) => [p, "REPLACE_ME"]),
  );
  const d = defaultConfig();
  const starter = {
    name: path.basename(repo),
    mode: d.mode,
    maxPages: d.maxPages,
    viewports: d.viewports,
    routes: { include: [], exclude: [], params },
    journeys: ["Describe a key user journey here, e.g. 'Sign up, create a project, invite a teammate'"],
    headers: {},
    auth: { steps: [] },
    ignore: [],
    failOn: d.failOn,
    ai: { model: d.ai.model, uxReviewPages: d.ai.uxReviewPages, explorerSteps: d.ai.explorerSteps },
  };
  const file = path.join(repo, "qabot.config.json");
  fs.writeFileSync(file, JSON.stringify(starter, null, 2) + "\n");
  console.log(`Wrote ${file}`);
  console.log(`Detected ${stack.framework}; ${routes.length} routes (${routes.filter((r) => r.dynamic).length} dynamic: fill in routes.params).`);
  console.log("Add qabot-report/ to .gitignore.");
}

async function main() {
  const argv = process.argv.slice(2);
  let values: Values;
  let positionals: string[];
  try {
    ({ values, positionals } = parse(argv));
  } catch (e) {
    console.error(`${(e as Error).message}\n\nRun qabot --help for usage.`);
    process.exit(2);
  }
  if (values.version) return console.log(VERSION);
  if (values.help || !positionals.length) return console.log(HELP);
  log.verbose = !!values.verbose;
  log.quiet = !!values.quiet;

  const [first, ...rest] = positionals;
  const command = ["run", "init", "discover"].includes(first) ? first : "run";
  const target = (command === first ? rest[0] : first) ?? ".";
  if (command === "discover") return cmdDiscover(target);
  if (command === "init") return cmdInit(target);

  let overrides: DeepPartial<QaConfig>;
  try {
    overrides = toOverrides(values);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(2);
  }
  const t0 = Date.now();
  const outcome = await run({ target, configPath: values.config, overrides });
  const index = path.join(outcome.outDir, "index.html");
  if (values.json) process.stdout.write(JSON.stringify(outcome.report, null, 2) + "\n");
  const r = outcome.report;
  log.step(`Done in ${((Date.now() - t0) / 1000).toFixed(0)}s: ${r.verdict.toUpperCase()} · score ${r.scores.overall}/100`);
  log.info(summaryLine(r));
  for (const w of r.warnings) log.warn(w);
  log.info(`Report: ${index}`);
  if (values.open) openFile(index);
  process.exitCode = outcome.exitCode;
}

main().catch((e) => {
  console.error(`\nqabot failed: ${(e as Error).stack ?? e}`);
  process.exit(2);
});
