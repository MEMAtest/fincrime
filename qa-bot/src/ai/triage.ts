import { z } from "zod";
import type { FindingSink } from "../findings.js";
import type { AiSummary, Finding, RouteInfo, StackInfo } from "../types.js";
import { log, truncate } from "../util.js";
import { describeAiError, type AiBackend } from "./backend.js";

const TriageSchema = z.object({
  executive_summary: z.string().describe("3-6 sentences for a product owner: overall quality, biggest risks, readiness"),
  release_recommendation: z.enum(["ship", "ship_with_fixes", "block"]),
  top_priorities: z
    .array(
      z.object({
        title: z.string(),
        why_it_matters: z.string(),
        finding_ids: z.array(z.string()),
        suggested_fix: z.string().describe("Concrete technical fix, naming components/endpoints where possible"),
        likely_files: z.array(z.string()),
      }),
    )
    .describe("The 3-10 things to fix first, grouping findings that share a root cause"),
  likely_false_positives: z.array(z.object({ finding_id: z.string(), reason: z.string() })),
  missing_coverage: z.array(z.string()).describe("Important areas this run did not test that a human should check or configure"),
});

const SYSTEM = `You are the QA lead signing off a release. You receive the raw findings of an automated QA run (browser checks, accessibility scans, API probes, code checks, an AI UX review and an AI exploratory tester) for one web application.
Your job: separate signal from noise, group findings that share a root cause, rank what to fix first by user impact and risk, and point developers at the likely source files.
Be decisive and specific. Flag a finding as a likely false positive only when the evidence clearly supports it (e.g. a dev-server-only artefact, a third-party widget outside the team's control, a check that misread an intentional design).`;

export async function runTriage(
  ai: AiBackend,
  opts: {
    sink: FindingSink;
    findings: Finding[];
    stack?: StackInfo;
    baseUrl: string;
    routes: RouteInfo[];
    notes: string[];
  },
): Promise<Pick<AiSummary, "executiveSummary" | "releaseRecommendation" | "topPriorities" | "missingCoverage"> | undefined> {
  const lines = opts.findings.slice(0, 200).map((f) => {
    const n = opts.sink.occurrenceCount(f.id);
    const where = f.occurrences[0]?.url ? ` @ ${new URL(f.occurrences[0].url).pathname}` : "";
    const files = f.files?.length ? ` files: ${f.files.slice(0, 3).join(", ")}` : "";
    return `${f.id} | ${f.severity} | ${f.category} | ${f.source} | ${truncate(f.title, 140)} | ×${n}${where}${files}\n    ${truncate(f.description.replace(/\s+/g, " "), 280)}`;
  });
  const routeList = opts.routes
    .slice(0, 120)
    .map((r) => `${r.path}${r.file ? ` → ${r.file}` : ""}`)
    .join("\n");
  const text = `Target: ${opts.baseUrl}
Stack: ${opts.stack ? `${opts.stack.framework} (${opts.stack.kind})` : "unknown (URL-only run)"}
Run notes:
${opts.notes.map((n) => `- ${n}`).join("\n") || "- none"}

Routes and their source files:
${routeList || "(not available)"}

Findings (id | severity | category | source | title | occurrences @ first page | files, then description):
${lines.join("\n")}`;
  try {
    log.info("AI triage: prioritising findings");
    const t = await ai.structured({ system: SYSTEM, text, schema: TriageSchema });
    const known = new Set(opts.findings.map((f) => f.id));
    for (const fp of t.likely_false_positives) {
      const f = opts.sink.get(fp.finding_id);
      if (f) f.aiNote = `Likely false positive: ${fp.reason}`;
    }
    return {
      executiveSummary: t.executive_summary,
      releaseRecommendation: t.release_recommendation,
      topPriorities: t.top_priorities.map((p) => ({
        title: p.title,
        whyItMatters: p.why_it_matters,
        findingIds: p.finding_ids.filter((id) => known.has(id)),
        suggestedFix: p.suggested_fix,
        likelyFiles: p.likely_files,
      })),
      missingCoverage: t.missing_coverage,
    };
  } catch (e) {
    const m = `Triage failed: ${describeAiError(e)}`;
    ai.errors.push(m);
    log.warn(m);
    return undefined;
  }
}
