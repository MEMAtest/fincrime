import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi, invalidDrafterIds } from "@/lib/drafter/access";
import { deleteCalibrationItem } from "@/lib/repo/drafter-calibration";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** DELETE - removes one calibration item (management action, so a mislabelled item can be dropped without clearing the whole set). Audited. */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;

  const { id } = await context.params;
  const badId = invalidDrafterIds(id);
  if (badId) return badId;

  const deleted = await deleteCalibrationItem(id, actor.email);
  if (!deleted) return NextResponse.json({ error: "Calibration item not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
