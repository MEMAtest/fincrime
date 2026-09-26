import { query, withTransaction, queryWithClient } from "@/lib/db";
import { writeDrafterAudit } from "./drafter-audit";
import type { ColumnMappingEntry, ValidationIssue } from "@/lib/drafter/validation";
import type { RegisterCell } from "@/lib/drafter/validation";

export interface RegisterImportRow {
  id: string;
  document_id: string;
  sheet_name: string;
  header_row_index: number;
  current_version: number;
  created_by: string;
  created_at: string;
}

export interface RegisterVersionRow {
  id: string;
  register_import_id: string;
  version: number;
  status: "validating" | "blocked" | "accepted";
  accepted_by: string | null;
  accepted_at: string | null;
  created_by: string;
  created_at: string;
}

export interface RegisterRowRow {
  id: string;
  register_version_id: string;
  req_id: string | null;
  row_index: number;
  fields: Record<string, RegisterCell>;
  validation_issues: ValidationIssue[];
  is_blocked: boolean;
  created_at: string;
}

export async function createRegisterImport(input: {
  documentId: string;
  sheetName: string;
  headerRowIndex: number;
  actor: string;
}): Promise<RegisterImportRow> {
  const rows = await query<RegisterImportRow>(
    `INSERT INTO drafter_register_imports (document_id, sheet_name, header_row_index, created_by)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [input.documentId, input.sheetName, input.headerRowIndex, input.actor]
  );
  return rows[0];
}

export async function saveColumnMapping(
  registerImportId: string,
  mapping: ColumnMappingEntry[],
  actor: string
): Promise<void> {
  await withTransaction(async (client) => {
    for (const col of mapping) {
      await queryWithClient(
        client,
        `INSERT INTO drafter_column_mappings (register_import_id, source_header, role, field_key, updated_by)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (register_import_id, source_header)
         DO UPDATE SET role = EXCLUDED.role, field_key = EXCLUDED.field_key, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [registerImportId, col.sourceHeader, col.role, col.fieldKey, actor]
      );
    }
  });
  await writeDrafterAudit(actor, "register.mapping.save", "drafter_register_import", registerImportId, {
    columns: mapping.length,
  });
}

export async function getColumnMapping(registerImportId: string): Promise<ColumnMappingEntry[]> {
  const rows = await query<{ source_header: string; role: ColumnMappingEntry["role"]; field_key: string }>(
    `SELECT source_header, role, field_key FROM drafter_column_mappings WHERE register_import_id = $1`,
    [registerImportId]
  );
  return rows.map((r) => ({ sourceHeader: r.source_header, role: r.role, fieldKey: r.field_key }));
}

export async function createRegisterVersion(input: {
  registerImportId: string;
  version: number;
  status: RegisterVersionRow["status"];
  actor: string;
}): Promise<RegisterVersionRow> {
  const rows = await query<RegisterVersionRow>(
    `INSERT INTO drafter_register_versions (register_import_id, version, status, created_by)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [input.registerImportId, input.version, input.status, input.actor]
  );
  return rows[0];
}

export async function insertRegisterRows(
  registerVersionId: string,
  rows: { rowIndex: number; reqId: string | null; fields: Record<string, RegisterCell>; issues: ValidationIssue[]; isBlocked: boolean }[]
): Promise<void> {
  await withTransaction(async (client) => {
    for (const row of rows) {
      await queryWithClient(
        client,
        `INSERT INTO drafter_register_rows (register_version_id, req_id, row_index, fields, validation_issues, is_blocked)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [registerVersionId, row.reqId, row.rowIndex, JSON.stringify(row.fields), JSON.stringify(row.issues), row.isBlocked]
      );
    }
  });
}

