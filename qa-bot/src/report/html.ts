import type { Category, Finding, PageVisit, RunReport, Severity } from "../types.js";
import { CATEGORY_LABELS, SEVERITIES } from "../types.js";
import { formatMs } from "../util.js";

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const SEV_LABEL: Record<Severity, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low", info: "Info" };
const SOURCE_LABEL: Record<string, string> = {
  browser: "Browser",
  crawler: "Crawler",
  api: "API probe",
  code: "Code",
  "server-log": "Server log",
  "ai-ux": "AI UX review",
  "ai-explorer": "AI explorer",
};
const VERDICT = {
  pass: { label: "Looks good", cls: "ok" },
  warn: { label: "Needs fixes", cls: "warn" },
  fail: { label: "Not ready", cls: "bad" },
};
const RELEASE = { ship: "Ship", ship_with_fixes: "Ship after fixes", block: "Block release" };

function pathOf(url?: string) {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

function findingCard(f: Finding, count: number): string {
  const occ = f.occurrences
    .map(
      (o) => `<tr>
        <td>${o.url ? `<a href="${esc(o.url)}" target="_blank" rel="noreferrer">${esc(pathOf(o.url))}</a>` : "–"}</td>
        <td>${esc(o.viewport ?? "")}</td>
        <td>${o.selector ? `<code>${esc(o.selector)}</code>` : ""}</td>
        <td>${esc(o.detail ?? "")}</td>
        <td>${o.screenshot ? `<a href="${esc(o.screenshot)}" target="_blank"><img class="thumb" loading="lazy" src="${esc(o.screenshot)}" alt="evidence"></a>` : ""}</td>
      </tr>`,
    )
    .join("");
  const shots = [...new Set(f.occurrences.map((o) => o.screenshot).filter(Boolean))].slice(0, 3);
  const search = `${f.title} ${f.description} ${f.ruleId} ${(f.files ?? []).join(" ")} ${f.occurrences.map((o) => o.url).join(" ")}`.toLowerCase();
  return `<details class="finding sev-${f.severity}${f.aiNote ? " fp" : ""}" id="f-${f.id}" data-sev="${f.severity}" data-cat="${f.category}" data-src="${f.source}" data-q="${esc(search)}">
  <summary>
    <span class="sev">${SEV_LABEL[f.severity]}</span>
    <span class="ftitle">${esc(f.title)}</span>
    <span class="meta">${esc(CATEGORY_LABELS[f.category])} · ${esc(SOURCE_LABEL[f.source] ?? f.source)}${count > 1 ? ` · <b>${count}×</b>` : ""}</span>
  </summary>
  <div class="fbody">
    ${f.aiNote ? `<p class="ainote">🤖 ${esc(f.aiNote)}</p>` : ""}
    <div class="desc">${esc(f.description)}</div>
    ${f.recommendation ? `<div class="rec"><b>Fix:</b> ${esc(f.recommendation)}</div>` : ""}
    ${f.steps?.length ? `<div class="steps"><b>Reproduce</b><ol>${f.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>` : ""}
    ${f.files?.length ? `<div class="files"><b>Likely source:</b> ${f.files.map((x) => `<code>${esc(x)}</code>`).join(" ")}</div>` : ""}
    ${shots.length ? `<div class="shots">${shots.map((s) => `<a href="${esc(s)}" target="_blank"><img loading="lazy" src="${esc(s)}" alt="screenshot"></a>`).join("")}</div>` : ""}
    ${occ ? `<div class="table-scroll"><table class="occ"><thead><tr><th>Page</th><th>Viewport</th><th>Element</th><th>Detail</th><th></th></tr></thead><tbody>${occ}</tbody></table></div>` : ""}
    <div class="rule">rule <code>${esc(f.ruleId)}</code> · id <code>${f.id}</code></div>
  </div>
</details>`;
}

function pagesTable(r: RunReport): string {
  const byPath = new Map<string, Partial<Record<string, PageVisit>>>();
  for (const v of r.pages) {
    const key = pathOf(v.url);
    if (!byPath.has(key)) byPath.set(key, {});
    byPath.get(key)![v.viewport] = v;
  }
  const rows = [...byPath.entries()].map(([p, vs]) => {
    const d = vs.desktop;
    const thumbs = r.settings.viewports
      .map((vp) => {
        const v = vs[vp];
        if (!v?.screenshot) return `<span class="nothumb">${vp}</span>`;
        return `<a href="${esc(v.fullScreenshot ?? v.screenshot)}" target="_blank" title="${vp}"><img class="pthumb ${vp}" loading="lazy" src="${esc(v.screenshot)}" alt="${vp}"></a>`;
      })
      .join("");
    const errs = Object.values(vs).reduce((n, v) => n + (v?.consoleErrors ?? 0), 0);
    const fails = Object.values(vs).reduce((n, v) => n + (v?.failedRequests ?? 0), 0);
    const st = d?.error ? `<span class="pill bad" title="${esc(d.error)}">error</span>` : `<span class="pill ${(d?.status ?? 0) >= 400 ? "bad" : "ok"}">${d?.status ?? "–"}</span>`;
    return `<tr>
      <td><a href="${esc(d?.url ?? "")}" target="_blank">${esc(p)}</a><div class="sub">${esc(d?.title ?? "")}</div>${d?.sourceFile ? `<div class="sub"><code>${esc(d.sourceFile)}</code></div>` : ""}</td>
      <td>${st}</td>
      <td class="thumbs">${thumbs}</td>
      <td>${formatMs(d?.metrics?.lcpMs)}</td>
      <td>${d?.metrics?.cls ?? "–"}</td>
      <td>${d?.metrics?.transferKb !== undefined ? `${d.metrics.transferKb} KB` : "–"}</td>
      <td>${errs ? `<span class="pill bad">${errs}</span>` : "0"}</td>
      <td>${fails ? `<span class="pill warn">${fails}</span>` : "0"}</td>
    </tr>`;
  });
  return `<table class="grid"><thead><tr><th>Page</th><th>Status</th><th>Screens</th><th>LCP</th><th>CLS</th><th>Weight</th><th>JS errors</th><th>Failed req.</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

export function renderHtml(r: RunReport, counts: (id: string) => number): string {
  const sevCounts = Object.fromEntries(SEVERITIES.map((s) => [s, r.findings.filter((f) => f.severity === s).length])) as Record<Severity, number>;
  const cats = [...new Set(r.findings.map((f) => f.category))];
  const v = VERDICT[r.verdict];
  const score = r.scores.overall;
  const catBars = (Object.entries(r.scores.byCategory) as [Category, number][])
    .sort((a, b) => a[1] - b[1])
    .map(
      ([c, s]) =>
        `<div class="bar"><span class="blabel">${esc(CATEGORY_LABELS[c])}</span><span class="btrack"><span class="bfill ${s >= 80 ? "ok" : s >= 50 ? "warn" : "bad"}" style="width:${s}%"></span></span><span class="bnum">${s}</span></div>`,
    )
    .join("");
  const ai = r.ai;
  const aiBlock = ai?.executiveSummary
    ? `<section class="card ai" id="summary">
        <div class="aihead"><h2>AI triage</h2>${ai.releaseRecommendation ? `<span class="pill ${ai.releaseRecommendation === "ship" ? "ok" : ai.releaseRecommendation === "block" ? "bad" : "warn"}">${RELEASE[ai.releaseRecommendation]}</span>` : ""}</div>
        <p class="lead">${esc(ai.executiveSummary)}</p>
        ${
          ai.topPriorities?.length
            ? `<h3>Fix first</h3><ol class="prio">${ai.topPriorities
                .map(
                  (p) => `<li><b>${esc(p.title)}</b><div>${esc(p.whyItMatters)}</div><div class="fix">→ ${esc(p.suggestedFix)}</div>
              <div class="sub">${p.findingIds.map((id) => `<a href="#f-${id}" class="jump">${id}</a>`).join(" ")} ${p.likelyFiles.map((f) => `<code>${esc(f)}</code>`).join(" ")}</div></li>`,
                )
                .join("")}</ol>`
            : ""
        }
        ${ai.missingCoverage?.length ? `<h3>Not covered by this run</h3><ul>${ai.missingCoverage.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
      </section>`
    : "";
  const ux = ai?.uxScores?.length
    ? `<section class="card" id="ux"><h2>UX review scores</h2><div class="uxgrid">${ai.uxScores
        .map(
          (s) => `<div class="ux"><div class="uxscore ${s.score >= 80 ? "ok" : s.score >= 60 ? "warn" : "bad"}">${s.score}</div><div><b>${esc(pathOf(s.url))}</b><div class="sub">${esc(s.purpose)}</div>${
            s.strengths.length ? `<div class="sub">✓ ${s.strengths.map(esc).join(" · ")}</div>` : ""
          }</div></div>`,
        )
        .join("")}</div></section>`
    : "";
  const explorer = ai?.explorer
    ? `<section class="card" id="explorer"><h2>AI exploratory session</h2>
        ${ai.explorer.summary ? `<p class="lead">${esc(ai.explorer.summary)}</p>` : ""}
        ${ai.explorer.journeysCovered?.length ? `<h3>Journeys covered</h3><ul>${ai.explorer.journeysCovered.map((j) => `<li>${esc(j)}</li>`).join("")}</ul>` : ""}
        ${ai.explorer.coverageGaps?.length ? `<h3>Gaps</h3><ul>${ai.explorer.coverageGaps.map((j) => `<li>${esc(j)}</li>`).join("")}</ul>` : ""}
        <details><summary>Timeline (${ai.explorer.steps.length} steps)</summary><ol class="timeline">${ai.explorer.steps
          .map((s) => `<li class="t-${s.kind}"><span class="tturn">${s.turn}</span> ${esc(s.text)}${s.screenshot ? ` <a href="${esc(s.screenshot)}" target="_blank">screenshot</a>` : ""}</li>`)
          .join("")}</ol></details>
      </section>`
    : "";
  const api = r.api.length
    ? `<section class="card" id="api"><h2>API &amp; backend probes <span class="count">${r.api.length}</span></h2><div class="table-scroll"><table class="grid"><thead><tr><th>Method</th><th>Path</th><th>Probe</th><th>Status</th><th>Time</th><th>Verdict</th></tr></thead><tbody>${r.api
        .map(
          (a) => `<tr><td><code>${esc(a.method)}</code></td><td><code>${esc(a.path)}</code>${a.sourceFile ? `<div class="sub">${esc(a.sourceFile)}</div>` : ""}</td><td>${esc(a.probe)}</td><td>${a.status ?? "–"}</td><td>${formatMs(a.durationMs)}</td><td><span class="pill ${
            a.verdict === "bug" || a.verdict === "error" ? "bad" : a.verdict === "warn" ? "warn" : a.verdict === "skipped" || a.verdict === "auth" ? "muted" : "ok"
          }" title="${esc(a.note ?? "")}">${esc(a.verdict)}</span></td></tr>`,
        )
        .join("")}</tbody></table></div></section>`
    : "";
  const code = r.code.length
    ? `<section class="card" id="code"><h2>Code health</h2>${r.code
        .map(
          (c) => `<details class="check"><summary><span class="pill ${c.status === "pass" ? "ok" : c.status === "skipped" ? "muted" : "bad"}">${c.status}</span> <b>${esc(c.name)}</b> <code>${esc(c.command)}</code> <span class="sub">${formatMs(c.durationMs)}</span></summary><pre>${esc(c.outputTail ?? "")}</pre></details>`,
        )
        .join("")}</section>`
    : "";
  const skipped = r.skippedRoutes.length
    ? `<details class="sub"><summary>${r.skippedRoutes.length} dynamic routes not tested (add values under routes.params)</summary><ul>${r.skippedRoutes.map((s) => `<li><code>${esc(s.path)}</code> ${esc(s.file ?? "")}</li>`).join("")}</ul></details>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>QA report · ${esc(new URL(r.target.baseUrl).host)}</title>
<style>
:root{--bg:#f6f7f9;--panel:#fff;--ink:#16181d;--muted:#667085;--line:#e4e7ec;--accent:#3b5bdb;
--critical:#b42318;--high:#e8590c;--medium:#c08a00;--low:#1c7ed6;--info:#868e96;--ok:#2b8a3e;--warn:#c08a00;--bad:#c92a2a;--chip:#eef1f5;--code:#f1f3f5}
@media (prefers-color-scheme:dark){:root{--bg:#0f1115;--panel:#171a21;--ink:#e6e8ec;--muted:#98a2b3;--line:#2a2f3a;--accent:#8ea2ff;--chip:#222733;--code:#1f232c;
--critical:#ff6b6b;--high:#ff922b;--medium:#fcc419;--low:#4dabf7;--info:#adb5bd;--ok:#51cf66;--warn:#fcc419;--bad:#ff6b6b}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif}
a{color:var(--accent)}code{background:var(--code);padding:1px 5px;border-radius:4px;font-size:12px;word-break:break-all}
.wrap{max-width:1200px;margin:0 auto;padding:24px 16px 80px}
header.top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.brand{font-weight:700;letter-spacing:.02em;color:var(--muted);font-size:12px;text-transform:uppercase}
h1{margin:4px 0 6px;font-size:24px}h2{font-size:17px;margin:0 0 12px}h3{font-size:14px;margin:16px 0 6px}
.sub{color:var(--muted);font-size:12px}.lead{font-size:15px}
nav.jump{position:sticky;top:0;z-index:5;background:var(--bg);padding:8px 0;margin-bottom:12px;display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--line)}
nav.jump a{padding:4px 10px;border-radius:999px;background:var(--chip);text-decoration:none;color:var(--ink);font-size:13px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px;margin-bottom:16px}
.hero{display:grid;grid-template-columns:auto 1fr 1fr;gap:24px;align-items:center}
@media (max-width:820px){.hero{grid-template-columns:1fr}}
.ring{--p:0;width:120px;height:120px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--c) calc(var(--p)*1%),var(--line) 0)}
.ring>div{width:94px;height:94px;border-radius:50%;background:var(--panel);display:grid;place-items:center;text-align:center}
.ring b{font-size:30px;line-height:1}.ring span{font-size:11px;color:var(--muted)}
.pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid currentColor}
.pill.ok{color:var(--ok)}.pill.warn{color:var(--warn)}.pill.bad{color:var(--bad)}.pill.muted{color:var(--muted)}
.verdict{font-size:14px;padding:4px 12px}
.sevs{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.sevchip{padding:6px 10px;border-radius:8px;background:var(--chip);cursor:pointer;user-select:none;border:2px solid transparent;font-size:13px}
.sevchip b{font-size:16px;margin-right:4px}.sevchip.off{opacity:.35}
.sevchip.critical b{color:var(--critical)}.sevchip.high b{color:var(--high)}.sevchip.medium b{color:var(--medium)}.sevchip.low b{color:var(--low)}.sevchip.info b{color:var(--info)}
.bar{display:grid;grid-template-columns:110px 1fr 32px;gap:8px;align-items:center;font-size:12px;margin:3px 0}
.btrack{height:8px;background:var(--line);border-radius:4px;overflow:hidden}.bfill{display:block;height:100%}
.bfill.ok{background:var(--ok)}.bfill.warn{background:var(--warn)}.bfill.bad{background:var(--bad)}.bnum{text-align:right;color:var(--muted)}
.facts{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;font-size:13px}.facts dt{color:var(--muted)}.facts dd{margin:0}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.filters input,.filters select{padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:inherit}
.filters input{flex:1;min-width:200px}
details.finding{border:1px solid var(--line);border-left:4px solid var(--c);border-radius:8px;margin-bottom:8px;background:var(--panel)}
details.finding>summary{cursor:pointer;padding:10px 12px;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;list-style:none}
details.finding>summary::-webkit-details-marker{display:none}
.sev{font-size:11px;font-weight:700;text-transform:uppercase;color:var(--c);min-width:58px}
.ftitle{font-weight:600;flex:1;min-width:240px}.meta{color:var(--muted);font-size:12px}
.fbody{padding:0 14px 14px 14px;border-top:1px solid var(--line)}
.desc{white-space:pre-wrap;margin-top:10px;overflow-wrap:anywhere}.rec{margin-top:8px}.steps,.files{margin-top:8px}
.ainote{background:var(--chip);padding:6px 10px;border-radius:6px;font-size:13px}
.fp{opacity:.6}
.sev-critical{--c:var(--critical)}.sev-high{--c:var(--high)}.sev-medium{--c:var(--medium)}.sev-low{--c:var(--low)}.sev-info{--c:var(--info)}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top;font-size:13px}
th{color:var(--muted);font-weight:600;font-size:12px}
.occ{margin-top:10px}.rule{margin-top:8px;color:var(--muted);font-size:11px}
.thumb{width:90px;border-radius:4px;border:1px solid var(--line)}
.shots{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}.shots img{max-width:320px;max-height:220px;border:1px solid var(--line);border-radius:6px}
.table-scroll{overflow-x:auto}
.thumbs{white-space:nowrap}.pthumb{height:64px;border:1px solid var(--line);border-radius:4px;margin-right:4px;object-fit:cover;object-position:top}
.pthumb.desktop{width:102px}.pthumb.tablet{width:48px}.pthumb.mobile{width:30px}.nothumb{color:var(--muted);font-size:11px;margin-right:6px}
.uxgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}.ux{display:flex;gap:12px}
.uxscore{font-size:22px;font-weight:700;min-width:44px}.uxscore.ok{color:var(--ok)}.uxscore.warn{color:var(--warn)}.uxscore.bad{color:var(--bad)}
.prio li{margin-bottom:10px}.prio .fix{color:var(--ok);margin-top:2px}.jump{font-size:11px;font-family:monospace}
.timeline{font-size:13px}.timeline li{margin:2px 0}.t-issue{color:var(--bad);font-weight:600}.t-note{color:var(--muted)}.tturn{display:inline-block;min-width:24px;color:var(--muted);font-size:11px}
pre{background:var(--code);padding:10px;border-radius:6px;overflow:auto;max-height:420px;font-size:12px;white-space:pre-wrap}
details.check{margin-bottom:6px}details.check summary{cursor:pointer}
.count{color:var(--muted);font-weight:400;font-size:13px}.empty{color:var(--muted);padding:20px;text-align:center}
.warns li{color:var(--warn)}
</style>
</head>
<body>
<div class="wrap">
<header class="top">
  <div>
    <div class="brand">qabot · QA report</div>
    <h1>${esc(r.target.baseUrl)}</h1>
    <div class="sub">${esc(new Date(r.startedAt).toLocaleString())} · ${formatMs(r.durationMs)} · ${r.pages.filter((p) => p.viewport === "desktop").length} pages × ${r.settings.viewports.length} viewports${
      r.target.stack ? ` · ${esc(r.target.stack.framework)}` : ""
    }${r.target.launched ? (r.target.stack?.kind === "static" ? " · served locally" : ` · launched in ${esc(r.target.mode)} mode`) : ""}</div>
  </div>
  <span class="pill verdict ${v.cls}">${v.label}</span>
