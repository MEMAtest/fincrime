import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { checkMissingColumns } from "@/lib/drafter/validation";
import {
  getRegisterImport,
  getColumnMapping,
  listRegisterVersions,
  listRegisterRows,
  listValidationOverridesForVersion,
} from "@/lib/repo/drafter-register";

interface RouteContext {
  params: Promise<{ importId: string }>;
}

/** GET /api/drafter/register/[importId] - the import, its saved mapping, versions and the latest version's rows. */
export async function GET(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { importId } = await context.params;

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
