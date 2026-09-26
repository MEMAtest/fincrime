import fs from "node:fs";
import { createRequire } from "node:module";
import type { Page } from "playwright";
import type { NewFinding } from "../findings.js";
import type { Severity } from "../types.js";
import { truncate } from "../util.js";
import type { PageCtx } from "./rules.js";

const require = createRequire(import.meta.url);
let axeSource: string | undefined;

function getAxeSource(): string {
  if (!axeSource) axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  return axeSource;
}

interface AxeNode {
  target: string[];
  html: string;
  failureSummary?: string;
}
interface AxeViolation {
  id: string;
  impact: "minor" | "moderate" | "serious" | "critical" | null;
  help: string;
  description: string;
  helpUrl: string;
  tags: string[];
  nodes: AxeNode[];
}

const IMPACT: Record<string, Severity> = { critical: "high", serious: "medium", moderate: "low", minor: "low" };

/** Run axe-core (WCAG 2.2 A/AA + best practices) on the current page. */
export async function runAxe(page: Page, c: PageCtx): Promise<NewFinding[]> {
  // Evaluating the source (rather than adding a <script> tag) works even under a strict CSP.
  await page.evaluate(getAxeSource());
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (ctx: Document, opts: unknown) => Promise<{ violations: unknown[] }> } }).axe;
    const res = await axe.run(document, {
      resultTypes: ["violations"],
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
    });
    return res.violations;
  });
  return (violations as AxeViolation[]).map((v) => {
    const wcag = v.tags.filter((t) => /^wcag\d/.test(t)).join(", ");
    return {
      ruleId: `axe:${v.id}`,
      title: v.help,
      severity: IMPACT[v.impact ?? "moderate"] ?? "low",
      category: "accessibility",
      description:
        `${v.description}${wcag ? ` (${wcag})` : ""}. ${v.nodes.length} element${v.nodes.length === 1 ? "" : "s"} affected on this page.` +
        (v.nodes[0]?.failureSummary ? `\n\n${truncate(v.nodes[0].failureSummary, 600)}` : ""),
      recommendation: `See ${v.helpUrl}`,
      source: "browser",
      occurrence: {
        url: c.url,
        viewport: c.viewport,
        selector: v.nodes[0]?.target.join(" "),
        detail: `${v.nodes.length}× e.g. ${truncate(v.nodes[0]?.html ?? "", 160)}`,
      },
      files: c.files,
      tags: ["wcag"],
    } satisfies NewFinding;
  });
}
