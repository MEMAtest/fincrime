import { NextRequest, NextResponse } from "next/server";
import { requireDrafterActorApi } from "@/lib/drafter/access";
import { getDrafterDocument } from "@/lib/repo/drafter-documents";
import { readDrafterDocumentBytes } from "@/lib/drafter/document-bytes";
import { listXlsxSheets, parseXlsxSheet } from "@/lib/drafter/parsers/xlsx";
import { proposeColumnMapping } from "@/lib/drafter/register-schema";
import { checkMissingColumns, validateRegisterRows, type RegisterRowInput } from "@/lib/drafter/validation";
import { getDrafterSetting } from "@/lib/repo/drafter-settings";
import {
  createRegisterImport,
  createRegisterVersion,
  insertRegisterRows,
  saveColumnMapping,
  listRegisterImports,
} from "@/lib/repo/drafter-register";

export async function GET(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const imports = await listRegisterImports();
  return NextResponse.json({ imports });
}

/**
 * POST /api/drafter/register - body { documentId, sheetName?, headerRowIndex? }.
 * Lists sheets first if sheetName is omitted, so the UI can drive the sheet
 * picker step before committing to an import.
 */
export async function POST(request: NextRequest) {
  const gate = await requireDrafterActorApi(request);
  if ("response" in gate) return gate.response;
  const { actor } = gate;

  let body: { documentId?: string; sheetName?: string; headerRowIndex?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }
  if (!body.documentId) return NextResponse.json({ error: "documentId is required" }, { status: 400 });

  const document = await getDrafterDocument(body.documentId);
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (document.format !== "xlsx" || document.confirmed_doc_type !== "register") {
    return NextResponse.json(
      { error: "The document must be an .xlsx upload confirmed as a register before it can be imported." },
      { status: 400 }
    );
  }

  const bytes = await readDrafterDocumentBytes(document.id);
  if (!bytes) return NextResponse.json({ error: "Could not read the original file" }, { status: 500 });

  if (!body.sheetName) {
    const sheets = await listXlsxSheets(bytes);
    return NextResponse.json({ sheetPicker: sheets.sheetNames });
  }

  const parsedSheet = await parseXlsxSheet(bytes, body.sheetName, body.headerRowIndex);

  const registerImport = await createRegisterImport({
    documentId: document.id,
    sheetName: parsedSheet.sheetName,
    headerRowIndex: parsedSheet.headerRowIndex,
    actor: actor.email,
  });

  const mapping = proposeColumnMapping(parsedSheet.headers);
  await saveColumnMapping(registerImport.id, mapping, actor.email);

  const reqIdField = mapping.find((m) => m.fieldKey === "req_id");
  const rowInputs: RegisterRowInput[] = parsedSheet.rows.map((cells, index) => {
    const cellsByHeader: Record<string, { text: string; error?: string }> = {};
    parsedSheet.headers.forEach((header, colIdx) => {
      cellsByHeader[header] = cells[colIdx] ?? { text: "" };
    });
    return { rowIndex: index, cellsByHeader };
  });

  const contradictionRules = (await getDrafterSetting("contradiction_rules")) ?? [];
  const missingColumnIssues = checkMissingColumns(parsedSheet.headers);
  const rowResults = validateRegisterRows(rowInputs, mapping, contradictionRules);

  const version = await createRegisterVersion({
    registerImportId: registerImport.id,
    version: 1,
    status: missingColumnIssues.some((i) => i.severity === "blocking") ? "blocked" : "validating",
    actor: actor.email,
  });

  await insertRegisterRows(
    version.id,
    rowResults.map((result, idx) => ({
      rowIndex: result.rowIndex,
      reqId: reqIdField ? rowInputs[idx].cellsByHeader[reqIdField.sourceHeader]?.text.trim() || null : null,
      fields: rowInputs[idx].cellsByHeader,
      issues: result.issues,
      isBlocked: result.isBlocked,
    }))
  );

  return NextResponse.json({
    registerImport,
    registerVersion: version,
    mapping,
    missingColumnIssues,
    rowCount: rowInputs.length,
    blockedRowCount: rowResults.filter((r) => r.isBlocked).length,
  });
}
