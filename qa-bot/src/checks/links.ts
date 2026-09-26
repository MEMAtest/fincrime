import type { FindingSink } from "../findings.js";
import { mapLimit, truncate } from "../util.js";

async function statusOf(url: string, headers: Record<string, string> = {}): Promise<number | string> {
  const attempt = async (method: "HEAD" | "GET") => {
    const r = await fetch(url, {
      method,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (qabot link checker)", ...headers },
      signal: AbortSignal.timeout(15_000),
    });
    await r.body?.cancel().catch(() => {});
    return r.status;
  };
  try {
    const s = await attempt("HEAD");
    if (s === 405 || s === 403 || s === 501 || s === 400) return await attempt("GET");
    return s;
  } catch (e) {
    try {
      return await attempt("GET");
    } catch {
      return (e as Error).cause ? String((e as Error & { cause?: { code?: string } }).cause?.code ?? "network error") : "network error";
    }
  }
}

/** Report internal links that 4xx/5xx, plus dead external links. */
export async function checkLinks(opts: {
  sink: FindingSink;
  linkSources: Map<string, Set<string>>;
  externalLinks: Map<string, Set<string>>;
  statusByUrl: Map<string, number | undefined>;
  checkExternal: boolean;
  headers: Record<string, string>;
}): Promise<{ internalChecked: number; externalChecked: number; unverifiable: number }> {
  const internal = [...opts.linkSources.keys()];
  const unknown = internal.filter((u) => !opts.statusByUrl.has(u)).slice(0, 300);
  await mapLimit(unknown, 6, async (u) => {
    const s = await statusOf(u, opts.headers);
    opts.statusByUrl.set(u, typeof s === "number" ? s : undefined);
  });
  for (const u of internal) {
    const s = opts.statusByUrl.get(u);
    if (!s || s < 400 || s === 401 || s === 403) continue;
    const from = [...(opts.linkSources.get(u) ?? [])];
    const p = new URL(u).pathname;
    opts.sink.add({
      ruleId: "link-broken-internal",
      key: p,
      title: `Broken internal link → ${truncate(p, 80)} (HTTP ${s})`,
      severity: s >= 500 ? "critical" : "high",
      category: "functional",
      description: `${from.length} page${from.length === 1 ? "" : "s"} link to ${u}, which returns ${s}.`,
      recommendation: "Fix the href or restore the page (add a redirect if it moved).",
      source: "crawler",
      occurrence: undefined,
    });
    for (const src of from.slice(0, 20)) {
      opts.sink.add({
        ruleId: "link-broken-internal",
        key: p,
        title: `Broken internal link → ${truncate(p, 80)} (HTTP ${s})`,
        severity: s >= 500 ? "critical" : "high",
        category: "functional",
        description: "",
        source: "crawler",
        occurrence: { url: src, detail: `links to ${p}` },
      });
    }
  }

  let externalChecked = 0;
  let unverifiable = 0;
  if (opts.checkExternal) {
    const ext = [...opts.externalLinks.keys()].filter((u) => !/linkedin\.com|twitter\.com|x\.com|facebook\.com|instagram\.com/.test(u)).slice(0, 150);
    const unreachable: string[] = [];
    await mapLimit(ext, 8, async (u) => {
      const s = await statusOf(u);
      externalChecked++;
      if (typeof s !== "number") {
        unverifiable++;
        unreachable.push(u);
        return;
      }
      if (s !== 404 && s !== 410 && s < 500) return;
      const from = [...(opts.externalLinks.get(u) ?? [])];
      for (const src of from.slice(0, 10)) {
        opts.sink.add({
          ruleId: "link-broken-external",
          key: u,
          title: `Broken external link → ${truncate(u.replace(/^https?:\/\//, ""), 80)} (HTTP ${s})`,
          severity: s >= 500 ? "low" : "medium",
          category: "content",
          description: `The page links to ${u}, which returns ${s}.`,
          recommendation: "Update or remove the link.",
          source: "crawler",
          occurrence: { url: src, detail: u },
        });
      }
    });
    if (unreachable.length) {
      opts.sink.add({
        ruleId: "link-external-unverified",
        title: `${unreachable.length} external link${unreachable.length === 1 ? "" : "s"} could not be verified (network)`,
        severity: "info",
        category: "content",
        description: `These hosts didn't answer from the machine running qabot (offline, blocked, or rate-limited): ${unreachable
          .slice(0, 10)
          .map((u) => new URL(u).host)
          .join(", ")}${unreachable.length > 10 ? "…" : ""}.`,
        source: "crawler",
      });
    }
  }
  return { internalChecked: internal.length, externalChecked, unverifiable };
}
