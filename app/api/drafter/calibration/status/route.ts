import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { hasPassingCalibrationRun } from "@/lib/repo/drafter-calibration";
import { currentModelName, isRoleConfigured, PROMPT_VERSIONS } from "@/lib/drafter/llm";

/**
 * GET - drives the "reviewer not yet calibrated" banner shown on the review
 * panel, and also reports whether a model provider is configured at all
 * (prod walkthrough item 3: a compliance user should see ONE plain-English
 * notice at the top of the page when no model is configured, not the same
 * env-var message repeated on every card/button).
 */
export async function GET(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const modelName = currentModelName("judge");
  const promptVersion = PROMPT_VERSIONS.judge_rubric;
  const calibrated = await hasPassingCalibrationRun(modelName, promptVersion);
  const writerConfigured = isRoleConfigured("writer");
  const judgeConfigured = isRoleConfigured("judge");
  return NextResponse.json({ modelName, promptVersion, calibrated, writerConfigured, judgeConfigured });
}
