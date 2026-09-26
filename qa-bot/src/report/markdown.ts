import type { RunReport, Severity } from "../types.js";
import { CATEGORY_LABELS, SEVERITIES } from "../types.js";
import { formatMs, truncate } from "../util.js";

const ICON: Record<Severity, string> = { critical: "🟥", high: "🟧", medium: "🟨", low: "🟦", info: "⬜" };
const VERDICT = { pass: "✅ Looks good", warn: "⚠️ Needs fixes", fail: "❌ Not ready" };

/** Compact Markdown summary, sized for a PR comment or Slack/Teams post. */
export function renderMarkdown(r: RunReport, counts: (id: string) => number, maxChars = 60_000): string {
  const out: string[] = [];
  const pages = new Set(r.pages.map((p) => p.url)).size;
  out.push(`## qabot QA report: ${VERDICT[r.verdict]} (score ${r.scores.overall}/100)`);
  out.push("");
  out.push(
    `**Target:** ${r.target.baseUrl} · **Pages:** ${pages} × ${r.settings.viewports.length} viewports · **API probes:** ${r.api.length} · **Duration:** ${formatMs(r.durationMs)}`,
  );
  out.push("");
  out.push(`| ${SEVERITIES.map((s) => `${ICON[s]} ${s}`).join(" | ")} |`);
  out.push(`|${SEVERITIES.map(() => "---").join("|")}|`);
  out.push(`| ${SEVERITIES.map((s) => r.findings.filter((f) => f.severity === s).length).join(" | ")} |`);
  out.push("");
  if (r.ai?.executiveSummary) {
    out.push(`### Summary`);
    out.push(r.ai.executiveSummary);
    out.push("");
    if (r.ai.topPriorities?.length) {
      out.push(`### Fix first`);
      r.ai.topPriorities.forEach((p, i) => out.push(`${i + 1}. **${p.title}**: ${p.whyItMatters} → _${p.suggestedFix}_`));
      out.push("");
    }
  }
  const important = r.findings.filter((f) => ["critical", "high", "medium"].includes(f.severity) && !f.aiNote);
  if (important.length) {
    out.push(`### Findings`);
    out.push("| | Finding | Category | Where | × |");
    out.push("|---|---|---|---|---|");
    for (const f of important.slice(0, 60)) {
      const where = f.occurrences[0]?.url ? new URL(f.occurrences[0].url).pathname : (f.files?.[0] ?? "");
      out.push(`| ${ICON[f.severity]} | ${truncate(f.title, 120).replace(/\|/g, "\\|")} | ${CATEGORY_LABELS[f.category]} | \`${truncate(where, 60)}\` | ${counts(f.id)} |`);
    }
    if (important.length > 60) out.push(`\n…and ${important.length - 60} more in the HTML report.`);
    out.push("");
  }
  const lowCount = r.findings.filter((f) => f.severity === "low" || f.severity === "info").length;
  if (lowCount) out.push(`<sub>${lowCount} low/info findings omitted, see the full HTML report.</sub>\n`);
  if (r.code.length) {
    out.push(`### Code checks`);
    for (const c of r.code) out.push(`- ${c.status === "pass" ? "✅" : c.status === "skipped" ? "⏭️" : "❌"} **${c.name}**: \`${c.command}\` (${formatMs(c.durationMs)})`);
    out.push("");
  }
  const md = out.join("\n");
  return md.length > maxChars ? `${md.slice(0, maxChars - 200)}\n\n…truncated, see the HTML report.` : md;
}
