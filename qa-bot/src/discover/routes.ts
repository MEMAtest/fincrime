import fs from "node:fs";
import path from "node:path";
import type { RouteInfo, StackInfo } from "../types.js";
import { readText, walkFiles } from "../util.js";

export interface SegmentResult {
  path: string;
  dynamic: boolean;
  skip: boolean;
}

/**
 * Convert file-system route segments (Next.js / SvelteKit / Nuxt / Astro conventions) to a URL path.
 * Dynamic segments are filled from `params` when possible, otherwise the route is flagged dynamic.
 */
export function segmentsToPath(segments: string[], params: Record<string, string>): SegmentResult {
  const out: string[] = [];
  let dynamic = false;
  for (const raw of segments) {
    if (!raw) continue;
    if (/^\(\.{1,3}\)/.test(raw)) return { path: "", dynamic: false, skip: true }; // intercepting route
    if (/^\(.*\)$/.test(raw)) continue; // route group
    if (raw.startsWith("@")) return { path: "", dynamic: false, skip: true }; // parallel slot
    if (raw.startsWith("_") && raw !== "_index") return { path: "", dynamic: false, skip: true }; // private folder
    const m = raw.match(/^\[{1,2}(?:\.\.\.)?([^\]]+)\]{1,2}$/) ?? raw.match(/^\$(\w+)$/);
    if (m) {
      const name = m[1];
      if (params[name] !== undefined) out.push(encodeURIComponent(params[name]));
      else if (raw.startsWith("[[")) continue; // optional catch-all: the bare route is valid
      else {
        dynamic = true;
        out.push(`[${name}]`);
      }
      continue;
    }
    out.push(raw);
  }
  return { path: "/" + out.join("/"), dynamic, skip: false };
}

function rel(root: string, file: string): string[] {
  return path.relative(root, file).split(path.sep);
}

function firstExisting(repo: string, dirs: string[]): string | undefined {
  return dirs.map((d) => path.join(repo, d)).find((d) => fs.existsSync(d) && fs.statSync(d).isDirectory());
}

