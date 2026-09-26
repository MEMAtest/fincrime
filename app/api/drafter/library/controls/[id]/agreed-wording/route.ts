import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi, invalidDrafterIds } from "@/lib/drafter/access";
import { setAgreedWording } from "@/lib/repo/drafter-controls";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST {agreedWording} - lets a user enter/approve a library control's
 * agreed wording directly (Scope B fix #7). A "reuse" enhancement drafts a
 * placeholder + open item until this is set - it never falls back to the
 * obligation description, which is a requirement, not control wording.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;
  const { id } = await context.params;
  const badId = invalidDrafterIds(id);
  if (badId) return badId;

  const body = await request.json().catch(() => null);
  const agreedWording = typeof body?.agreedWording === "string" ? body.agreedWording.trim() : "";
  if (!agreedWording) return NextResponse.json({ error: "agreedWording is required" }, { status: 400 });

  const control = await setAgreedWording(id, agreedWording, actor.email);
  if (!control) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ control });
}
