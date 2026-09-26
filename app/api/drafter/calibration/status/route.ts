import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { hasPassingCalibrationRun } from "@/lib/repo/drafter-calibration";
import { currentModelName, PROMPT_VERSIONS } from "@/lib/drafter/llm";

/** GET - drives the "reviewer not yet calibrated" banner shown on the review panel. */
export async function GET(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const modelName = currentModelName("judge");
  const promptVersion = PROMPT_VERSIONS.judge_rubric;
  const calibrated = await hasPassingCalibrationRun(modelName, promptVersion);
  return NextResponse.json({ modelName, promptVersion, calibrated });
}
