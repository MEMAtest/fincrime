import path from "node:path";
import type { Finding } from "../types.js";
import { readText, walkFiles } from "../util.js";

/** Utility-class prefixes (Tailwind/Bootstrap-style) that say nothing about which component rendered an element. */
const UTILITY =
  /^(?:[a-z]+:)?(?:flex|grid|block|inline|hidden|contents|relative|absolute|fixed|sticky|static|container|row|col|w-|h-|min-|max-|size-|p[xytrbl]?-|m[xytrbl]?-|-m|gap-|space-|text-|font-|leading-|tracking-|bg-|from-|to-|via-|border|rounded|shadow|ring|outline|items-|justify-|content-|self-|place-|z-|top-|left-|right-|bottom-|inset|overflow|opacity|transition|duration|ease|delay|animate|cursor|select|pointer|shrink|grow|basis|order|truncate|whitespace|break|underline|uppercase|lowercase|capitalize|italic|sr-only|not-sr-only|visible|invisible|aspect|object|fill|stroke|backdrop|blur|filter|transform|translate|rotate|scale|origin|antialiased|btn|active|show|fade|d-|glass)/;

const SOURCE_EXTS = [".tsx", ".jsx", ".ts", ".js", ".vue", ".svelte", ".astro", ".html", ".css", ".scss", ".module.css"];

export function distinctiveTokens(selector: string): { classes: string[]; ids: string[] } {
  const classes = [...selector.matchAll(/\.([A-Za-z][\w-]{3,})/g)].map((m) => m[1]).filter((c) => !UTILITY.test(c));
  const ids = [...selector.matchAll(/#([A-Za-z][\w-]{2,})/g)].map((m) => m[1]);
  return { classes: [...new Set(classes)], ids: [...new Set(ids)] };
}

/**
 * Point browser findings at the component/stylesheet that defines the offending element, by looking up
 * distinctive class names and ids from the element selectors in the source tree.
 */
export function enrichFilesFromSelectors(repo: string, findings: Finding[], ignore: string[] = []) {
  const wanted = findings.filter((f) => f.occurrences.some((o) => o.selector));
  if (!wanted.length) return;
  const files = walkFiles(repo, { exts: SOURCE_EXTS, maxFiles: 8000, ignore })
    .map((f) => ({ rel: path.relative(repo, f).split(path.sep).join("/"), text: readText(f, 800_000) ?? "" }))
    .filter((f) => f.text);
  const cache = new Map<string, string[]>();
  const lookup = (token: string, kind: "class" | "id") => {
    const key = `${kind}:${token}`;
    if (cache.has(key)) return cache.get(key)!;
    const esc = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re =
      kind === "class"
        ? new RegExp(`(?:class(?:Name)?=[^>]*[\\s"'\`{]${esc}(?=[\\s"'\`}])|\\.${esc}(?![\\w-]))`)
        : new RegExp(`(?:id=["'{]${esc}["'}]|#${esc}(?![\\w-]))`);
    const hits = files.filter((f) => re.test(f.text)).map((f) => f.rel);
    // A token found in dozens of files isn't distinctive.
    const out = hits.length <= 6 ? hits : [];
    cache.set(key, out);
    return out;
  };
  for (const f of wanted) {
    const found = new Set<string>();
    for (const o of f.occurrences.slice(0, 5)) {
      if (!o.selector) continue;
      const { classes, ids } = distinctiveTokens(o.selector);
      // Innermost tokens first: they're closest to the offending element.
      for (const c of classes.reverse()) for (const hit of lookup(c, "class")) found.add(hit);
      for (const id of ids) for (const hit of lookup(id, "id")) found.add(hit);
      if (found.size >= 4) break;
    }
    if (found.size) {
      // Component/stylesheet matches are more specific than the page file, so they go first.
      f.files = [...new Set([...found, ...(f.files ?? [])])].slice(0, 6);
    }
  }
}
