import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { listCalibrationRuns } from "@/lib/repo/drafter-calibration";

export async function GET(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const runs = await listCalibrationRuns();
  return NextResponse.json({ runs });
}
