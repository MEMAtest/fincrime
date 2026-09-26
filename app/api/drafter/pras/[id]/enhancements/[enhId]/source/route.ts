import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi, invalidDrafterIds } from "@/lib/drafter/access";
import { getEnhancement, getControlSourceFields } from "@/lib/repo/drafter-pras";
import { getControl, listControlTags } from "@/lib/repo/drafter-controls";

interface RouteContext {
  params: Promise<{ id: string; enhId: string }>;
}

/**
 * GET - source view (SPEC.md "Page viewer and editing": "Source view: the
 * register rows and fields each enhancement was drafted from"). Returns
 * each control this enhancement covers, its tags, and the resolved
 * register-row fields it was drafted from.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { enhId } = await context.params;
  const badId = invalidDrafterIds(enhId);
  if (badId) return badId;

  const enhancement = await getEnhancement(enhId);
  if (!enhancement) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const controls = await Promise.all(
    enhancement.control_ids.map(async (controlId) => ({
      control: await getControl(controlId),
      tags: await listControlTags(controlId),
      sourceFields: await getControlSourceFields(controlId),
    }))
  );

  return NextResponse.json({ controls });
}
