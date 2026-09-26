import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi, invalidDrafterIds } from "@/lib/drafter/access";
import { validateRegisterRows, type ColumnMappingEntry, type RegisterRowInput } from "@/lib/drafter/validation";
import { getDrafterSetting } from "@/lib/repo/drafter-settings";
import {
  getColumnMapping,
  saveColumnMapping,
  listRegisterVersions,
  listRegisterRows,
  createRegisterVersion,
  insertRegisterRows,
  getRegisterImport,
} from "@/lib/repo/drafter-register";
import { checkMissingColumns } from "@/lib/drafter/validation";

interface RouteContext {
  params: Promise<{ importId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { importId } = await context.params;
  const badId = invalidDrafterIds(importId);
  if (badId) return badId;
  const mapping = await getColumnMapping(importId);
  return NextResponse.json({ mapping });
}

/**
 * PUT /api/drafter/register/[importId]/mapping - body { mapping: [...] }.
 * Saves the edited mapping (one role per source header, per SPEC.md) and
 * re-runs validation against the LATEST version's already-stored raw cell
 * data (keyed by source header, independent of the mapping) to produce a
 * new register version - no re-parse of the original file is needed.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;
  const { importId } = await context.params;
  const badId = invalidDrafterIds(importId);
  if (badId) return badId;

  const registerImport = await getRegisterImport(importId);
  if (!registerImport) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { mapping?: ColumnMappingEntry[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body { mapping }" }, { status: 400 });
  }
  if (!Array.isArray(body.mapping) || body.mapping.length === 0) {
    return NextResponse.json({ error: "mapping must be a non-empty array" }, { status: 400 });
  }

  await saveColumnMapping(importId, body.mapping, actor.email);

  const versions = await listRegisterVersions(importId);
  const latestVersion = versions[0];
  if (!latestVersion) return NextResponse.json({ mapping: body.mapping });

  const existingRows = await listRegisterRows(latestVersion.id);
  const rowInputs: RegisterRowInput[] = existingRows.map((row) => ({ rowIndex: row.row_index, cellsByHeader: row.fields }));

  const contradictionRules = (await getDrafterSetting("contradiction_rules")) ?? [];
  const missingColumnIssues = checkMissingColumns(body.mapping.map((m) => m.sourceHeader));
  const rowResults = validateRegisterRows(rowInputs, body.mapping, contradictionRules);

  const nextVersionNumber = latestVersion.version + 1;
  const reqIdField = body.mapping.find((m) => m.fieldKey === "req_id");
  const newVersion = await createRegisterVersion({
    registerImportId: importId,
    version: nextVersionNumber,
    status: missingColumnIssues.some((i) => i.severity === "blocking") ? "blocked" : "validating",
    actor: actor.email,
  });

  await insertRegisterRows(
    newVersion.id,
    rowResults.map((result, idx) => ({
      rowIndex: result.rowIndex,
      reqId: reqIdField ? rowInputs[idx].cellsByHeader[reqIdField.sourceHeader]?.text.trim() || null : null,
      fields: rowInputs[idx].cellsByHeader,
      issues: result.issues,
      isBlocked: result.isBlocked,
    }))
  );

  return NextResponse.json({ mapping: body.mapping, registerVersion: newVersion, missingColumnIssues });
}
