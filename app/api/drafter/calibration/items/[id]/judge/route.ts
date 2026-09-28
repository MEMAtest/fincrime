import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi, invalidDrafterIds } from "@/lib/drafter/access";
import { getCalibrationItem, saveCalibrationItemJudgeOutput } from "@/lib/repo/drafter-calibration";
import { judgeText } from "@/lib/drafter/judge-runner";
import { getLatestStylepackVersion, SEED_STYLE_RULES } from "@/lib/repo/drafter-stylepacks";
import { isRoleConfigured, roleDisabledReason, currentModelName, PROMPT_VERSIONS } from "@/lib/drafter/llm";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST - judges ONE calibration item with the SAME judge production uses
 * (`judgeText`, shared with `judgeOneEnhancement`), tagged with the model +
 * prompt version it ran under. Per-item, not the whole set in one request,
 * so 20-30 items never risk the serverless function timeout a single
 * sequential loop over the whole set used to hit (defect #2).
 *
 * Style rules: the CURRENT StylePack version's rules when one exists, else
 * the seeded default rules - calibration must measure the judge against the
 * same rules production currently drafts against, never an empty list.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;

  const { id } = await context.params;
  const badId = invalidDrafterIds(id);
  if (badId) return badId;

  if (!isRoleConfigured("judge")) {
    return NextResponse.json({ error: roleDisabledReason("judge") }, { status: 422 });
  }

  const item = await getCalibrationItem(id);
  if (!item) return NextResponse.json({ error: "Calibration item not found." }, { status: 404 });

  const stylepackVersion = await getLatestStylepackVersion();
  const styleRules = stylepackVersion?.rules?.length ? stylepackVersion.rules : SEED_STYLE_RULES;

  const result = await judgeText({
    controlText: item.enhancement_text,
    rationale: item.rationale_text,
    sectionTitle: item.section_type,
    styleRules,
  });

  const modelName = result.ok ? result.modelName : currentModelName("judge");
  const judgeOutput = result.ok ? { criteria: result.criteria } : { invalid: true as const, error: result.reason };

  const updated = await saveCalibrationItemJudgeOutput(id, judgeOutput, modelName, result.promptVersion ?? PROMPT_VERSIONS.judge_rubric);

  return NextResponse.json({ item: updated, ok: result.ok, error: result.ok ? undefined : result.reason });
}