</header>
<nav class="jump">${ai?.executiveSummary ? '<a href="#summary">Summary</a>' : ""}<a href="#findings">Findings (${r.findings.length})</a><a href="#pages">Pages</a>${api ? '<a href="#api">API</a>' : ""}${code ? '<a href="#code">Code</a>' : ""}${ux ? '<a href="#ux">UX scores</a>' : ""}${explorer ? '<a href="#explorer">Explorer</a>' : ""}<a href="#run">Run info</a></nav>

<section class="card hero">
  <div class="ring" style="--p:${score};--c:var(--${score >= 80 ? "ok" : score >= 50 ? "warn" : "bad"})"><div><div><b>${score}</b><br><span>quality score</span></div></div></div>
  <div>
    <div class="sub">Findings by severity (click to filter)</div>
    <div class="sevs">${SEVERITIES.map((s) => `<span class="sevchip ${s}" data-sev="${s}"><b>${sevCounts[s]}</b>${SEV_LABEL[s]}</span>`).join("")}</div>
  </div>
  <div>${catBars || '<span class="sub">No categories scored</span>'}</div>
</section>

${aiBlock}

<section id="findings">
  <h2>Findings <span class="count">${r.findings.length}</span></h2>
  <div class="filters">
    <input id="q" type="search" placeholder="Search findings, URLs, files…">
    <select id="cat"><option value="">All categories</option>${cats.map((c) => `<option value="${c}">${esc(CATEGORY_LABELS[c])}</option>`).join("")}</select>
    <select id="src"><option value="">All sources</option>${[...new Set(r.findings.map((f) => f.source))].map((s) => `<option value="${s}">${esc(SOURCE_LABEL[s] ?? s)}</option>`).join("")}</select>
  </div>
  <div id="list">${r.findings.map((f) => findingCard(f, counts(f.id))).join("") || '<div class="card empty">No findings. Nice.</div>'}</div>
  <div id="none" class="card empty" hidden>No findings match the filters.</div>
