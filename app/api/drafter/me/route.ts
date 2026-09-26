import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";

/** GET /api/drafter/me - used by the AppShell to decide whether to show the nav entry. 404 if not allowlisted. */
export async function GET(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  return NextResponse.json({ actor: gate.actor });
}
