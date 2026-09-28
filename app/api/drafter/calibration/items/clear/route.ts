import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { clearCalibrationItems } from "@/lib/repo/drafter-calibration";

/**
 * POST - clears the WHOLE labelled calibration set, so it can be re-imported
 * from scratch. Destructive, so the UI confirms before calling this and the
 * repo layer writes an audit row with the count removed.
 */
export async function POST(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;

  const removed = await clearCalibrationItems(actor.email);
  return NextResponse.json({ removed });
}
