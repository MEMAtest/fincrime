import fs from "node:fs";
import path from "node:path";
import type { StackInfo } from "../types.js";
import { readJson, readText, walkFiles } from "../util.js";

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const NODE_FRAMEWORKS: [dep: string, name: string][] = [
  ["next", "next"],
  ["nuxt", "nuxt"],
  ["@sveltejs/kit", "sveltekit"],
  ["astro", "astro"],
  ["@remix-run/dev", "remix"],
  ["@react-router/dev", "remix"],
  ["gatsby", "gatsby"],
  ["@angular/core", "angular"],
  ["vite", "vite"],
  ["react-scripts", "cra"],
  ["@nestjs/core", "nest"],
  ["express", "express"],
  ["fastify", "fastify"],
  ["koa", "koa"],
  ["hono", "hono"],
];

export function detectStack(repo: string): StackInfo {
  const pkg = readJson<PackageJson>(path.join(repo, "package.json"));
  if (pkg) {
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    const framework = NODE_FRAMEWORKS.find(([dep]) => dep in deps)?.[1];
    const scripts = pkg.scripts ?? {};
    const runnable = ["dev", "start", "serve", "develop", "preview"].some((s) => s in scripts);
    const info: StackInfo = {
      kind: "node",
      framework: framework ?? (runnable ? "node" : "static"),
      packageManager: detectPackageManager(repo),
      scripts,
      dependencies: deps,
      hasTypeScript: "typescript" in deps || fs.existsSync(path.join(repo, "tsconfig.json")),
    };
    if (!framework && !runnable) {
      info.kind = "static";
      info.staticRoot = staticRootFor(repo);
    }
    return info;
  }

  if (fs.existsSync(path.join(repo, "manage.py"))) {
    return { kind: "python", framework: "django", scripts: {}, dependencies: {}, hasTypeScript: false };
  }
  const py = walkFiles(repo, { exts: [".py"], maxFiles: 400 });
  for (const f of py) {
    const t = readText(f, 300_000) ?? "";
    if (/\bFastAPI\s*\(/.test(t)) return { kind: "python", framework: "fastapi", scripts: {}, dependencies: {}, hasTypeScript: false };
    if (/\bFlask\s*\(/.test(t)) return { kind: "python", framework: "flask", scripts: {}, dependencies: {}, hasTypeScript: false };
  }

  if (walkFiles(repo, { exts: [".html", ".htm"], maxFiles: 1 }).length) {
    return { kind: "static", framework: "static", scripts: {}, dependencies: {}, hasTypeScript: false, staticRoot: staticRootFor(repo) };
  }
  return { kind: "unknown", framework: "unknown", scripts: {}, dependencies: {}, hasTypeScript: false };
}

function detectPackageManager(repo: string): StackInfo["packageManager"] {
  if (fs.existsSync(path.join(repo, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(repo, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(repo, "bun.lockb")) || fs.existsSync(path.join(repo, "bun.lock"))) return "bun";
  return "npm";
}

function staticRootFor(repo: string): string {
  for (const d of ["public", "site", "docs", "www", "src"]) {
    const p = path.join(repo, d);
    if (fs.existsSync(path.join(p, "index.html"))) return p;
  }
  return repo;
}

/** Build the command that runs a package.json script with extra args, per package manager. */
export function runScript(pm: StackInfo["packageManager"], script: string, args = ""): string {
  const extra = args ? ` ${args}` : "";
  switch (pm) {
    case "pnpm":
      return `pnpm run ${script}${extra}`;
    case "yarn":
      return `yarn ${script}${extra}`;
    case "bun":
      return `bun run ${script}${extra}`;
    default:
      return `npm run ${script}${args ? ` --${extra}` : ""}`;
  }
}

export function installCommand(repo: string, pm: StackInfo["packageManager"]): string {
  switch (pm) {
    case "pnpm":
      return "pnpm install --frozen-lockfile";
    case "yarn":
      return "yarn install --frozen-lockfile";
    case "bun":
      return "bun install";
    default:
      return fs.existsSync(path.join(repo, "package-lock.json")) ? "npm ci --no-audit --no-fund" : "npm install --no-audit --no-fund";
  }
}
