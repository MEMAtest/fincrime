import fs from "node:fs";
import path from "node:path";
import type { EndpointSpec, StackInfo } from "../types.js";
import { readJson, readText, walkFiles } from "../util.js";
import { segmentsToPath } from "./routes.js";

export const PROBE_ID = "qabot-probe-id";
const METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

/** Find the HTTP methods a Next.js / SvelteKit / Astro route module exports. */
export function exportedMethods(source: string): string[] {
  const found = new Set<string>();
  for (const m of source.matchAll(/export\s+(?:async\s+)?function\s+([A-Z]+)\b/g)) found.add(m[1]);
  for (const m of source.matchAll(/export\s+(?:const|let|var)\s+([A-Z]+)\s*[:=]/g)) found.add(m[1]);
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(",")) {
      const name = part.split(/\s+as\s+/).pop()?.trim();
      if (name) found.add(name);
    }
  }
  return [...found].filter((m) => METHODS.includes(m));
}

function fillParams(segments: string[]): { path: string; dynamic: boolean } {
  const r = segmentsToPath(segments, {});
  const dynamic = r.dynamic;
  return { path: r.path.replace(/\[[^\]]+\]/g, PROBE_ID), dynamic };
}

export function discoverEndpoints(repo: string, stack: StackInfo, ignore: string[] = []): EndpointSpec[] {
  const out = new Map<string, EndpointSpec>();
  const add = (method: string, p: string, file: string | undefined, dynamic: boolean, source: EndpointSpec["source"] = "code") => {
    const clean = p.replace(/\/+$/, "") || "/";
    const key = `${method} ${clean}`;
    if (!out.has(key)) out.set(key, { method, path: clean, file, dynamic: dynamic || undefined, source });
  };

  // Next.js App Router route handlers + SvelteKit +server + Astro endpoints
  const handlerRoots: [dir: string, match: (f: string) => boolean][] = [];
  if (stack.framework === "next") {
    for (const d of ["app", "src/app"]) handlerRoots.push([path.join(repo, d), (f) => /^route\.(ts|js|mjs)$/.test(path.basename(f))]);
  }
  if (stack.framework === "sveltekit") handlerRoots.push([path.join(repo, "src/routes"), (f) => /^\+server\.(ts|js)$/.test(path.basename(f))]);
  if (stack.framework === "astro") handlerRoots.push([path.join(repo, "src/pages"), (f) => /\.(ts|js)$/.test(f)]);
  for (const [dir, match] of handlerRoots) {
    if (!fs.existsSync(dir)) continue;
    for (const f of walkFiles(dir, { exts: [".ts", ".js", ".mjs"], ignore })) {
      if (!match(f)) continue;
      const parts = path.relative(dir, f).split(path.sep);
      const segs = stack.framework === "astro" ? [...parts.slice(0, -1), parts[parts.length - 1].replace(/\.(ts|js)$/, "")] : parts.slice(0, -1);
      const { path: p, dynamic } = fillParams(segs.filter((s) => s !== "index"));
      const methods = exportedMethods(readText(f) ?? "");
      for (const m of methods.length ? methods : ["GET"]) add(m, p, f, dynamic);
    }
  }

  // Next.js Pages Router API routes (method unknown)
  if (stack.framework === "next") {
    for (const d of ["pages/api", "src/pages/api"]) {
      const dir = path.join(repo, d);
      if (!fs.existsSync(dir)) continue;
      for (const f of walkFiles(dir, { exts: [".ts", ".js"], ignore })) {
        const parts = path.relative(dir, f).split(path.sep);
        const name = parts[parts.length - 1].replace(/\.(ts|js)$/, "");
        const { path: p, dynamic } = fillParams(["api", ...parts.slice(0, -1), ...(name === "index" ? [] : [name])]);
        add("ANY", p, f, dynamic);
      }
    }
  }

  // Nuxt server/api (file suffix encodes method: users.get.ts)
  if (stack.framework === "nuxt") {
    const dir = path.join(repo, "server/api");
    if (fs.existsSync(dir)) {
      for (const f of walkFiles(dir, { exts: [".ts", ".js"], ignore })) {
        const parts = path.relative(dir, f).split(path.sep);
        const file = parts[parts.length - 1].replace(/\.(ts|js)$/, "");
        const [name, method] = file.split(".");
        const { path: p, dynamic } = fillParams(["api", ...parts.slice(0, -1), ...(name === "index" ? [] : [name])]);
        add(method ? method.toUpperCase() : "ANY", p, f, dynamic);
      }
    }
  }

  // Express / Fastify / Koa / Hono / NestJS-ish and Flask / FastAPI decorators
  const serverish = ["express", "fastify", "koa", "hono", "nest", "node", "flask", "fastapi"].includes(stack.framework);
  if (serverish) {
    const exts = stack.kind === "python" ? [".py"] : [".ts", ".js", ".mjs", ".cjs"];
    for (const f of walkFiles(repo, { exts, maxFiles: 4000, ignore })) {
      const t = readText(f, 500_000);
      if (!t) continue;
      for (const m of t.matchAll(/\b(?:app|router|server|api|routes|fastify|r)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*["'`](\/[^"'`]*)["'`]/gi)) {
        add(m[1].toUpperCase(), normalizeParamSyntax(m[2]), f, /[:{<]/.test(m[2]));
      }
      for (const m of t.matchAll(/@\w+\.(get|post|put|patch|delete)\(\s*["'](\/[^"']*)["']/g)) {
        add(m[1].toUpperCase(), normalizeParamSyntax(m[2]), f, /[:{<]/.test(m[2]));
      }
      for (const m of t.matchAll(/@\w+\.route\(\s*["'](\/[^"']*)["'](?:[^)]*methods\s*=\s*\[([^\]]*)\])?/g)) {
        const methods = m[2] ? [...m[2].matchAll(/["'](\w+)["']/g)].map((x) => x[1].toUpperCase()) : ["GET"];
        for (const method of methods) add(method, normalizeParamSyntax(m[1]), f, /[:{<]/.test(m[1]));
      }
    }
  }

  // OpenAPI / Swagger documents
  for (const name of ["openapi.json", "swagger.json", "public/openapi.json", "docs/openapi.json"]) {
    const spec = readJson<{ paths?: Record<string, Record<string, unknown>> }>(path.join(repo, name));
    if (!spec?.paths) continue;
    for (const [p, ops] of Object.entries(spec.paths)) {
      for (const method of Object.keys(ops)) {
        if (METHODS.includes(method.toUpperCase())) add(method.toUpperCase(), normalizeParamSyntax(p), path.join(repo, name), /[{:]/.test(p), "openapi");
      }
    }
  }

  return [...out.values()].sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

/** Replace :id, {id}, <int:id> placeholders with a probe value. */
export function normalizeParamSyntax(p: string): string {
  return p
    .replace(/<(?:\w+:)?\w+>/g, PROBE_ID)
    .replace(/\{[^}]+\}/g, PROBE_ID)
    .replace(/:\w+\??/g, PROBE_ID);
}
