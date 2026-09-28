import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { lintEnhancement } from "@/lib/drafter/lint";
import { JUDGE_CRITERIA } from "@/lib/drafter/judge";
import { judgeText } from "@/lib/drafter/judge-runner";
import { combineStatus } from "@/lib/drafter/review-status";
import { isRoleConfigured, roleDisabledReason } from "@/lib/drafter/llm";
import { getLatestStylepackVersion } from "@/lib/repo/drafter-stylepacks";

/**
 * POST {controlText, rationale, sectionTitle?} - the paste-in reviewer
 * (SPEC.md "Reviewer": "The reviewer also runs on text pasted in by the
 * user"). Stateless - lint + judge only, nothing is persisted, so a user
 * can sanity-check draft text from anywhere before it goes anywhere near a
 * PRA. Uses the latest StylePack version's rules/banned phrases/word limits.
 */
export async function POST(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;

  const body = await request.json().catch(() => null);
  const controlText = typeof body?.controlText === "string" ? body.controlText : "";
  const rationale = typeof body?.rationale === "string" ? body.rationale : "";
  const sectionTitle = typeof body?.sectionTitle === "string" && body.sectionTitle.trim() ? body.sectionTitle.trim() : "(section not given)";

  if (!controlText.trim()) {
    return NextResponse.json({ error: "controlText is required" }, { status: 400 });
  }

  const stylepackVersion = await getLatestStylepackVersion();
  const styleRules = stylepackVersion?.rules ?? [];
  const bannedPhrases = stylepackVersion?.banned_phrases ?? [];
  const wordLimits = stylepackVersion?.length_limits
    ? { min: stylepackVersion.length_limits.min_words, max: stylepackVersion.length_limits.max_words }
    : { min: 60, max: 150 };

  const lint = lintEnhancement({ controlText, rationale, wordLimits, bannedPhrases });

  if (!isRoleConfigured("judge")) {
    return NextResponse.json({
      lint,
      judge: null,
      judgeDisabledReason: roleDisabledReason("judge"),
      status: combineStatus({ lintIssues: lint, judge: null, judgeStale: false }),
    });
  }

  const result = await judgeText({ controlText, rationale, sectionTitle, styleRules });

  if (!result.ok) {
    return NextResponse.json({
      lint,
      judge: { error: result.reason, invalid: true },
      status: combineStatus({ lintIssues: lint, judge: { error: result.reason, invalid: true }, judgeStale: false }),
      criteriaDefs: JUDGE_CRITERIA,
    });
  }

  const judge = { criteria: result.criteria, overall: result.overall, modelName: result.modelName, promptVersion: result.promptVersion };

  return NextResponse.json({
    lint,
    judge,
    status: combineStatus({ lintIssues: lint, judge, judgeStale: false }),
    criteriaDefs: JUDGE_CRITERIA,
  });
}