</section>

<section class="card" id="pages"><h2>Pages <span class="count">${new Set(r.pages.map((p) => p.url)).size}</span></h2><div class="table-scroll">${pagesTable(r)}</div>${skipped}</section>
${api}
${code}
${ux}
${explorer}

<section class="card" id="run"><h2>Run info</h2>
<dl class="facts">
  <dt>Target</dt><dd>${esc(r.target.input)}${r.target.repoPath ? ` (<code>${esc(r.target.repoPath)}</code>)` : ""}</dd>
  <dt>Base URL</dt><dd>${esc(r.target.baseUrl)}</dd>
  ${r.target.stack ? `<dt>Stack</dt><dd>${esc(r.target.stack.framework)} / ${esc(r.target.stack.kind)}${r.target.stack.packageManager ? ` / ${esc(r.target.stack.packageManager)}` : ""}</dd>` : ""}
  <dt>Viewports</dt><dd>${r.settings.viewports.join(", ")}</dd>
  <dt>Mutating probes</dt><dd>${r.settings.allowMutations ? "on (local target)" : "off (safe mode)"}</dd>
  <dt>AI</dt><dd>${
    r.settings.ai && ai
      ? `${ai.backend === "claude-code" ? "Claude Code on your Claude login (no API key)" : "Anthropic API"}, model ${esc(ai.model)}: ${ai.usage.requests} model turns, ${ai.usage.inputTokens.toLocaleString()} input / ${ai.usage.outputTokens.toLocaleString()} output tokens, ${ai.usage.cacheReadTokens.toLocaleString()} cached${
          ai.usage.costUsd ? ` (≈ $${ai.usage.costUsd.toFixed(2)} at list prices${ai.backend === "claude-code" ? "; counts toward your plan's usage limits, not billed separately" : ""})` : ""
        }`
      : "off"
  }</dd>
  <dt>Routes found in code</dt><dd>${r.routes.length}</dd>
