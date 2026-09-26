import { describe, it, expect, afterAll } from "vitest";
import { query } from "@/lib/db";
import { buildControlsFromRegisterVersion, listControls } from "../drafter-controls";
import type { ColumnMappingEntry, RegisterCell } from "@/lib/drafter/validation";

/**
 * Reproduces the prod duplicate-controls bug: a register import accepted
 * twice (or a second version of the same import accepted) must never
 * produce two library controls for the same req_id. See
 * lib/repo/drafter-controls.ts buildControlsFromRegisterVersion for the
 * fix - update-in-place keyed by req_id instead of always inserting.
 */

const ACTOR = "drafter-dedupe-test@example.com";
const documentIds: string[] = [];
const importIds: string[] = [];
const versionIds: string[] = [];

const mapping: ColumnMappingEntry[] = [
  { sourceHeader: "Obligation", role: "draft_input", fieldKey: "obligation_description" },
  { sourceHeader: "Coverage", role: "reuse_adapt_new", fieldKey: "control_coverage_assessment" },
];

async function makeVersion(
  reqId: string,
  obligationText: string
): Promise<{ versionId: string; rows: { id: string; req_id: string | null; fields: Record<string, RegisterCell>; is_blocked: boolean }[] }> {
  const docRows = await query<{ id: string }>(
    `INSERT INTO drafter_documents (doc_type, confirmed_doc_type, filename, format, content_hash, uploaded_by)
     VALUES ('register','register',$1,'xlsx',$2,$3) RETURNING id`,
    [`dedupe-${reqId}-${Date.now()}.xlsx`, `hash-${reqId}-${Math.random()}`, ACTOR]
  );
  documentIds.push(docRows[0].id);

  const importRows = await query<{ id: string }>(
    `INSERT INTO drafter_register_imports (document_id, sheet_name, header_row_index, created_by)
     VALUES ($1,'Sheet1',0,$2) RETURNING id`,
    [docRows[0].id, ACTOR]
  );
  importIds.push(importRows[0].id);

  const versionRows = await query<{ id: string }>(
    `INSERT INTO drafter_register_versions (register_import_id, version, status, created_by)
     VALUES ($1,1,'accepted',$2) RETURNING id`,
    [importRows[0].id, ACTOR]
  );
  versionIds.push(versionRows[0].id);

  const rowRows = await query<{ id: string }>(
    `INSERT INTO drafter_register_rows (register_version_id, req_id, row_index, fields, validation_issues, is_blocked)
     VALUES ($1,$2,0,$3,'[]',false) RETURNING id`,
    [
      versionRows[0].id,
      reqId,
      JSON.stringify({
        Obligation: { text: obligationText },
        Coverage: { text: "Yes" },
      }),
    ]
  );

  return {
    versionId: versionRows[0].id,
    rows: [{ id: rowRows[0].id, req_id: reqId, fields: { Obligation: { text: obligationText }, Coverage: { text: "Yes" } }, is_blocked: false }],
  };
}

afterAll(async () => {
  const controlRows = await query<{ id: string }>(`SELECT id FROM drafter_controls WHERE req_ids && $1::text[]`, [["REQ-DEDUPE-0001"]]);
  const controlIds = controlRows.map((r) => r.id);
  if (controlIds.length) {
    await query(`DELETE FROM drafter_control_history WHERE control_id = ANY($1::uuid[])`, [controlIds]);
    await query(`DELETE FROM drafter_control_tags WHERE control_id = ANY($1::uuid[])`, [controlIds]);
    await query(`DELETE FROM drafter_controls WHERE id = ANY($1::uuid[])`, [controlIds]);
  }
  for (const versionId of versionIds) await query(`DELETE FROM drafter_register_rows WHERE register_version_id = $1`, [versionId]);
  await query(`DELETE FROM drafter_register_versions WHERE id = ANY($1::uuid[])`, [versionIds]);
  await query(`DELETE FROM drafter_register_imports WHERE id = ANY($1::uuid[])`, [importIds]);
  await query(`DELETE FROM drafter_documents WHERE id = ANY($1::uuid[])`, [documentIds]);
});

describe("buildControlsFromRegisterVersion dedupe by req_id", () => {
  it("accepting the same requirement twice updates the control in place, never duplicates it", async () => {
    const first = await makeVersion("REQ-DEDUPE-0001", "First accepted wording");
    const result1 = await buildControlsFromRegisterVersion(first.versionId, first.rows, mapping, ACTOR);
    expect(result1.created).toBe(1);
    expect(result1.updated).toBe(0);

    const second = await makeVersion("REQ-DEDUPE-0001", "Second accepted wording, corrected");
    const result2 = await buildControlsFromRegisterVersion(second.versionId, second.rows, mapping, ACTOR);
    expect(result2.created).toBe(0);
    expect(result2.updated).toBe(1);

    const all = await listControls();
    const matches = all.filter((c) => c.req_ids.includes("REQ-DEDUPE-0001"));
    expect(matches.length).toBe(1);
    expect(matches[0].title).toContain("Second accepted wording");

    const history = await query<{ id: string }>(
      `SELECT id FROM drafter_control_history WHERE control_id = $1`,
      [matches[0].id]
    );
    expect(history.length).toBe(1);
  });
});