export async function getRegisterVersion(id: string): Promise<RegisterVersionRow | null> {
  const rows = await query<RegisterVersionRow>(`SELECT * FROM drafter_register_versions WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function listRegisterVersions(registerImportId: string): Promise<RegisterVersionRow[]> {
  return query<RegisterVersionRow>(
    `SELECT * FROM drafter_register_versions WHERE register_import_id = $1 ORDER BY version DESC`,
    [registerImportId]
  );
}

export async function listRegisterRows(registerVersionId: string): Promise<RegisterRowRow[]> {
  return query<RegisterRowRow>(
    `SELECT * FROM drafter_register_rows WHERE register_version_id = $1 ORDER BY row_index ASC`,
    [registerVersionId]
  );
}

export async function getRegisterRow(id: string): Promise<RegisterRowRow | null> {
  const rows = await query<RegisterRowRow>(`SELECT * FROM drafter_register_rows WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function markRegisterRowResolved(rowId: string, isBlocked: boolean): Promise<void> {
  await query(`UPDATE drafter_register_rows SET is_blocked = $2 WHERE id = $1`, [rowId, isBlocked]);
}

export async function addValidationOverride(input: {
  registerRowId: string;
  checkName: string;
  resolution: "resolved" | "overridden";
  note: string | null;
  actor: string;
}): Promise<void> {
  await query(
    `INSERT INTO drafter_validation_overrides (register_row_id, check_name, resolution, note, actor)
     VALUES ($1,$2,$3,$4,$5)`,
    [input.registerRowId, input.checkName, input.resolution, input.note, input.actor]
  );
  await writeDrafterAudit(input.actor, `register.row.${input.resolution}`, "drafter_register_row", input.registerRowId, {
    check: input.checkName,
    note: input.note,
  });
}

export async function listValidationOverrides(registerRowId: string): Promise<
  { check_name: string; resolution: string; note: string | null; actor: string; created_at: string }[]
> {
  return query(
    `SELECT check_name, resolution, note, actor, created_at FROM drafter_validation_overrides WHERE register_row_id = $1 ORDER BY created_at ASC`,
    [registerRowId]
  );
}

/**
 * All overrides for every row in a version, in one query, keyed by
 * register_row_id -> check_name -> resolution. Used by the register detail
 * screen so a resolved/overridden blocking issue can be shown as such
 * instead of leaving its "Mark resolved"/"Override" buttons looking
 * identically actionable forever (see docs/pra-drafter/REHEARSAL.md issue
 * "register import screen never shows a resolved issue as resolved").
 */
export async function listValidationOverridesForVersion(
  registerVersionId: string
): Promise<Record<string, Record<string, { resolution: string; note: string | null; actor: string }>>> {
  const rows = await query<{ register_row_id: string; check_name: string; resolution: string; note: string | null; actor: string }>(
    `SELECT o.register_row_id, o.check_name, o.resolution, o.note, o.actor
     FROM drafter_validation_overrides o
     JOIN drafter_register_rows r ON r.id = o.register_row_id
     WHERE r.register_version_id = $1
     ORDER BY o.created_at ASC`,
    [registerVersionId]
  );
  const byRow: Record<string, Record<string, { resolution: string; note: string | null; actor: string }>> = {};
  for (const r of rows) {
    byRow[r.register_row_id] ??= {};
    byRow[r.register_row_id][r.check_name] = { resolution: r.resolution, note: r.note, actor: r.actor };
  }
  return byRow;
}

export async function acceptRegisterVersion(id: string, actor: string): Promise<RegisterVersionRow | null> {
  const rows = await query<RegisterVersionRow>(
    `UPDATE drafter_register_versions SET status = 'accepted', accepted_by = $2, accepted_at = now() WHERE id = $1 RETURNING *`,
    [id, actor]
  );
  const row = rows[0] ?? null;
  if (row) await writeDrafterAudit(actor, "register.version.accept", "drafter_register_version", id, {});
  return row;
}

export async function listRegisterImports(): Promise<RegisterImportRow[]> {
  return query<RegisterImportRow>(`SELECT * FROM drafter_register_imports ORDER BY created_at DESC`);
}

export async function getRegisterImport(id: string): Promise<RegisterImportRow | null> {
  const rows = await query<RegisterImportRow>(`SELECT * FROM drafter_register_imports WHERE id = $1`, [id]);
  return rows[0] ?? null;
}
