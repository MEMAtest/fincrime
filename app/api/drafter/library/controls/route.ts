import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { listControls, listControlTags } from "@/lib/repo/drafter-controls";
import { coverageGroup } from "@/lib/drafter/tagging";

/** GET /api/drafter/library/controls - every control with its tags and reuse/adapt/new/unassessed group. */
export async function GET(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;

  const controls = await listControls();
  const withTags = await Promise.all(
    controls.map(async (control) => ({
      ...control,
      group: coverageGroup(control.coverage),
      tags: await listControlTags(control.id),
    }))
  );
  return NextResponse.json({ controls: withTags });
}