</dl>
${r.warnings.length || ai?.errors.length ? `<h3>Warnings</h3><ul class="warns">${[...r.warnings, ...(ai?.errors ?? [])].map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
</section>
</div>
<script>
(function(){
  var off = new Set(['info']);
  var chips = document.querySelectorAll('.sevchip');
  var q = document.getElementById('q'), cat = document.getElementById('cat'), src = document.getElementById('src');
  function apply(){
    var term = q.value.trim().toLowerCase(), shown = 0;
    document.querySelectorAll('details.finding').forEach(function(d){
      var ok = !off.has(d.dataset.sev) && (!cat.value || d.dataset.cat === cat.value) && (!src.value || d.dataset.src === src.value) && (!term || d.dataset.q.indexOf(term) !== -1);
      d.hidden = !ok; if (ok) shown++;
    });
    chips.forEach(function(c){ c.classList.toggle('off', off.has(c.dataset.sev)); });
    document.getElementById('none').hidden = shown !== 0 || !document.querySelector('details.finding');
  }
  chips.forEach(function(c){ c.addEventListener('click', function(){ var s = c.dataset.sev; off.has(s) ? off.delete(s) : off.add(s); apply(); }); });
  [q, cat, src].forEach(function(el){ el.addEventListener('input', apply); });
  document.querySelectorAll('a.jump').forEach(function(a){ a.addEventListener('click', function(){ var d = document.querySelector(a.getAttribute('href')); if (d) { off.delete(d.dataset.sev); apply(); d.open = true; } }); });
  if (location.hash && location.hash.indexOf('#f-') === 0) { var d = document.querySelector(location.hash); if (d) d.open = true; }
  apply();
})();
</script>
</body>
</html>`;
}
