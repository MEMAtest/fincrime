import path from "node:path";
import { z } from "zod";
import type { PageInfo } from "../checks/dom-scripts.js";
import type { FindingSink } from "../findings.js";
import type { Category, Finding } from "../types.js";
import { log, mapLimit, truncate } from "../util.js";
import { AiClient, describeAiError, imageBlock } from "./client.js";

const UxReviewSchema = z.object({
  page_purpose: z.string().describe("One sentence: what this page is for and who uses it"),
  overall_score: z.number().describe("0-100 UX quality score for this page"),
  strengths: z.array(z.string()).describe("Up to 3 things the page does well"),
  findings: z.array(
    z.object({
      title: z.string().describe("Specific, scannable issue title naming the element"),
      severity: z.enum(["critical", "high", "medium", "low"]),
      category: z.enum(["visual", "layout", "responsive", "copy", "navigation", "forms", "accessibility", "trust", "consistency", "other"]),
      viewport: z.enum(["desktop", "mobile", "both"]),
      location: z.string().describe("Where on the page, e.g. 'hero section, primary CTA' or 'mobile slice 2, pricing table'"),
      evidence: z.string().describe("What exactly is visible in the screenshot that shows the problem"),
      recommendation: z.string().describe("Concrete fix a developer or designer can apply"),
    }),
  ),
});

const CATEGORY_MAP: Record<string, Category> = {
  visual: "visual",
  layout: "visual",
  responsive: "responsive",
  copy: "content",
  navigation: "ux",
  forms: "ux",
  accessibility: "accessibility",
  trust: "ux",
  consistency: "visual",
  other: "ux",
};

const SYSTEM = `You are a principal product designer and a senior QA lead reviewing one page of a web application from screenshots.
Your job is to find real, specific UI and UX problems a demanding design review or a real user would catch. You are thorough and exacting, but you never invent problems.

Review against:
- Visual hierarchy: is the primary action and the page's purpose obvious within 5 seconds? Competing CTAs, weak contrast between levels, walls of text.
- Layout and alignment: inconsistent spacing, misaligned edges, cramped or orphaned elements, awkward empty space, elements touching screen edges, overlapping content.
- Typography: too many sizes/weights, poor line length, low contrast text, truncated or clipped text, widows in headings.
- Responsive behaviour (mobile slices): content cut off, horizontal overflow, tiny tap targets, stacked elements that lost meaning, tables that don't adapt, fixed elements covering content.
- Copy: typos, grammar, inconsistent terminology or capitalisation, jargon without explanation, placeholder or debug text, unclear button labels, missing units or context for numbers.
- Navigation and wayfinding: can users tell where they are and where to go next? Dead ends, missing back paths, unclear active states.
- Forms: missing labels, unclear required fields, poor input grouping, missing helper or error text, primary button placement.
- States: empty states, loading indicators, error states that look broken, disabled controls with no explanation.
- Trust and polish: broken images, inconsistent iconography, off-brand colours, low-resolution assets, anything that looks unfinished.
- Accessibility you can see: low contrast, colour-only meaning, text in images, tiny text.

Rules:
- Only report what is visible in the screenshots or stated in the page context. Name the element and where it is.
- Do not repeat issues listed under "Already detected by automated checks".
- Severity: critical = blocks a core task or looks broken to every user; high = likely to cause errors, abandonment or distrust; medium = noticeable friction or inconsistency; low = polish.
- Prefer fewer, sharper findings over generic advice. Never say "consider improving X" without saying exactly what is wrong and how to fix it.
- Screenshots are slices of the full page from top to bottom; an element cut at a slice edge is not a bug.`;

export interface UxPageInput {
  url: string;
  desktop: string[];
  mobile: string[];
  info?: PageInfo;
  known: Finding[];
}

export async function runUxReview(ai: AiClient, pages: UxPageInput[], outDir: string, sink: FindingSink) {
  const scores: { url: string; score: number; purpose: string; strengths: string[] }[] = [];
  await mapLimit(pages, 2, async (p) => {
    if (!p.desktop.length) return;
    log.info(`AI UX review: ${new URL(p.url).pathname}`);
    const content: Parameters<AiClient["structured"]>[0]["content"] = [];
    const known = p.known
      .filter((f) => f.occurrences.some((o) => o.url === p.url))
      .slice(0, 25)
      .map((f) => `- [${f.severity}] ${f.title}`)
      .join("\n");
    content.push({
      type: "text",
      text: [
        `Page: ${p.url}`,
        p.info ? `Title: ${p.info.title || "(none)"}` : "",
        p.info?.headings.length ? `Headings:\n${p.info.headings.slice(0, 20).join("\n")}` : "",
        p.info?.buttons.length ? `Buttons: ${p.info.buttons.slice(0, 25).join(" | ")}` : "",
        `Already detected by automated checks (do not repeat):\n${known || "- none"}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
    p.desktop.forEach((f, i) => {
      content.push({ type: "text", text: `Desktop (1440px wide), slice ${i + 1} of ${p.desktop.length}:` });
      content.push(imageBlock(path.join(outDir, f)));
    });
    p.mobile.forEach((f, i) => {
      content.push({ type: "text", text: `Mobile (390px wide, iPhone), slice ${i + 1} of ${p.mobile.length}:` });
      content.push(imageBlock(path.join(outDir, f)));
    });
    content.push({ type: "text", text: "Review this page and return your findings." });
    try {
      const review = await ai.structured({
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        content,
        schema: UxReviewSchema,
      });
      scores.push({ url: p.url, score: Math.max(0, Math.min(100, Math.round(review.overall_score))), purpose: review.page_purpose, strengths: review.strengths.slice(0, 3) });
      for (const f of review.findings) {
        const shot = f.viewport === "mobile" ? p.mobile[0] : p.desktop[0];
        sink.add({
          ruleId: `ai-ux:${f.category}`,
          key: `${p.url}|${f.title}`,
          title: f.title,
          severity: f.severity,
          category: CATEGORY_MAP[f.category] ?? "ux",
          description: `${f.evidence}\n\nWhere: ${f.location}`,
          recommendation: f.recommendation,
          source: "ai-ux",
          occurrence: { url: p.url, viewport: f.viewport === "both" ? "desktop+mobile" : f.viewport, detail: truncate(f.location, 200), screenshot: shot },
          tags: ["ai"],
        });
      }
    } catch (e) {
      const msg = `UX review of ${p.url} failed: ${describeAiError(e)}`;
      ai.errors.push(msg);
      log.warn(msg);
    }
  });
  return scores;
}