export function discoverRoutes(repo: string, stack: StackInfo, params: Record<string, string>, ignore: string[] = []): RouteInfo[] {
  const routes = new Map<string, RouteInfo>();
  const add = (r: SegmentResult, file: string) => {
    if (r.skip) return;
    const p = r.path.replace(/\/+$/, "") || "/";
    if (!routes.has(p)) routes.set(p, { path: p, file, dynamic: r.dynamic || undefined, source: "code" });
  };

  // Next.js App Router
  const appDir = firstExisting(repo, ["app", "src/app"]);
  if (appDir && stack.framework === "next") {
    for (const f of walkFiles(appDir, { exts: [".tsx", ".ts", ".jsx", ".js", ".mdx", ".md"], ignore })) {
      if (!/^page\.(tsx|ts|jsx|js|mdx|md)$/.test(path.basename(f))) continue;
      add(segmentsToPath(rel(appDir, path.dirname(f)), params), f);
    }
  }

  // Next.js Pages Router
  const pagesDir = firstExisting(repo, ["pages", "src/pages"]);
  if (pagesDir && stack.framework === "next") {
    for (const f of walkFiles(pagesDir, { exts: [".tsx", ".ts", ".jsx", ".js", ".mdx"], ignore })) {
      const parts = rel(pagesDir, f);
      if (parts[0] === "api") continue;
      const name = parts[parts.length - 1].replace(/\.(tsx|ts|jsx|js|mdx)$/, "");
      if (["_app", "_document", "_error", "404", "500"].includes(name)) continue;
      const segs = [...parts.slice(0, -1), ...(name === "index" ? [] : [name])];
      add(segmentsToPath(segs, params), f);
    }
  }

  // SvelteKit
  if (stack.framework === "sveltekit") {
    const dir = path.join(repo, "src/routes");
    for (const f of walkFiles(dir, { exts: [".svelte"], ignore })) {
      if (path.basename(f) !== "+page.svelte") continue;
      add(segmentsToPath(rel(dir, path.dirname(f)), params), f);
    }
  }

  // Astro
  if (stack.framework === "astro") {
    const dir = path.join(repo, "src/pages");
    for (const f of walkFiles(dir, { exts: [".astro", ".md", ".mdx", ".html"], ignore })) {
      const parts = rel(dir, f);
      const name = parts[parts.length - 1].replace(/\.(astro|md|mdx|html)$/, "");
      add(segmentsToPath([...parts.slice(0, -1), ...(name === "index" ? [] : [name])], params), f);
    }
  }

  // Nuxt
  if (stack.framework === "nuxt") {
    const dir = firstExisting(repo, ["pages", "app/pages"]);
    if (dir) {
      for (const f of walkFiles(dir, { exts: [".vue"], ignore })) {
        const parts = rel(dir, f);
        const name = parts[parts.length - 1].replace(/\.vue$/, "");
        add(segmentsToPath([...parts.slice(0, -1), ...(name === "index" ? [] : [name])], params), f);
      }
    }
  }

  // Remix / React Router v7 flat routes
  if (stack.framework === "remix") {
    const dir = path.join(repo, "app/routes");
    for (const f of walkFiles(dir, { exts: [".tsx", ".jsx", ".ts", ".js"], ignore })) {
      const base = path.basename(f).replace(/\.(tsx|jsx|ts|js)$/, "").replace(/\/route$/, "");
      if (/^(resource|api)\./.test(base)) continue;
      const segs = base === "_index" ? [] : base.split(".").filter((s) => s !== "_index" && !s.startsWith("_"));
      add(segmentsToPath(segs, params), f);
    }
  }

  // Plain HTML sites
  if (stack.kind === "static") {
    const root = stack.staticRoot ?? repo;
    for (const f of walkFiles(root, { exts: [".html", ".htm"], ignore })) {
      const parts = rel(root, f);
      const name = parts[parts.length - 1];
      const segs = name === "index.html" ? parts.slice(0, -1) : parts;
      add({ path: "/" + segs.join("/"), dynamic: false, skip: false }, f);
    }
  }

  // Client-side routers (React Router, Vue Router, Angular) - regex heuristics
  if (["vite", "cra", "angular", "node", "gatsby"].includes(stack.framework)) {
    const src = firstExisting(repo, ["src", "app", "client"]) ?? repo;
    for (const f of walkFiles(src, { exts: [".tsx", ".ts", ".jsx", ".js", ".vue"], maxFiles: 3000, ignore })) {
      const t = readText(f, 400_000);
      if (!t || !/path\s*[:=]/.test(t)) continue;
      for (const m of t.matchAll(/(?:<Route[^>]*\spath=|\bpath\s*:\s*)["'`](\/?[\w\-/.:*]*)["'`]/g)) {
        const p = m[1];
        if (!p || p.includes("*")) continue;
        const segs = p.split("/").map((s) => (s.startsWith(":") ? `[${s.slice(1).replace(/\?$/, "")}]` : s));
        add(segmentsToPath(segs, params), f);
      }
    }
  }

  // Django / Flask
  if (stack.framework === "django") {
    for (const f of walkFiles(repo, { exts: ["urls.py"], ignore })) {
      for (const m of (readText(f) ?? "").matchAll(/\b(?:re_)?path\(\s*r?["']\^?([^"'$]*)\$?["']/g)) {
        const segs = m[1].split("/").map((s) => (s.startsWith("<") ? `[${s.replace(/[<>]/g, "").split(":").pop()}]` : s));
        add(segmentsToPath(segs, params), f);
      }
    }
  }
  if (stack.framework === "flask") {
    for (const f of walkFiles(repo, { exts: [".py"], ignore })) {
      for (const m of (readText(f) ?? "").matchAll(/@\w+\.route\(\s*["']([^"']+)["']/g)) {
        const segs = m[1].split("/").map((s) => (s.startsWith("<") ? `[${s.replace(/[<>]/g, "").split(":").pop()}]` : s));
        add(segmentsToPath(segs, params), f);
      }
    }
  }

  return [...routes.values()].sort((a, b) => a.path.split("/").length - b.path.split("/").length || a.path.localeCompare(b.path));
}

/** Parse a sitemap.xml body into same-origin paths. */
export function parseSitemap(xml: string, origin: string): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    try {
      const u = new URL(m[1]);
      out.push(u.pathname + u.search);
    } catch {
      /* ignore malformed entries */
    }
  }
  void origin;
  return out;
}
