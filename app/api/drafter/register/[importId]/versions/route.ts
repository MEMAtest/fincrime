import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { listRegisterVersions, listRegisterRows, acceptRegisterVersion, getRegisterVersion, getColumnMapping } from "@/lib/repo/drafter-register";
import { buildControlsFromRegisterVersion } from "@/lib/repo/drafter-controls";

interface RouteContext {
  params: Promise<{ importId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { importId } = await context.params;
  const versions = await listRegisterVersions(importId);
  return NextResponse.json({ versions });
}

/**
 * POST /api/drafter/register/[importId]/versions - body { versionId, action: "accept" }.
 * Accepting a version blocks on any row still marked is_blocked (unresolved
 * blocking issue) - the app never resolves a contradiction or override
 * itself; the user must have resolved/overridden every blocking row first
 * via the register-rows override endpoint. On success, builds controls for
 * every accepted, non-blocked row.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;
  const { importId } = await context.params;

  let body: { versionId?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body { versionId, action }" }, { status: 400 });
  }
  if (body.action !== "accept" || !body.versionId) {
    return NextResponse.json({ error: 'Only { action: "accept", versionId } is supported' }, { status: 400 });
  }

  const version = await getRegisterVersion(body.versionId);
  if (!version || version.register_import_id !== importId) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const rows = await listRegisterRows(version.id);
  const stillBlocked = rows.filter((r) => r.is_blocked);
  if (stillBlocked.length > 0) {
    return NextResponse.json(
      {
        error: `${stillBlocked.length} row(s) still have an unresolved blocking issue. Resolve or override each one before accepting this version.`,
        blockedRowIds: stillBlocked.map((r) => r.id),
      },
      { status: 409 }
    );
  }

  const accepted = await acceptRegisterVersion(version.id, actor.email);
  const mapping = await getColumnMapping(importId);
  const buildResult = await buildControlsFromRegisterVersion(
    version.id,
    rows.map((r) => ({ id: r.id, req_id: r.req_id, fields: r.fields, is_blocked: r.is_blocked })),
    mapping,
    actor.email
  );

  return NextResponse.json({
    version: accepted,
    controlsBuilt: buildResult.created,
    controlsUpdated: buildResult.updated,
  });
}
