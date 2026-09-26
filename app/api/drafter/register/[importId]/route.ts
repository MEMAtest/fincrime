import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi, invalidDrafterIds } from "@/lib/drafter/access";
import { checkMissingColumns } from "@/lib/drafter/validation";
import {
  getRegisterImport,
  getColumnMapping,
  listRegisterVersions,
  listRegisterRows,
  listValidationOverridesForVersion,
  deleteRegisterImport,
} from "@/lib/repo/drafter-register";

interface RouteContext {
  params: Promise<{ importId: string }>;
}

/** GET /api/drafter/register/[importId] - the import, its saved mapping, versions and the latest version's rows. */
export async function GET(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { importId } = await context.params;
  const badId = invalidDrafterIds(importId);
  if (badId) return badId;

  const registerImport = await getRegisterImport(importId);
  if (!registerImport) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const mapping = await getColumnMapping(importId);
  const versions = await listRegisterVersions(importId);
  const latestVersion = versions[0] ?? null;
  const rows = latestVersion ? await listRegisterRows(latestVersion.id) : [];
  const overridesByRow = latestVersion ? await listValidationOverridesForVersion(latestVersion.id) : {};
  const missingColumnIssues = checkMissingColumns(mapping.map((m) => m.sourceHeader));

  return NextResponse.json({ registerImport, mapping, versions, latestVersion, rows, missingColumnIssues, overridesByRow });
}

/**
 * DELETE /api/drafter/register/[importId] - removes the import and all its
 * versions/rows (prod walkthrough item 5). 409 with an explanation if a PRA
 * still references one of its versions.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { importId } = await context.params;
  const badId = invalidDrafterIds(importId);
  if (badId) return badId;

  const result = await deleteRegisterImport(importId, gate.actor.email);
  if (!result.deleted && !result.blockedReason) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (result.blockedReason) return NextResponse.json({ error: result.blockedReason }, { status: 409 });
  return NextResponse.json({ ok: true });
}
