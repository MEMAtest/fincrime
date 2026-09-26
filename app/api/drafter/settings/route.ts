import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { getAllDrafterSettings, setDrafterSetting, isValidSettingsKey } from "@/lib/repo/drafter-settings";

export async function GET(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const settings = await getAllDrafterSettings();
  return NextResponse.json({ settings });
}

/** PUT /api/drafter/settings - body { key, value }. One key at a time, matching the settings page's per-section save. */
export async function PUT(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;

  let body: { key?: string; value?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body { key, value }" }, { status: 400 });
  }
  if (!body.key || !isValidSettingsKey(body.key)) {
    return NextResponse.json({ error: "Unknown settings key" }, { status: 400 });
  }
  if (body.value === undefined) return NextResponse.json({ error: "value is required" }, { status: 400 });

  await setDrafterSetting(body.key, body.value, gate.actor.email);
  const settings = await getAllDrafterSettings();
  return NextResponse.json({ settings });
}
