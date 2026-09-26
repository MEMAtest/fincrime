import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { listControls, listAllConfirmedTags, listMergeGroups, upsertMergeGroupCandidate } from "@/lib/repo/drafter-controls";
import { proposeMergeGroups, type MergeableControl } from "@/lib/drafter/tagging";

/**
 * GET /api/drafter/library/merge-groups - (re)computes merge candidate
 * groups from controls sharing a back office control and a shared CONFIRMED
 * risk_addressed tag, upserts each as a candidate row, and returns every
 * merge group (candidate + already-decided). Recomputing on every GET keeps
 * candidates in sync as tags get confirmed, without a separate trigger.
 */
export async function GET(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;

  const [controls, confirmedTags] = await Promise.all([listControls(), listAllConfirmedTags()]);
  const riskTagsByControl = new Map<string, string[]>();
  for (const tag of confirmedTags) {
    if (tag.tag_type !== "risk_addressed") continue;
    const list = riskTagsByControl.get(tag.control_id) ?? [];
    list.push(tag.value);
    riskTagsByControl.set(tag.control_id, list);
  }

  const mergeable: MergeableControl[] = controls.map((c) => ({
    id: c.id,
    backofficeControl: c.backoffice_control,
    confirmedRiskTags: riskTagsByControl.get(c.id) ?? [],
  }));

  const candidates = proposeMergeGroups(mergeable);
  await Promise.all(
    candidates.map((c) =>
      upsertMergeGroupCandidate({ backofficeControl: c.backofficeControl, riskTagValue: c.riskTagValue, controlIds: c.controlIds })
    )
  );

  const groups = await listMergeGroups();
  return NextResponse.json({ groups });
}
